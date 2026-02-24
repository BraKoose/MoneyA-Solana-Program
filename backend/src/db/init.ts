import type Database from "better-sqlite3";

export function ensureSchema(db: Database.Database): void {
  db.exec(
    `
    CREATE TABLE IF NOT EXISTS kotani_webhooks (
      reference TEXT PRIMARY KEY,
      student_wallet TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at INTEGER NOT NULL,
      processed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT NOT NULL UNIQUE,
      direction TEXT NOT NULL,
      student_wallet TEXT NOT NULL,
      amount INTEGER NOT NULL,
      solana_signature TEXT,
      kotani_ok INTEGER NOT NULL,
      fraud_score INTEGER,
      created_at INTEGER NOT NULL
    );
    `
  );
}
