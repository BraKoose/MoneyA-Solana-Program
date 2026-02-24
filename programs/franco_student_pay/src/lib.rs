use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

// NOTE: Set after `anchor keys sync` / deploy.
declare_id!("BBZjnEN1JFj7caLdBMeXCvBAbntAi3Hd2Z9pxQ78zMJV");

#[program]
pub mod franco_student_pay {
    use super::*;

    pub fn initialize_treasury(ctx: Context<InitializeTreasury>, fee_bps: u16) -> Result<()> {
        require!(fee_bps <= 10_000, FrancoError::InvalidFeeBps);

        let treasury = &mut ctx.accounts.treasury;
        treasury.authority = ctx.accounts.authority.key();
        treasury.usdc_mint = ctx.accounts.usdc_mint.key();
        treasury.treasury_token_account = ctx.accounts.treasury_token_account.key();
        treasury.fee_bps = fee_bps;
        treasury.bump = ctx.bumps.treasury;

        Ok(())
    }

    pub fn register_student(ctx: Context<RegisterStudent>, country: String) -> Result<()> {
        require!(country.as_bytes().len() <= 32, FrancoError::CountryTooLong);

        let student = &mut ctx.accounts.student;
        student.owner = ctx.accounts.owner.key();
        student.country = country;
        student.is_frozen = false;
        student.total_volume = 0;
        student.flagged = false;
        student.bump = ctx.bumps.student;

        emit!(StudentRegistered {
            owner: student.owner,
            country: student.country.clone(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn settle_onramp(
        ctx: Context<SettleOnramp>,
        reference_hash: [u8; 32],
        amount: u64,
        kotani_reference: String,
    ) -> Result<()> {
        require!(hash(kotani_reference.as_bytes()).to_bytes() == reference_hash, FrancoError::ReferenceHashMismatch);
        require!(amount > 0, FrancoError::InvalidAmount);
        require!(kotani_reference.as_bytes().len() <= TransactionRecord::MAX_REF_BYTES, FrancoError::ReferenceTooLong);
        require!(!ctx.accounts.student.is_frozen, FrancoError::StudentFrozen);

        // Idempotency: if tx_record is already initialized, do not transfer again.
        if ctx.accounts.tx_record.initialized {
            return Ok(());
        }

        let treasury = &ctx.accounts.treasury;

        let treasury_seeds: &[&[u8]] = &[b"treasury", &[treasury.bump]];

        let cpi_accounts = TransferChecked {
            from: ctx.accounts.treasury_token_account.to_account_info(),
            mint: ctx.accounts.usdc_mint.to_account_info(),
            to: ctx.accounts.student_ata.to_account_info(),
            authority: ctx.accounts.treasury.to_account_info(),
        };
        let signer_seeds = &[treasury_seeds];
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts)
            .with_signer(signer_seeds);
        token::transfer_checked(cpi_ctx, amount, ctx.accounts.usdc_mint.decimals)?;

        let student = &mut ctx.accounts.student;
        student.total_volume = student
            .total_volume
            .checked_add(amount)
            .ok_or(FrancoError::MathOverflow)?;

        let tx_record = &mut ctx.accounts.tx_record;
        tx_record.initialized = true;
        tx_record.sender = treasury.key();
        tx_record.receiver = student.owner;
        tx_record.amount = amount;
        tx_record.timestamp = Clock::get()?.unix_timestamp;
        tx_record.kotani_reference = kotani_reference.clone();
        tx_record.fraud_score = 0;
        tx_record.is_flagged = false;
        tx_record.bump = ctx.bumps.tx_record;

        emit!(OnRampSettled {
            student: student.owner,
            amount,
            reference: kotani_reference,
            timestamp: tx_record.timestamp,
        });

        Ok(())
    }

    pub fn send_usdc(ctx: Context<SendUsdc>, reference_hash: [u8; 32], amount: u64, reference: String) -> Result<()> {
        require!(hash(reference.as_bytes()).to_bytes() == reference_hash, FrancoError::ReferenceHashMismatch);
        require!(amount > 0, FrancoError::InvalidAmount);
        require!(!ctx.accounts.sender_student.is_frozen, FrancoError::StudentFrozen);
        require!(reference.as_bytes().len() > 0, FrancoError::InvalidReference);
        require!(reference.as_bytes().len() <= TransactionRecord::MAX_REF_BYTES, FrancoError::ReferenceTooLong);

        if ctx.accounts.tx_record.initialized {
            return Ok(());
        }

        let sender_student = &mut ctx.accounts.sender_student;
        let receiver_student = &mut ctx.accounts.receiver_student;

        let cpi_accounts = TransferChecked {
            from: ctx.accounts.sender_ata.to_account_info(),
            mint: ctx.accounts.usdc_mint.to_account_info(),
            to: ctx.accounts.receiver_ata.to_account_info(),
            authority: ctx.accounts.sender.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token::transfer_checked(cpi_ctx, amount, ctx.accounts.usdc_mint.decimals)?;

        sender_student.total_volume = sender_student
            .total_volume
            .checked_add(amount)
            .ok_or(FrancoError::MathOverflow)?;
        receiver_student.total_volume = receiver_student
            .total_volume
            .checked_add(amount)
            .ok_or(FrancoError::MathOverflow)?;

        let tx_record = &mut ctx.accounts.tx_record;
        tx_record.initialized = true;
        tx_record.sender = ctx.accounts.sender.key();
        tx_record.receiver = ctx.accounts.receiver.key();
        tx_record.amount = amount;
        tx_record.timestamp = Clock::get()?.unix_timestamp;
        tx_record.kotani_reference = reference.clone();
        tx_record.fraud_score = 0;
        tx_record.is_flagged = false;
        tx_record.bump = ctx.bumps.tx_record;

        emit!(TransferExecuted {
            sender: tx_record.sender,
            receiver: tx_record.receiver,
            amount,
            reference,
            timestamp: tx_record.timestamp,
        });

        Ok(())
    }

    pub fn settle_offramp(
        ctx: Context<SettleOfframp>,
        reference_hash: [u8; 32],
        amount: u64,
        kotani_reference: String,
    ) -> Result<()> {
        require!(hash(kotani_reference.as_bytes()).to_bytes() == reference_hash, FrancoError::ReferenceHashMismatch);
        require!(amount > 0, FrancoError::InvalidAmount);
        require!(kotani_reference.as_bytes().len() <= TransactionRecord::MAX_REF_BYTES, FrancoError::ReferenceTooLong);
        require!(!ctx.accounts.student.is_frozen, FrancoError::StudentFrozen);

        if ctx.accounts.tx_record.initialized {
            return Ok(());
        }

        let cpi_accounts = TransferChecked {
            from: ctx.accounts.student_ata.to_account_info(),
            mint: ctx.accounts.usdc_mint.to_account_info(),
            to: ctx.accounts.treasury_token_account.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token::transfer_checked(cpi_ctx, amount, ctx.accounts.usdc_mint.decimals)?;

        let student = &mut ctx.accounts.student;
        student.total_volume = student
            .total_volume
            .checked_add(amount)
            .ok_or(FrancoError::MathOverflow)?;

        let tx_record = &mut ctx.accounts.tx_record;
        tx_record.initialized = true;
        tx_record.sender = student.owner;
        tx_record.receiver = ctx.accounts.treasury.key();
        tx_record.amount = amount;
        tx_record.timestamp = Clock::get()?.unix_timestamp;
        tx_record.kotani_reference = kotani_reference.clone();
        tx_record.fraud_score = 0;
        tx_record.is_flagged = false;
        tx_record.bump = ctx.bumps.tx_record;

        emit!(OffRampSettled {
            student: student.owner,
            amount,
            reference: kotani_reference,
            timestamp: tx_record.timestamp,
        });

        Ok(())
    }

    pub fn update_fraud_score(ctx: Context<UpdateFraudScore>, reference_hash: [u8; 32], reference: String, score: u8) -> Result<()> {
        require!(hash(reference.as_bytes()).to_bytes() == reference_hash, FrancoError::ReferenceHashMismatch);
        require!(reference.as_bytes().len() > 0, FrancoError::InvalidReference);
        require!(reference.as_bytes().len() <= TransactionRecord::MAX_REF_BYTES, FrancoError::ReferenceTooLong);

        let tx_record = &mut ctx.accounts.tx_record;
        tx_record.fraud_score = score;

        if score > 75 {
            tx_record.is_flagged = true;
            ctx.accounts.student.flagged = true;

            emit!(FraudFlagged {
                student: ctx.accounts.student.owner,
                amount: tx_record.amount,
                reference: tx_record.kotani_reference.clone(),
                score,
                timestamp: Clock::get()?.unix_timestamp,
            });
        }

        Ok(())
    }

    pub fn freeze_student(ctx: Context<FreezeStudent>) -> Result<()> {
        let student = &mut ctx.accounts.student;
        student.is_frozen = true;

        emit!(StudentFrozen {
            student: student.owner,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        seeds = [b"treasury"],
        bump,
        space = 8 + TreasuryAccount::MAX_SIZE
    )]
    pub treasury: Account<'info, TreasuryAccount>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = usdc_mint,
        associated_token::authority = treasury
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct RegisterStudent<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        seeds = [b"student", owner.key().as_ref()],
        bump,
        space = 8 + StudentAccount::MAX_SIZE
    )]
    pub student: Account<'info, StudentAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(reference_hash: [u8; 32])]
pub struct SettleOnramp<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"treasury"],
        bump,
        has_one = authority @ FrancoError::Unauthorized,
        has_one = usdc_mint @ FrancoError::InvalidMint,
        constraint = treasury.treasury_token_account == treasury_token_account.key() @ FrancoError::InvalidTreasuryTokenAccount
    )]
    pub treasury: Box<Account<'info, TreasuryAccount>>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub treasury_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"student", student_owner.key().as_ref()],
        bump,
        constraint = student.owner == student_owner.key() @ FrancoError::InvalidStudentOwner
    )]
    pub student: Box<Account<'info, StudentAccount>>,

    /// CHECK: Used only as a PDA seed + receiver key; validated against student.owner.
    pub student_owner: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = usdc_mint,
        associated_token::authority = student_owner
    )]
    pub student_ata: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = authority,
        seeds = [b"tx", reference_hash.as_ref()],
        bump,
        space = 8 + TransactionRecord::MAX_SIZE
    )]
    pub tx_record: Box<Account<'info, TransactionRecord>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(reference_hash: [u8; 32])]
