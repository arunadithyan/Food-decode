/*
 * SQLite access via Node's built-in node:sqlite (no native build step). Server-only.
 * Migrations in db/migrations/*.sql are applied in filename order on first use.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";

type Stmt = { run: (...a: unknown[]) => unknown; get: (...a: unknown[]) => unknown; all: (...a: unknown[]) => unknown[] };
export interface DB {
  exec: (sql: string) => void;
  prepare: (sql: string) => Stmt;
  close: () => void;
}

const g = globalThis as unknown as { __fdDb?: DB };

function root() {
  return process.env.FD_PROJECT_ROOT || process.cwd();
}

export function dbPath(): string {
  return process.env.FD_DB_PATH || path.join(root(), ".data", "fooddecode.db");
}

export function getDb(): DB {
  if (g.__fdDb) return g.__fdDb;
  // Loaded at runtime (Node >= 22.3) so the bundler leaves the built-in module alone.
  const { DatabaseSync } = (process as unknown as { getBuiltinModule(id: string): unknown }).getBuiltinModule("node:sqlite") as { DatabaseSync: new (p: string) => DB };
  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  migrate(db);
  g.__fdDb = db;
  return db;
}

function migrate(db: DB) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const dir = path.join(root(), "db", "migrations");
  const done = new Set((db.prepare("SELECT name FROM schema_migrations").all() as { name: string }[]).map((r) => r.name));
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    if (done.has(f)) continue;
    db.exec("BEGIN");
    try {
      db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
      db.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)").run(f, new Date().toISOString());
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}

export function tx<T>(fn: (db: DB) => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn(db);
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
