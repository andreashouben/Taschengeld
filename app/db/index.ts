import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const sqlite = new Database(process.env.DATABASE_PATH ?? "database.sqlite");
export const db = drizzle(sqlite, { schema });

// Schema beim ersten Start anlegen
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS children (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    weekly_rate REAL NOT NULL,
    start_date TEXT NOT NULL,
    start_balance REAL NOT NULL DEFAULT 0,
    payout_day INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL REFERENCES children(id),
    amount REAL NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migration: payout_day für bestehende Datenbanken ergänzen
try {
  sqlite.exec(`ALTER TABLE children ADD COLUMN payout_day INTEGER NOT NULL DEFAULT 1`);
} catch { /* Spalte existiert bereits */ }