pub struct SendUsdc<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"student", sender.key().as_ref()],
        bump,
        constraint = sender_student.owner == sender.key() @ FrancoError::Unauthorized
    )]
    pub sender_student: Box<Account<'info, StudentAccount>>,

    #[account(
        mut,
        constraint = sender_ata.mint == usdc_mint.key() @ FrancoError::InvalidMint,
        constraint = sender_ata.owner == sender.key() @ FrancoError::Unauthorized
    )]
    pub sender_ata: Box<Account<'info, TokenAccount>>,

    /// CHECK: receiver wallet
    pub receiver: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"student", receiver.key().as_ref()],
        bump,
        constraint = receiver_student.owner == receiver.key() @ FrancoError::InvalidStudentOwner
    )]
    pub receiver_student: Box<Account<'info, StudentAccount>>,

    #[account(
        init_if_needed,
        payer = sender,
        associated_token::mint = usdc_mint,
        associated_token::authority = receiver
    )]
    pub receiver_ata: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = sender,
        seeds = [b"tx", reference_hash.as_ref()],
        bump,
        space = 8 + TransactionRecord::MAX_SIZE
    )]
    pub tx_record: Box<Account<'info, TransactionRecord>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(reference_hash: [u8; 32])]
pub struct SettleOfframp<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"treasury"],
        bump,
        has_one = usdc_mint @ FrancoError::InvalidMint,
        constraint = treasury.treasury_token_account == treasury_token_account.key() @ FrancoError::InvalidTreasuryTokenAccount
    )]
    pub treasury: Account<'info, TreasuryAccount>,

    #[account(mut)]
    pub treasury_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"student", owner.key().as_ref()],
        bump,
        has_one = owner @ FrancoError::Unauthorized
    )]
    pub student: Account<'info, StudentAccount>,

    #[account(
        mut,
        constraint = student_ata.mint == usdc_mint.key() @ FrancoError::InvalidMint,
        constraint = student_ata.owner == owner.key() @ FrancoError::Unauthorized
    )]
    pub student_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = owner,
        seeds = [b"tx", reference_hash.as_ref()],
        bump,
        space = 8 + TransactionRecord::MAX_SIZE
    )]
    pub tx_record: Account<'info, TransactionRecord>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(reference_hash: [u8; 32])]
