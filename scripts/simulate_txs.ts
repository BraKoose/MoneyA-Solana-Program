/**
 * simulate_txs.ts — End-to-end Devnet simulation
 *
 * What this does:
 *   1. Creates a fake USDC mint (6 decimals)
 *   2. Initializes the on-chain treasury + funds it
 *   3. Creates UserA and UserB keypairs
 *   4. Registers both as students on-chain
 *   5. On-ramps USDC from treasury → UserA (simulates Kotani webhook)
 *   6. UserA sends USDC → UserB (peer-to-peer transfer)
 *   7. Fetches and prints all on-chain accounts for verification
 *
 * Run:  npx tsx scripts/simulate_txs.ts
 */

import { AnchorProvider, Program } from "@coral-xyz/anchor";
import BN from "bn.js";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
} from "@solana/spl-token";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ─── Config ──────────────────────────────────────────────────────────────────

const RPC_URL = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("BBZjnEN1JFj7caLdBMeXCvBAbntAi3Hd2Z9pxQ78zMJV");
const USDC_DECIMALS = 6;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadKeypair(filePath: string): Keypair {
  const resolved = filePath.replace("~", process.env.HOME ?? ".");
  const secret = JSON.parse(fs.readFileSync(resolved, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function referenceHash(reference: string): number[] {
  // Must match on-chain: solana_program::hash::hash (SHA-256)
  const hash = createHash("sha256").update(Buffer.from(reference)).digest();
  return Array.from(hash);
}

function usdcAmount(human: number): bigint {
  return BigInt(Math.round(human * 10 ** USDC_DECIMALS));
}

function formatUsdc(baseUnits: bigint | number | BN): string {
  const n = typeof baseUnits === "bigint" ? baseUnits : BigInt(baseUnits.toString());
  const whole = n / BigInt(10 ** USDC_DECIMALS);
  const frac = (n % BigInt(10 ** USDC_DECIMALS)).toString().padStart(USDC_DECIMALS, "0");
  return `${whole}.${frac} USDC`;
}

function explorerUrl(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

function log(label: string, msg: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${"═".repeat(60)}`);
  console.log(`  ${msg}`);
}

async function airdropIfNeeded(connection: Connection, pubkey: PublicKey, label: string) {
  const bal = await connection.getBalance(pubkey);
  if (bal < 0.05 * LAMPORTS_PER_SOL) {
    console.log(`  ⏳ Airdropping 0.1 SOL to ${label} (${pubkey.toBase58()})...`);
    try {
      const sig = await connection.requestAirdrop(pubkey, 0.1 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, "confirmed");
      console.log(`  ✅ Airdrop confirmed for ${label}`);
    } catch {
      console.log(`  ⚠️  Airdrop failed for ${label} — transfer SOL manually if needed`);
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");

  // Load the deployer/authority keypair
  const payerPath = process.env.BACKEND_KEYPAIR_PATH ?? "~/.config/solana/id.json";
  const payer = loadKeypair(payerPath);
  console.log(`\n🔑 Authority / Payer: ${payer.publicKey.toBase58()}`);
  console.log(`   Balance: ${(await connection.getBalance(payer.publicKey)) / LAMPORTS_PER_SOL} SOL`);

  // Load IDL
  const idlPath = path.resolve(process.cwd(), "target/idl/franco_student_pay.json");
  if (!fs.existsSync(idlPath)) {
    throw new Error(`IDL not found at ${idlPath}. Run 'anchor build' first.`);
  }
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));

  // Create provider + program
  const wallet = {
    publicKey: payer.publicKey,
    signAllTransactions: async <T extends { partialSign: (kp: Keypair) => void }>(txs: T[]) =>
      txs.map((tx) => { tx.partialSign(payer); return tx; }),
    signTransaction: async <T extends { partialSign: (kp: Keypair) => void }>(tx: T) => {
      tx.partialSign(payer); return tx;
    },
    payer: payer,
  };
  const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
  const program = new Program(idl as any, provider);

  // ── Step 1: Create fake USDC mint ──────────────────────────────────────

  log("STEP 1", "Creating fake USDC mint on Devnet...");

  const usdcMint = await createMint(connection, payer, payer.publicKey, null, USDC_DECIMALS);
  console.log(`  🪙 USDC Mint: ${usdcMint.toBase58()}`);

  // Mint 50,000 USDC to payer
  const payerAta = await getOrCreateAssociatedTokenAccount(connection, payer, usdcMint, payer.publicKey);
  const mintAmount = usdcAmount(50_000);
  await mintTo(connection, payer, usdcMint, payerAta.address, payer, mintAmount);
  console.log(`  💰 Minted ${formatUsdc(mintAmount)} to payer ATA: ${payerAta.address.toBase58()}`);

  // ── Step 2: Initialize treasury ────────────────────────────────────────

  log("STEP 2", "Initializing on-chain treasury...");

  const [treasuryPda] = PublicKey.findProgramAddressSync([Buffer.from("treasury")], PROGRAM_ID);
  const treasuryAta = getAssociatedTokenAddressSync(usdcMint, treasuryPda, true);

  const feeBps = 50; // 0.50%
  const initSig = await program.methods
    .initializeTreasury(feeBps)
    .accounts({
      authority: payer.publicKey,
      usdcMint,
      treasury: treasuryPda,
      treasuryTokenAccount: treasuryAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();
  console.log(`  🏦 Treasury PDA: ${treasuryPda.toBase58()}`);
  console.log(`  🏦 Treasury ATA: ${treasuryAta.toBase58()}`);
  console.log(`  ✅ TX: ${explorerUrl(initSig)}`);

  // Fund treasury with 10,000 USDC from payer
  const { transfer } = await import("@solana/spl-token");
  const fundAmount = usdcAmount(10_000);
  const fundSig = await transfer(connection, payer, payerAta.address, treasuryAta, payer, fundAmount);
  console.log(`  💵 Funded treasury with ${formatUsdc(fundAmount)}`);
  console.log(`  ✅ TX: ${explorerUrl(fundSig)}`);

  // ── Step 3: Create UserA and UserB ─────────────────────────────────────

  log("STEP 3", "Creating UserA and UserB wallets...");

  const userA = Keypair.generate();
  const userB = Keypair.generate();
  console.log(`  👤 UserA: ${userA.publicKey.toBase58()}`);
  console.log(`  👤 UserB: ${userB.publicKey.toBase58()}`);

  // Fund UserA with SOL for tx fees (transfer from payer since airdrop may be rate-limited)
  const solTransferIx = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: userA.publicKey,
    lamports: 0.1 * LAMPORTS_PER_SOL,
  });
  const solTransferIxB = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: userB.publicKey,
    lamports: 0.05 * LAMPORTS_PER_SOL,
  });

  const { Transaction } = await import("@solana/web3.js");
  const solTx = new Transaction().add(solTransferIx, solTransferIxB);
  solTx.feePayer = payer.publicKey;
  solTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  solTx.sign(payer);
  const solSig = await connection.sendRawTransaction(solTx.serialize());
  await connection.confirmTransaction(solSig, "confirmed");
  console.log(`  💸 Sent 0.1 SOL to UserA, 0.05 SOL to UserB for tx fees`);

  // ── Step 4: Register both students on-chain ────────────────────────────

  log("STEP 4", "Registering UserA and UserB as students...");

  const [studentPdaA] = PublicKey.findProgramAddressSync(
    [Buffer.from("student"), userA.publicKey.toBuffer()], PROGRAM_ID
  );
  const [studentPdaB] = PublicKey.findProgramAddressSync(
    [Buffer.from("student"), userB.publicKey.toBuffer()], PROGRAM_ID
  );

  // UserA registers themselves (they sign)
  const providerA = new AnchorProvider(
    connection,
    {
      publicKey: userA.publicKey,
      signAllTransactions: async (txs: any[]) => txs.map((tx: any) => { tx.partialSign(userA); return tx; }),
      signTransaction: async (tx: any) => { tx.partialSign(userA); return tx; },
    } as any,
    { commitment: "confirmed" }
  );
  const programA = new Program(idl as any, providerA);

  const regASig = await programA.methods
    .registerStudent("Ghana")
    .accounts({
      owner: userA.publicKey,
      student: studentPdaA,
      systemProgram: SystemProgram.programId,
    })
    .signers([userA])
    .rpc();
  console.log(`  ✅ UserA registered (Ghana): ${explorerUrl(regASig)}`);

  // UserB registers themselves
  const providerB = new AnchorProvider(
    connection,
    {
      publicKey: userB.publicKey,
      signAllTransactions: async (txs: any[]) => txs.map((tx: any) => { tx.partialSign(userB); return tx; }),
      signTransaction: async (tx: any) => { tx.partialSign(userB); return tx; },
    } as any,
    { commitment: "confirmed" }
  );
  const programB = new Program(idl as any, providerB);

  const regBSig = await programB.methods
    .registerStudent("Cameroon")
    .accounts({
      owner: userB.publicKey,
      student: studentPdaB,
      systemProgram: SystemProgram.programId,
    })
    .signers([userB])
    .rpc();
  console.log(`  ✅ UserB registered (Cameroon): ${explorerUrl(regBSig)}`);

  // ── Step 5: On-ramp — treasury sends 100 USDC to UserA ────────────────

  log("STEP 5", "On-ramp: Treasury → UserA (100 USDC) via settle_onramp...");

  const onrampRef = "KOT-2024-ONRAMP-001";
  const onrampHash = referenceHash(onrampRef);
  const onrampAmount = new BN(usdcAmount(100).toString());
  const userAata = getAssociatedTokenAddressSync(usdcMint, userA.publicKey);

  const [txRecordOnramp] = PublicKey.findProgramAddressSync(
    [Buffer.from("tx"), Buffer.from(onrampHash)], PROGRAM_ID
  );

  const onrampSig = await program.methods
    .settleOnramp(onrampHash, onrampAmount, onrampRef)
    .accounts({
      authority: payer.publicKey,
      treasury: treasuryPda,
      usdcMint,
      treasuryTokenAccount: treasuryAta,
      student: studentPdaA,
      studentOwner: userA.publicKey,
      studentAta: userAata,
      txRecord: txRecordOnramp,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();
  console.log(`  💰 100 USDC sent from Treasury → UserA`);
  console.log(`  📝 Reference: ${onrampRef}`);
  console.log(`  ✅ TX: ${explorerUrl(onrampSig)}`);

  // ── Step 6: UserA sends 25 USDC to UserB ───────────────────────────────

  log("STEP 6", "Peer transfer: UserA → UserB (25 USDC) via send_usdc...");

  const p2pRef = "P2P-TRANSFER-001";
  const p2pHash = referenceHash(p2pRef);
  const p2pAmount = new BN(usdcAmount(25).toString());
  const userBata = getAssociatedTokenAddressSync(usdcMint, userB.publicKey);

  const [txRecordP2p] = PublicKey.findProgramAddressSync(
    [Buffer.from("tx"), Buffer.from(p2pHash)], PROGRAM_ID
  );

  const p2pSig = await programA.methods
    .sendUsdc(p2pHash, p2pAmount, p2pRef)
    .accounts({
      sender: userA.publicKey,
      usdcMint,
      senderStudent: studentPdaA,
      senderAta: userAata,
      receiver: userB.publicKey,
      receiverStudent: studentPdaB,
      receiverAta: userBata,
      txRecord: txRecordP2p,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .signers([userA])
    .rpc();
  console.log(`  💸 25 USDC sent from UserA → UserB`);
  console.log(`  📝 Reference: ${p2pRef}`);
  console.log(`  ✅ TX: ${explorerUrl(p2pSig)}`);

  // ── Step 7: Verify on-chain state ──────────────────────────────────────

  log("STEP 7", "Fetching on-chain accounts to verify...");

  // Token balances
  const treasuryBal = await getAccount(connection, treasuryAta);
  const userAbal = await getAccount(connection, userAata);
  const userBbal = await getAccount(connection, userBata);

  console.log(`\n  ┌─────────────────────────────────────────────────────┐`);
  console.log(`  │              💰 USDC BALANCES                       │`);
  console.log(`  ├─────────────────────────────────────────────────────┤`);
  console.log(`  │  Treasury : ${formatUsdc(treasuryBal.amount).padEnd(20)} (started with 10,000)  │`);
  console.log(`  │  UserA    : ${formatUsdc(userAbal.amount).padEnd(20)} (got 100, sent 25)    │`);
  console.log(`  │  UserB    : ${formatUsdc(userBbal.amount).padEnd(20)} (received 25)         │`);
  console.log(`  └─────────────────────────────────────────────────────┘`);

  // Student PDA accounts
  const studentDataA = await program.account.studentAccount.fetch(studentPdaA);
  const studentDataB = await program.account.studentAccount.fetch(studentPdaB);

  console.log(`\n  ┌─────────────────────────────────────────────────────┐`);
  console.log(`  │              👤 STUDENT ACCOUNTS (on-chain)         │`);
  console.log(`  ├─────────────────────────────────────────────────────┤`);
  console.log(`  │  UserA:                                             │`);
  console.log(`  │    Owner   : ${(studentDataA.owner as PublicKey).toBase58().slice(0, 20)}...       │`);
  console.log(`  │    Country : ${String(studentDataA.country).padEnd(20)}                │`);
  console.log(`  │    Volume  : ${formatUsdc(studentDataA.totalVolume as BN).padEnd(20)}                │`);
  console.log(`  │    Frozen  : ${String(studentDataA.isFrozen).padEnd(20)}                │`);
  console.log(`  │  UserB:                                             │`);
  console.log(`  │    Owner   : ${(studentDataB.owner as PublicKey).toBase58().slice(0, 20)}...       │`);
  console.log(`  │    Country : ${String(studentDataB.country).padEnd(20)}                │`);
  console.log(`  │    Volume  : ${formatUsdc(studentDataB.totalVolume as BN).padEnd(20)}                │`);
  console.log(`  │    Frozen  : ${String(studentDataB.isFrozen).padEnd(20)}                │`);
  console.log(`  └─────────────────────────────────────────────────────┘`);

  // Transaction records
  const txOnramp = await program.account.transactionRecord.fetch(txRecordOnramp);
  const txP2p = await program.account.transactionRecord.fetch(txRecordP2p);

  console.log(`\n  ┌─────────────────────────────────────────────────────┐`);
  console.log(`  │              📜 TRANSACTION RECORDS (on-chain)      │`);
  console.log(`  ├─────────────────────────────────────────────────────┤`);
  console.log(`  │  On-ramp (Treasury → UserA):                        │`);
  console.log(`  │    Reference : ${String(txOnramp.kotaniReference).padEnd(30)}     │`);
  console.log(`  │    Amount    : ${formatUsdc(txOnramp.amount as BN).padEnd(30)}     │`);
  console.log(`  │    Sender    : ${(txOnramp.sender as PublicKey).toBase58().slice(0, 20)}...           │`);
  console.log(`  │    Receiver  : ${(txOnramp.receiver as PublicKey).toBase58().slice(0, 20)}...           │`);
  console.log(`  │    Flagged   : ${String(txOnramp.isFlagged).padEnd(30)}     │`);
  console.log(`  │                                                     │`);
  console.log(`  │  P2P Transfer (UserA → UserB):                      │`);
  console.log(`  │    Reference : ${String(txP2p.kotaniReference).padEnd(30)}     │`);
  console.log(`  │    Amount    : ${formatUsdc(txP2p.amount as BN).padEnd(30)}     │`);
  console.log(`  │    Sender    : ${(txP2p.sender as PublicKey).toBase58().slice(0, 20)}...           │`);
  console.log(`  │    Receiver  : ${(txP2p.receiver as PublicKey).toBase58().slice(0, 20)}...           │`);
  console.log(`  │    Flagged   : ${String(txP2p.isFlagged).padEnd(30)}     │`);
  console.log(`  └─────────────────────────────────────────────────────┘`);

  // ── Summary ────────────────────────────────────────────────────────────

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  🎉 SIMULATION COMPLETE — All transactions on Devnet!`);
  console.log(`${"═".repeat(60)}`);
  console.log(`\n  View on Solana Explorer:`);
  console.log(`    Treasury init : ${explorerUrl(initSig)}`);
  console.log(`    On-ramp       : ${explorerUrl(onrampSig)}`);
  console.log(`    P2P transfer  : ${explorerUrl(p2pSig)}`);
  console.log(`\n  Program ID: ${PROGRAM_ID.toBase58()}`);
  console.log(`  USDC Mint : ${usdcMint.toBase58()}`);
  console.log(`  UserA     : ${userA.publicKey.toBase58()}`);
  console.log(`  UserB     : ${userB.publicKey.toBase58()}`);
  console.log();
}

main().catch((e) => {
  console.error("\n❌ Simulation failed:\n", e);
  process.exit(1);
});
