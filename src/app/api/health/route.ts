import { dataKey } from "@/lib/server/crypto";
import { getDb } from "@/lib/server/db";
import { json } from "@/lib/server/http";

/** Deployment self-check: reports whether the database and encryption key work. Reveals no secrets or user data. */
export const dynamic = "force-dynamic";
export async function GET() {
  const check = (fn: () => void) => { try { fn(); return "ok"; } catch (e) { return (e as Error).name === "ConfigError" ? (e as Error).message : "error"; } };
  const database = check(() => { getDb().prepare("SELECT 1").get(); });
  const encryptionKey = check(() => { dataKey(); });
  const ok = database === "ok" && encryptionKey === "ok";
  return json({ ok, database, encryptionKey, node: process.version, ocrService: process.env.OCR_SERVICE_URL ? "configured" : "not configured" }, ok ? 200 : 503);
}
