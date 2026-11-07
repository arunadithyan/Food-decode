/*
 * Encryption at rest (AES-256-GCM) and password hashing (scrypt). Server-only.
 * Ciphertext is bound to the owner and purpose through GCM additional authenticated data, so a row
 * copied to another user (or another table) fails to decrypt.
 */
import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

let cachedKey: Buffer | null = null;

export function dataKey(): Buffer {
  if (cachedKey) return cachedKey;
  const env = process.env.FD_DATA_KEY;
  if (env) {
    const k = Buffer.from(env, "base64");
    if (k.length !== 32) throw new Error("FD_DATA_KEY must be 32 bytes, base64-encoded (run `npm run setup`).");
    cachedKey = k;
    return k;
  }
  if (process.env.NODE_ENV === "production") throw new Error("FD_DATA_KEY is not set. Run `npm run setup` or set it in the environment.");
  // Development convenience only: a local key file, never committed.
  const file = path.join(process.env.FD_PROJECT_ROOT || process.cwd(), ".data", "dev-data-key");
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString("base64"), { mode: 0o600 });
  cachedKey = Buffer.from(fs.readFileSync(file, "utf8").trim(), "base64");
  console.warn("[fooddecode] FD_DATA_KEY not set — using a development key file in .data/. Do not use this in production.");
  return cachedKey;
}

export function encryptJSON(value: unknown, aad: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dataKey(), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return "v1." + Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptJSON<T>(blob: string, aad: string): T {
  if (!blob.startsWith("v1.")) throw new Error("Unsupported ciphertext version");
  const buf = Buffer.from(blob.slice(3), "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", dataKey(), buf.subarray(0, 12));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(buf.subarray(12, 28));
  const pt = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
  return JSON.parse(pt.toString("utf8")) as T;
}

/* ---------------- passwords ---------------- */
const N = 16384, R = 8, P = 1, KEYLEN = 64;

export function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  return new Promise((res, rej) =>
    crypto.scrypt(pw, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }, (err, dk) =>
      err ? rej(err) : res(`scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${dk.toString("base64")}`),
    ),
  );
}

export function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, saltB64, hashB64] = stored.split("$");
  if (alg !== "scrypt") return Promise.resolve(false);
  const expected = Buffer.from(hashB64, "base64");
  return new Promise((res) =>
    crypto.scrypt(pw, Buffer.from(saltB64, "base64"), expected.length, { N: +n, r: +r, p: +p, maxmem: 64 * 1024 * 1024 }, (err, dk) =>
      res(!err && dk.length === expected.length && crypto.timingSafeEqual(dk, expected)),
    ),
  );
}

export const newId = () => crypto.randomUUID();
export const newToken = () => crypto.randomBytes(32).toString("base64url");
export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
