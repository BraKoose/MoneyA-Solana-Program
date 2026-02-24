import Database from "better-sqlite3";

const dbPath = process.env.SQLITE_PATH ?? "./moneya.sqlite";

export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
