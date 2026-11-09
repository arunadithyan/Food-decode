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
  const { saveProfile, setConsent, addScan, listScans, addFood, listFood } = await import("../src/lib/server/repo");
  const { addDays } = await import("../src/lib/diary");
  const today = new Date().toISOString().slice(0, 10);
  // Synthetic diary: four earlier days that are "on track" for a 2,000 kcal reference, plus a breakfast today.
  const diaryDays: { offset: number; items: [string, "breakfast" | "lunch" | "dinner" | "snack", number, number][] }[] = [
    { offset: -4, items: [["Poha with peanuts", "breakfast", 350, 380], ["Rice, dal and sabzi", "lunch", 650, 520], ["Masala chai", "snack", 120, 40], ["2 chapatis with paneer curry", "dinner", 620, 480]] },
    { offset: -3, items: [["Idli (3) with sambar", "breakfast", 330, 420], ["Veg thali", "lunch", 720, 560], ["Fruit bowl", "snack", 150, 5], ["Khichdi with curd", "dinner", 480, 390]] },
    { offset: -2, items: [["Upma", "breakfast", 300, 410], ["Rajma chawal", "lunch", 640, 480], ["Roasted chana", "snack", 160, 120], ["Chapatis with dal", "dinner", 560, 400]] },
    { offset: -1, items: [["Oats with milk", "breakfast", 320, 120], ["Curd rice and poriyal", "lunch", 600, 450], ["Banana", "snack", 105, 1], ["Vegetable pulao with raita", "dinner", 650, 520]] },
    { offset: 0, items: [["Dosa with chutney", "breakfast", 380, 430]] },
  ];
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
    if (d.username === "demo.general" || d.username === "demo.bp") {
      setConsent(id, "food_log", true);
      if (listFood(id, addDays(today, -30), addDays(today, 1)).length === 0)
        for (const dd of diaryDays) for (const [name, meal, kcal, sodium] of dd.items)
          addFood(id, { day: addDays(today, dd.offset), meal, source: "manual", name, amount: 1, unit: "serving", nutrients: { energyKcal: kcal, sodiumMg: sodium } });
    }
    console.log(`${row ? "Updated" : "Created"} demo account ${d.username}`);
  }
  console.log(`\nDemo password for all accounts: ${DEMO_PASSWORD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
