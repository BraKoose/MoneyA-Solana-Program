import "dotenv/config";
import { Connection, Keypair } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import fs from "node:fs";
import path from "node:path";

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

  const decimals = 6;

  const mint = await createMint(connection, payer, payer.publicKey, null, decimals);

  const payerAta = await getOrCreateAssociatedTokenAccount(connection, payer, mint, payer.publicKey);

  // Mint 50,000 USDC (devnet demo liquidity)
  const amount = BigInt(50_000) * BigInt(10 ** decimals);
  await mintTo(connection, payer, mint, payerAta.address, payer, amount);

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      rpcUrl,
      usdcMint: mint.toBase58(),
      payerAta: payerAta.address.toBase58(),
      mintedBaseUnits: amount.toString(),
      decimals,
    })
  );
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
