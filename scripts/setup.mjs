/*
 * One-time local setup: checks Node, creates .env.local with a fresh encryption key, creates the database
 * and adds the synthetic demo accounts.   npm run setup
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [maj, min] = process.versions.node.split(".").map(Number);
if (maj < 22 || (maj === 22 && min < 13)) {
  console.error(`FoodDecode needs Node.js 22.13 or newer (for the built-in node:sqlite). You have ${process.version}.`);
  process.exit(1);
}
if (!fs.existsSync(path.join(root, "node_modules", "next")) || !fs.existsSync(path.join(root, "node_modules", "tsx"))) {
  console.error("Dependencies are not installed. Run `npm install` first and wait until it finishes without errors.");
  process.exit(1);
}
const envFile = path.join(root, ".env.local");
if (!fs.existsSync(envFile)) {
  const key = crypto.randomBytes(32).toString("base64");
  fs.writeFileSync(envFile, [
    "# Created by npm run setup. Keep this file private — FD_DATA_KEY decrypts stored health profiles.",
    `FD_DATA_KEY=${key}`,
    "# Self-hosted OCR service (optional): see services/ocr-server/README.md",
    "OCR_SERVICE_URL=",
    "OCR_SERVICE_TOKEN=",
    "OFF_ENABLED=1",
    "",
  ].join("\n"), { mode: 0o600 });
  console.log("Created .env.local with a new FD_DATA_KEY.");
} else console.log(".env.local already exists — keeping it.");

const r = spawnSync(process.execPath, [path.join(root, "scripts/run-ts.mjs"), "scripts/seed.ts"], { cwd: root, stdio: "inherit" });
process.exit(r.status ?? 1);
