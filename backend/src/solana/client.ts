import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import fs from "node:fs";
import path from "node:path";

// The IDL will be generated after `anchor build`. For the demo MVP we load it from programs/target.
import idl from "../../../target/idl/franco_student_pay.json" assert { type: "json" };

type FrancoStudentPayIdl = typeof idl;

function loadKeypair(filePath: string): Keypair {
  const secret = JSON.parse(fs.readFileSync(filePath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

export function getSolanaClient() {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  const payerPath =
    process.env.BACKEND_KEYPAIR_PATH ??
    path.join(process.env.HOME ?? ".", ".config/solana/id.json");
  const kp = loadKeypair(payerPath);

  const wallet: Wallet = {
    publicKey: kp.publicKey,
    signAllTransactions: async (txs) =>
      txs.map((tx) => {
        tx.partialSign(kp);
        return tx;
      }),
    signTransaction: async (tx) => {
      tx.partialSign(kp);
      return tx;
    },
  };

  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const programId = new PublicKey(process.env.PROGRAM_ID!);
  const program = new Program<FrancoStudentPayIdl>(idl as FrancoStudentPayIdl, programId, provider);

  const usdcMint = new PublicKey(process.env.USDC_MINT!);

  const treasuryPda = PublicKey.findProgramAddressSync([
    Buffer.from("treasury"),
  ], programId)[0];

  const treasuryAta = getAssociatedTokenAddressSync(usdcMint, treasuryPda, true);

  return {
    async settleOnramp(args: { amount: number; reference: string; studentWallet: string }) {
      const studentOwner = new PublicKey(args.studentWallet);
      const studentPda = PublicKey.findProgramAddressSync(
        [Buffer.from("student"), studentOwner.toBuffer()],
        programId
      )[0];

      const studentAta = getAssociatedTokenAddressSync(usdcMint, studentOwner);

      const sig = await program.methods
        .settleOnramp(BigInt(args.amount), args.reference)
        .accounts({
          authority: kp.publicKey,
          treasury: treasuryPda,
          usdcMint,
          treasuryTokenAccount: treasuryAta,
          student: studentPda,
          studentOwner,
          studentAta,
        })
        .rpc();

      return sig;
    },

    async updateFraudScore(args: { reference: string; score: number; studentWallet: string }) {
      const txPda = PublicKey.findProgramAddressSync(
        [Buffer.from("tx"), referenceSeed(args.reference)],
        programId
      )[0];

      const studentOwner = new PublicKey(args.studentWallet);
      const studentPda = PublicKey.findProgramAddressSync(
        [Buffer.from("student"), studentOwner.toBuffer()],
        programId
      )[0];

      const sig = await program.methods
        .updateFraudScore(args.reference, args.score)
        .accounts({
          authority: kp.publicKey,
          treasury: treasuryPda,
          txRecord: txPda,
          student: studentPda,
        })
        .rpc();
      return sig;
    },
  };
}

function referenceSeed(reference: string): Buffer {
  // Must match on-chain: solana_program::hash(reference)
  // anchor/web3.js doesn't expose the same hash; we use sha256 which matches solana_program::hash.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require("node:crypto") as typeof import("node:crypto");
  return crypto.createHash("sha256").update(Buffer.from(reference)).digest();
}
