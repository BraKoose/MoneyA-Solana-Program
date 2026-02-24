import { Router } from "express";
import { z } from "zod";
import { db } from "../db/schema.js";
import { ensureSchema } from "../db/init.js";
import { getSolanaClient } from "../solana/client.js";
import { scoreTransaction } from "../fraud/engine.js";

export const kotaniRouter = Router();

ensureSchema(db);

const WebhookSchema = z.object({
  amount: z.number().int().positive(),
  reference: z.string().min(1).max(64),
  student_wallet: z.string().min(32),
});

kotaniRouter.post("/webhook", async (req, res) => {
  const parsed = WebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: "invalid_payload",
      details: parsed.error.flatten(),
    });
  }

  const { amount, reference, student_wallet } = parsed.data;

  const existing = db
    .prepare("SELECT reference, status FROM kotani_webhooks WHERE reference = ?")
    .get(reference) as { reference: string; status: string } | undefined;

  if (existing?.status === "processed") {
    return res.status(200).json({ ok: true, idempotent: true });
  }

  // Mark received (idempotency barrier)
  db.prepare(
    "INSERT INTO kotani_webhooks(reference, student_wallet, amount, status, created_at) VALUES(?, ?, ?, ?, strftime('%s','now'))\n     ON CONFLICT(reference) DO UPDATE SET student_wallet=excluded.student_wallet, amount=excluded.amount"
  ).run(reference, student_wallet, amount, "received");

  // Kotani API call (mocked). Must succeed even if offline.
  const kotaniOk = await tryKotaniOrSimulate(reference);

  try {
    const client = getSolanaClient();

    // Ensure student is registered off-chain expectation: backend can optionally auto-register.
    // For demo resilience, we do not auto-register on-chain here; demo script registers explicitly.

    const sig = await client.settleOnramp({
      amount,
      reference,
      studentWallet: student_wallet,
    });

    db.prepare(
      "INSERT INTO transactions(reference, direction, student_wallet, amount, solana_signature, kotani_ok, created_at) VALUES(?, ?, ?, ?, ?, ?, strftime('%s','now'))"
    ).run(reference, "onramp", student_wallet, amount, sig, kotaniOk ? 1 : 0);

    const fraudScore = scoreTransaction({
      amount,
      reference,
      studentWallet: student_wallet,
      direction: "onramp",
    });

    db.prepare(
      "UPDATE transactions SET fraud_score = ? WHERE reference = ?"
    ).run(fraudScore, reference);

    if (fraudScore > 75) {
      await client.updateFraudScore({ reference, score: fraudScore, studentWallet: student_wallet });
    }

    db.prepare(
      "UPDATE kotani_webhooks SET status = 'processed', processed_at = strftime('%s','now') WHERE reference = ?"
    ).run(reference);

    return res.status(200).json({
      ok: true,
      kotani_ok: kotaniOk,
      solana_signature: sig,
      fraud_score: fraudScore,
    });
  } catch (e: unknown) {
    req.log.error({ err: e, reference }, "webhook processing failed");
    db.prepare(
      "UPDATE kotani_webhooks SET status = 'failed', error = ?, processed_at = strftime('%s','now') WHERE reference = ?"
    ).run(String(e), reference);

    return res.status(500).json({ ok: false, error: "processing_failed" });
  }
});

async function tryKotaniOrSimulate(reference: string): Promise<boolean> {
  const mode = (process.env.KOTANI_MODE ?? "simulate").toLowerCase();
  if (mode === "simulate") return true;

  // If a real endpoint is configured, attempt it but do not fail the pipeline.
  const url = process.env.KOTANI_MOCK_URL;
  if (!url) return false;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reference }),
    });
    return res.ok;
  } catch {
    return true;
  }
}
