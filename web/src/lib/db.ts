import "server-only";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

// The analytics database is produced by the Python pipeline (`vitals sync`).
// The site only reads it. Set VITALS_DB to point somewhere else.
const DB_PATH =
  process.env.VITALS_DB ?? path.resolve(process.cwd(), "..", "data", "vitals.db");

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!db) {
    try {
      db = new DatabaseSync(DB_PATH, { readOnly: true });
    } catch (e) {
      throw new Error(`Cannot open ${DB_PATH}. Run \`uv run vitals sync\` in the project root, or set VITALS_DB. (${String(e)})`);
    }
  }
  return db;
}

export function all<T>(sql: string, params: Array<string | number | null> = []): T[] {
  // node:sqlite rows have a null prototype; spread them so they can cross the server/client boundary.
  return (getDb().prepare(sql).all(...params) as object[]).map((r) => ({ ...r })) as T[];
}

export function one<T>(sql: string, params: Array<string | number | null> = []): T | undefined {
  const r = getDb().prepare(sql).get(...params) as object | undefined;
  return r ? ({ ...r } as T) : undefined;
}

