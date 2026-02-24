import "dotenv/config";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  transfer,
} from "@solana/spl-token";
import fs from "node:fs";
import path from "node:path";
import type { Transaction } from "@solana/web3.js";

function loadKeypair(filePath: string): Keypair {
  const secret = JSON.parse(fs.readFileSync(filePath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

async function main() {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  const payerPath =
    process.env.BACKEND_KEYPAIR_PATH ??
    path.join(process.env.HOME ?? ".", ".config/solana/id.json");
  const payer = loadKeypair(payerPath);

  const programId = new PublicKey(process.env.PROGRAM_ID!);
  const usdcMint = new PublicKey(process.env.USDC_MINT!);

  const wallet: Wallet = {
    publicKey: payer.publicKey,
    signAllTransactions: async (txs: Transaction[]) =>
      txs.map((tx: Transaction) => {
        tx.partialSign(payer);
        return tx;
      }),
    signTransaction: async (tx: Transaction) => {
      tx.partialSign(payer);
      return tx;
    },
  };

  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });

  const idlPath = path.resolve(process.cwd(), "target/idl/franco_student_pay.json");
  if (!fs.existsSync(idlPath)) {
    throw new Error(`IDL not found at ${idlPath}. Run 'anchor build' at repo root first.`);
  }
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8")) as unknown;
  const program = new Program(idl as never, programId, provider);

  const treasuryPda = PublicKey.findProgramAddressSync([Buffer.from("treasury")], programId)[0];
  const treasuryAta = getAssociatedTokenAddressSync(usdcMint, treasuryPda, true);

  const feeBps = 50; // 0.50%

  await program.methods
    .initializeTreasury(feeBps)
    .accounts({
      authority: payer.publicKey,
      usdcMint,
      treasury: treasuryPda,
      treasuryTokenAccount: treasuryAta,
    })
    .rpc();

  // Fund treasury from payer ATA (assumes payer holds minted demo USDC)
  const payerAta = await getOrCreateAssociatedTokenAccount(connection, payer, usdcMint, payer.publicKey);

  const fundAmount = BigInt(10_000) * BigInt(10 ** 6);
  await transfer(connection, payer, payerAta.address, treasuryAta, payer.publicKey, fundAmount);

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      rpcUrl,
      programId: programId.toBase58(),
      treasuryPda: treasuryPda.toBase58(),
      treasuryAta: treasuryAta.toBase58(),
      fundedBaseUnits: fundAmount.toString(),
    })
  );
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
