type Direction = "onramp" | "offramp" | "transfer";

export function scoreTransaction(input: {
  amount: number;
  reference: string;
  studentWallet: string;
  direction: Direction;
}): number {
  // Deterministic RAG-like scoring:
  // - We compute a simple embedding vector from stable features.
  // - Compare against a fixed suspicious pattern store.
  // - Combine with rule-based heuristics.
  const features = embed(input);
  const maxSim = suspiciousPatterns().reduce((acc, p) => Math.max(acc, cosine(features, p.vec)), 0);

  let score = Math.round(maxSim * 60);

  // Rule: round-number anomalies (in USDC base units assumed by backend: integer)
  if (input.amount % 1_000_000 === 0) score += 10;

  // Rule: volume spike buckets
  if (input.amount >= 5_000_000_000) score += 35; // 5,000 USDC
  else if (input.amount >= 1_000_000_000) score += 20; // 1,000 USDC

  // Rule: reference entropy low (repeated chars)
  if (/^(.)\1{7,}$/.test(input.reference)) score += 20;

  // Clamp
  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return score;
}

function embed(input: { amount: number; reference: string; studentWallet: string; direction: string }): number[] {
  const a = Math.log10(Math.max(1, input.amount));
  const r = stableHash01(input.reference);
  const w = stableHash01(input.studentWallet);
  const d = input.direction === "onramp" ? 0.2 : input.direction === "offramp" ? 0.6 : 1.0;

  // 4D embedding
  return [a / 10, r, w, d];
}

function suspiciousPatterns(): Array<{ name: string; vec: number[] }> {
  return [
    { name: "large_round_onramp", vec: [0.9, 0.2, 0.2, 0.2] },
    { name: "replay_reference", vec: [0.2, 0.95, 0.1, 0.2] },
    { name: "wallet_hotspot", vec: [0.2, 0.2, 0.95, 0.2] },
    { name: "transfer_churn", vec: [0.6, 0.2, 0.2, 1.0] },
  ];
}

function cosine(a: number[], b: number[]): number {
  const dot = a.reduce((acc, v, i) => acc + v * b[i]!, 0);
  const na = Math.sqrt(a.reduce((acc, v) => acc + v * v, 0));
  const nb = Math.sqrt(b.reduce((acc, v) => acc + v * v, 0));
  if (na === 0 || nb === 0) return 0;
  return dot / (na * nb);
}

function stableHash01(s: string): number {
  // FNV-1a 32-bit => [0,1)
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // >>> 0 to uint32
  return ((h >>> 0) % 10_000) / 10_000;
}
