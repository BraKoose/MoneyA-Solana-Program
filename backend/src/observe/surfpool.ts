import "dotenv/config";
import { BorshCoder, EventParser } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import fs from "node:fs";
import path from "node:path";

const programId = new PublicKey(process.env.PROGRAM_ID!);
const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const connection = new Connection(rpcUrl, "confirmed");

const idlPath = path.resolve(process.cwd(), "../target/idl/franco_student_pay.json");
if (!fs.existsSync(idlPath)) {
  throw new Error(`IDL not found at ${idlPath}. Run 'anchor build' at repo root first.`);
}

const idl = JSON.parse(fs.readFileSync(idlPath, "utf8")) as unknown;

const coder = new BorshCoder(idl as never);
const parser = new EventParser(programId, coder);

// eslint-disable-next-line no-console
console.log(JSON.stringify({ service: "surfpool-subscriber", programId: programId.toBase58(), rpcUrl }));

connection.onLogs(
  programId,
  (logs: { logs: string[] }) => {
    for (const ev of parser.parseLogs(logs.logs)) {
      // Standardized structured JSON for indexing
      const payload = normalizeEvent(ev.name, ev.data);
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(payload));
    }
  },
  "confirmed"
);

function normalizeEvent(name: string, data: Record<string, unknown>) {
  const base = {
    type: name,
    timestamp: (data.timestamp as number | undefined) ?? null,
  };

  switch (name) {
    case "StudentRegistered":
      return {
        ...base,
        owner: String(data.owner),
        country: String(data.country),
      };
    case "OnRampSettled":
      return {
        ...base,
        student: String(data.student),
        amount: Number(data.amount),
        reference: String(data.reference),
        flagged: false,
      };
    case "TransferExecuted":
      return {
        ...base,
        sender: String(data.sender),
        receiver: String(data.receiver),
        amount: Number(data.amount),
        reference: String(data.reference),
      };
    case "OffRampSettled":
      return {
        ...base,
        student: String(data.student),
        amount: Number(data.amount),
        reference: String(data.reference),
      };
    case "FraudFlagged":
      return {
        ...base,
        student: String(data.student),
        amount: Number(data.amount),
        reference: String(data.reference),
        score: Number(data.score),
        flagged: true,
      };
    case "StudentFrozen":
      return {
        ...base,
        student: String(data.student),
      };
    default:
      return { ...base, data };
  }
}