pub struct UpdateFraudScore<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"treasury"],
        bump,
        has_one = authority @ FrancoError::Unauthorized
    )]
    pub treasury: Account<'info, TreasuryAccount>,

    #[account(
        mut,
        seeds = [b"tx", reference_hash.as_ref()],
        bump,
    )]
    pub tx_record: Account<'info, TransactionRecord>,

    #[account(
        mut,
        seeds = [b"student", student.owner.as_ref()],
        bump
    )]
    pub student: Account<'info, StudentAccount>,
}

#[derive(Accounts)]
pub struct FreezeStudent<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"treasury"],
        bump,
        has_one = authority @ FrancoError::Unauthorized
    )]
    pub treasury: Account<'info, TreasuryAccount>,

    #[account(
        mut,
        seeds = [b"student", student.owner.as_ref()],
        bump
    )]
    pub student: Account<'info, StudentAccount>,
}

#[account]
pub struct StudentAccount {
    pub owner: Pubkey,
    pub country: String,
    pub is_frozen: bool,
    pub total_volume: u64,
    pub flagged: bool,
    pub bump: u8,
}

impl StudentAccount {
    pub const MAX_SIZE: usize =
        32 + (4 + 32) + 1 + 8 + 1 + 1; // owner + country + is_frozen + total_volume + flagged + bump
}

