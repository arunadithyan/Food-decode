/*
 * Food diary: what the user ate, day by day. Pure functions (no I/O) shared by the browser, the server and tests.
 * Targets come from, in order: the user's own target, a per-day limit in their health profile (clinician-advised
 * or self-set), else the FSSAI label reference value. Reference values are general, not personal advice.
 */
import { DAILY_REFERENCE } from "./nutrition/reference";
import { forPortion } from "./nutrition/calc";
import type { HealthProfile } from "./profile";
import { NUTRIENT_KEYS, NUTRIENT_LABEL, NUTRIENT_UNIT, type NutrientKey, type Product } from "./types";

export const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type Meal = (typeof MEALS)[number];
export const MEAL_LABEL: Record<Meal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };

export type EntryUnit = "g" | "ml" | "serving" | "piece";
export type EntryNutrients = Partial<Record<NutrientKey, number | null>>;

export interface DiaryEntryInput {
  day: string; // YYYY-MM-DD, the user's local date
  meal: Meal;
  time?: string; // HH:MM
  source: "product" | "manual";
  productId?: string;
  name: string;
  brand?: string;
  amount: number;
  unit: EntryUnit;
  nutrients: EntryNutrients;
}
export interface DiaryEntry extends DiaryEntryInput { id: string; createdAt: string }
export interface DiarySettings { energyTargetKcal: number | null }

/** Nutrients shown on the intake screen. */
export const TRACKED: NutrientKey[] = ["energyKcal", "proteinG", "carbohydratesG", "addedSugarG", "sodiumMg", "saturatedFatG", "fibreG"];
/** Nutrients where the target is an upper limit ("up to"); the others are "at least" (protein, fibre) or shown for information (carbs). */
export const LIMIT_KEYS: NutrientKey[] = ["addedSugarG", "sodiumMg", "saturatedFatG"];
const AT_LEAST: Partial<Record<NutrientKey, { value: number; source: string }>> = {
  proteinG: { value: 50, source: "ICMR-NIN adult reference (≈46–54 g)" },
  fibreG: { value: 30, source: "general adult reference" },
};

/* ---------------- dates (plain YYYY-MM-DD strings, no time zones involved) ---------------- */
export const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
export function addDays(day: string, n: number): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function localToday(now = new Date()): string {
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, "0"), d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
export function mealForTime(now = new Date()): Meal {
  const h = now.getHours();
  return h >= 5 && h < 11 ? "breakfast" : h >= 11 && h < 16 ? "lunch" : h >= 19 || h < 2 ? "dinner" : "snack";
}

/* ---------------- entries ---------------- */
/** Builds a diary entry from a product and the portion eaten (amount in the product's own unit). */
export function entryFromProduct(p: Product, amount: number, day: string, meal: Meal, time?: string): DiaryEntryInput {
  const n = forPortion(p.nutrition, amount);
  const nutrients: EntryNutrients = {};
  for (const k of NUTRIENT_KEYS) nutrients[k] = n[k] == null ? null : Math.round(n[k]! * 10) / 10;
  return { day, meal, time, source: "product", productId: p.id, name: p.name, brand: p.brand, amount: Math.round(amount * 10) / 10, unit: p.unit, nutrients };
}

export class DiaryValidationError extends Error {
  constructor(public issues: string[]) {
    super("Invalid diary entry");
  }
}

const NUTRIENT_MAX: Record<NutrientKey, number> = { energyKcal: 10000, proteinG: 1000, carbohydratesG: 2000, sugarsG: 1000, addedSugarG: 1000, totalFatG: 1000, saturatedFatG: 1000, transFatG: 100, sodiumMg: 50000, fibreG: 500 };

