/*
 * Runs a TypeScript script with tsx, with the "react-server" condition so server-only modules load.
 * Resolves tsx to an absolute file:// URL, which works on Windows, macOS and Linux.
 *   node scripts/run-ts.mjs scripts/seed.ts
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const loader = path.join(root, "node_modules", "tsx", "dist", "loader.mjs");
if (!fs.existsSync(loader)) {
  console.error("\nDependencies are not installed (node_modules/tsx is missing).");
  console.error("Run `npm install` in this folder, wait until it finishes without errors, then try again.\n");
  process.exit(1);
}
const [script, ...args] = process.argv.slice(2);
const r = spawnSync(process.execPath, ["--conditions=react-server", "--import", pathToFileURL(loader).href, path.resolve(root, script), ...args], { cwd: root, stdio: "inherit" });
process.exit(r.status ?? 1);
