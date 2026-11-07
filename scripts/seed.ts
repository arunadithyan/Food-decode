/*
 * Creates the synthetic demo accounts (idempotent). These are fictional people — no real health data.
 *   npm run seed            (runs with --conditions=react-server so server modules load outside Next.js)
 */
import path from "node:path";
import { loadEnv } from "./env.mjs";

const root = path.resolve(__dirname, "..");
loadEnv(root);
process.env.FD_PROJECT_ROOT ??= root;

export const DEMO_PASSWORD = "FoodDecode-demo-2026";

export const DEMO_USERS = [
  { username: "demo.general", history: true, summary: "Demo profile: no restrictions", profile: {} },
  { username: "demo.diabetes", history: true, summary: "Demo profile: diabetes, monitoring carbs", profile: { diet: { pattern: "vegetarian" }, conditions: { items: ["diabetes"] }, goals: ["monitor-carbs", "reduce-sugar"] } },
  { username: "demo.peanut", history: true, summary: "Demo profile: peanut allergy", profile: { allergies: { items: ["peanut", "tree-nuts"] } } },
  { username: "demo.bp", history: true, summary: "Demo profile: high blood pressure, reducing sodium", profile: { conditions: { items: ["hypertension"] }, goals: ["reduce-sodium"], limits: [{ id: "lim-sodium-day", nutrient: "sodiumMg", amount: 1500, per: "day", clinicianAdvised: true, note: "Synthetic example of a clinician-advised daily limit" }] } },
  { username: "demo.jain", history: false, summary: "Demo profile: Jain diet, lactose intolerance", profile: { diet: { pattern: "jain" }, intolerances: { items: ["lactose"] } } },
] as const;

async function main() {
  const { getDb } = await import("../src/lib/server/db");
  const { createUser } = await import("../src/lib/server/auth");
  const { saveProfile, setConsent, addScan, listScans } = await import("../src/lib/server/repo");
  const db = getDb();
  for (const d of DEMO_USERS) {
    const row = db.prepare("SELECT id FROM users WHERE username = ?").get(d.username) as { id: string } | undefined;
    const id = row?.id ?? (await createUser(d.username, DEMO_PASSWORD)).id;
    setConsent(id, "health_data", true);
    setConsent(id, "scan_history", d.history);
    saveProfile(id, d.profile, d.summary);
    if (d.history && listScans(id).length === 0) {
      for (const productId of ["maggi-masala", "haldiram-aloo-bhujia", "oreo"]) addScan(id, { kind: "lookup", productId });
    }
    console.log(`${row ? "Updated" : "Created"} demo account ${d.username}`);
  }
  console.log(`\nDemo password for all accounts: ${DEMO_PASSWORD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