/** Strict check for entries arriving at the server (also used by tests). */
export function validateEntry(raw: unknown, today: string): DiaryEntryInput {
  const issues: string[] = [];
  if (!raw || typeof raw !== "object") throw new DiaryValidationError(["Entry must be an object"]);
  const r = raw as Record<string, unknown>;
  const day = r.day;
  if (!isDay(day)) issues.push("day must be YYYY-MM-DD");
  else if (day > addDays(today, 1) || day < addDays(today, -366)) issues.push("day must be within the last year");
  const meal = MEALS.includes(r.meal as Meal) ? (r.meal as Meal) : null;
  if (!meal) issues.push("meal is not valid");
  const time = typeof r.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.time) ? r.time : undefined;
  const source = r.source === "product" ? "product" : r.source === "manual" ? "manual" : null;
  if (!source) issues.push("source is not valid");
  const name = typeof r.name === "string" ? r.name.replace(/[<>]/g, "").trim().slice(0, 120) : "";
  if (!name) issues.push("name is required");
  const brand = typeof r.brand === "string" ? r.brand.replace(/[<>]/g, "").trim().slice(0, 80) || undefined : undefined;
  const productId = typeof r.productId === "string" && /^[a-z0-9-]{1,80}$/.test(r.productId) ? r.productId : undefined;
  const amount = typeof r.amount === "number" && Number.isFinite(r.amount) && r.amount > 0 && r.amount <= 5000 ? r.amount : null;
  if (amount == null) issues.push("amount must be between 0 and 5000");
  const unit = (["g", "ml", "serving", "piece"] as EntryUnit[]).includes(r.unit as EntryUnit) ? (r.unit as EntryUnit) : null;
  if (!unit) issues.push("unit is not valid");
  const nutrients: EntryNutrients = {};
  const rn = (r.nutrients && typeof r.nutrients === "object" ? r.nutrients : {}) as Record<string, unknown>;
  for (const k of NUTRIENT_KEYS) {
    const v = rn[k];
    if (v == null || v === "") { nutrients[k] = null; continue; }
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > NUTRIENT_MAX[k]) issues.push(`${NUTRIENT_LABEL[k]} is out of range`);
    else nutrients[k] = Math.round(v * 10) / 10;
  }
  if (nutrients.energyKcal == null) issues.push("Calories (kcal) are required");
  if (issues.length) throw new DiaryValidationError(issues);
  return { day: day as string, meal: meal!, time, source: source!, productId, name, brand, amount: amount!, unit: unit!, nutrients };
}

/* ---------------- targets ---------------- */
export interface Target { key: NutrientKey; value: number; kind: "limit" | "at-least" | "goal"; basis: "own" | "clinician" | "self-set" | "reference"; source: string }

export function targetsFor(profile: HealthProfile | null, settings: DiarySettings | null): Partial<Record<NutrientKey, Target>> {
  const out: Partial<Record<NutrientKey, Target>> = {};
  const dayLimit = (k: NutrientKey) => profile?.limits.filter((l) => l.nutrient === k && l.per === "day").sort((a, b) => Number(b.clinicianAdvised) - Number(a.clinicianAdvised))[0];
  // energy
  const el = dayLimit("energyKcal");
  if (settings?.energyTargetKcal) out.energyKcal = { key: "energyKcal", value: settings.energyTargetKcal, kind: "goal", basis: "own", source: "Your own daily target" };
  else if (el) out.energyKcal = { key: "energyKcal", value: el.amount, kind: "goal", basis: el.clinicianAdvised ? "clinician" : "self-set", source: el.clinicianAdvised ? "Limit from your doctor or dietitian (profile)" : "Your limit (profile)" };
  else out.energyKcal = { key: "energyKcal", value: DAILY_REFERENCE.energyKcal!.value, kind: "goal", basis: "reference", source: "FSSAI label reference for an average adult — not a personal target" };
  for (const k of LIMIT_KEYS) {
    const l = dayLimit(k);
    if (l) out[k] = { key: k, value: l.amount, kind: "limit", basis: l.clinicianAdvised ? "clinician" : "self-set", source: l.clinicianAdvised ? "Limit from your doctor or dietitian (profile)" : "Your limit (profile)" };
    else if (DAILY_REFERENCE[k]) out[k] = { key: k, value: DAILY_REFERENCE[k]!.value, kind: "limit", basis: "reference", source: DAILY_REFERENCE[k]!.source };
  }
  for (const [k, v] of Object.entries(AT_LEAST) as [NutrientKey, { value: number; source: string }][]) out[k] = { key: k, value: v.value, kind: "at-least", basis: "reference", source: v.source };
  return out;
}