#[account]
pub struct TreasuryAccount {
    pub authority: Pubkey,
    pub usdc_mint: Pubkey,
    pub treasury_token_account: Pubkey,
    pub fee_bps: u16,
    pub bump: u8,
}

impl TreasuryAccount {
    pub const MAX_SIZE: usize = 32 + 32 + 32 + 2 + 1;
}

#[account]
pub struct TransactionRecord {
    pub initialized: bool,
    pub sender: Pubkey,
    pub receiver: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
    pub kotani_reference: String,
    pub fraud_score: u8,
    pub is_flagged: bool,
    pub bump: u8,
}

impl TransactionRecord {
    pub const MAX_REF_BYTES: usize = 64;
    pub const MAX_SIZE: usize =
        1 + 32 + 32 + 8 + 8 + (4 + Self::MAX_REF_BYTES) + 1 + 1 + 1;
}

#[event]
pub struct StudentRegistered {
    pub owner: Pubkey,
    pub country: String,
    pub timestamp: i64,
}

#[event]
pub struct OnRampSettled {
    pub student: Pubkey,
    pub amount: u64,
    pub reference: String,
    pub timestamp: i64,
}

#[event]
pub struct TransferExecuted {
    pub sender: Pubkey,
    pub receiver: Pubkey,
    pub amount: u64,
    pub reference: String,
    pub timestamp: i64,
}

#[event]
pub struct OffRampSettled {
    pub student: Pubkey,
    pub amount: u64,
    pub reference: String,
    pub timestamp: i64,
}

#[event]
pub struct FraudFlagged {
    pub student: Pubkey,
    pub amount: u64,
    pub reference: String,
    pub score: u8,
    pub timestamp: i64,
}

#[event]
pub struct StudentFrozen {
    pub student: Pubkey,
    pub timestamp: i64,
}

#[error_code]
pub enum FrancoError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Country must be <= 32 bytes")]
    CountryTooLong,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid reference")]
    InvalidReference,
    #[msg("Student is frozen")]
    StudentFrozen,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Invalid fee_bps")]
    InvalidFeeBps,
    #[msg("Invalid mint")]
    InvalidMint,
    #[msg("Invalid treasury token account")]
    InvalidTreasuryTokenAccount,
    #[msg("Invalid student owner")]
    InvalidStudentOwner,
    #[msg("Reference too long")]
    ReferenceTooLong,
    #[msg("Reference hash mismatch")]
    ReferenceHashMismatch,
}