/* ---------------- totals & status ---------------- */
export interface DayTotals { day: string; count: number; totals: Record<NutrientKey, number>; missing: Record<NutrientKey, number> }

export function dayTotals(day: string, entries: DiaryEntry[]): DayTotals {
  const totals = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0])) as Record<NutrientKey, number>;
  const missing = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0])) as Record<NutrientKey, number>;
  const mine = entries.filter((e) => e.day === day);
  for (const e of mine) for (const k of NUTRIENT_KEYS) {
    const v = e.nutrients[k];
    if (v == null) missing[k]++;
    else totals[k] += v;
  }
  for (const k of NUTRIENT_KEYS) totals[k] = Math.round(totals[k] * 10) / 10;
  return { day, count: mine.length, totals, missing };
}

/** Energy band that counts as "on track": 80–110% of the calorie target. */
export const ON_TRACK_BAND = { low: 0.8, high: 1.1 };

export interface DayStatus { logged: boolean; energyPct: number | null; onTrack: boolean; overLimits: NutrientKey[]; reason: string }
export function dayStatus(t: DayTotals, targets: Partial<Record<NutrientKey, Target>>): DayStatus {
  if (!t.count) return { logged: false, energyPct: null, onTrack: false, overLimits: [], reason: "Nothing logged" };
  const et = targets.energyKcal!;
  const pct = t.totals.energyKcal / et.value;
  const overLimits = LIMIT_KEYS.filter((k) => targets[k] && t.totals[k] > targets[k]!.value);
  const inBand = pct >= ON_TRACK_BAND.low && pct <= ON_TRACK_BAND.high;
  const onTrack = inBand && overLimits.length === 0;
  const reason = onTrack ? "Calories within 80–110% of target and no daily limit passed"
    : !inBand ? (pct < ON_TRACK_BAND.low ? "Below 80% of the calorie target (or not everything was logged)" : "Above 110% of the calorie target")
    : `Over the daily limit for ${overLimits.map((k) => NUTRIENT_LABEL[k].toLowerCase()).join(", ")}`;
  return { logged: true, energyPct: pct, onTrack, overLimits, reason };
}

export interface Streaks { logging: number; onTrack: number; bestOnTrack: number; todayCounts: boolean }
/**
 * Streaks count back from today. Today is still in progress, so if today does not (yet) qualify the streak
 * counts from yesterday instead of breaking.
 */
export function streaks(entries: DiaryEntry[], targets: Partial<Record<NutrientKey, Target>>, today: string, lookback = 366): Streaks {
  const byDay = new Map<string, DiaryEntry[]>();
  for (const e of entries) byDay.set(e.day, [...(byDay.get(e.day) || []), e]);
  const status = (d: string) => dayStatus(dayTotals(d, byDay.get(d) || []), targets);
  const run = (test: (s: DayStatus) => boolean) => {
    let start = today;
    if (!test(status(today))) start = addDays(today, -1);
    let n = 0;
    for (let d = start; n < lookback && test(status(d)); d = addDays(d, -1)) n++;
    return n;
  };
  let best = 0, cur = 0;
  const days = [...byDay.keys()].sort();
  if (days.length) for (let d = days[0]; d <= today; d = addDays(d, 1)) {
    cur = status(d).onTrack ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return { logging: run((s) => s.logged), onTrack: run((s) => s.onTrack), bestOnTrack: best, todayCounts: status(today).onTrack };
}

export function fmtTarget(t: Target): string {
  return `${t.kind === "limit" ? "up to " : t.kind === "at-least" ? "at least " : ""}${t.value} ${NUTRIENT_UNIT[t.key]}`;
}
