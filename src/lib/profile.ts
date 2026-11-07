/* Health profile model + strict validation. Used on the server (to sanitise input) and in the client. */
import { ALLERGENS, type AllergenId } from "./ingredients/allergens";
import { DIET_PATTERNS, type DietPattern } from "./ingredients/diet";
import { NUTRIENT_KEYS, type NutrientKey } from "./types";

export const AGE_RANGES = ["18-29", "30-44", "45-59", "60+", "prefer-not"] as const;
export const ACTIVITY = ["sedentary", "moderate", "active", "prefer-not"] as const;
export const LANGS = ["en", "hi", "ta"] as const;
export const CONDITIONS = ["diabetes", "prediabetes", "hypertension", "high-cholesterol", "kidney", "cardiovascular", "coeliac"] as const;
export const INTOLERANCES = ["lactose", "gluten-sensitivity"] as const;
export const GOALS = ["reduce-sodium", "reduce-sugar", "reduce-satfat", "monitor-carbs", "more-protein", "more-fibre", "manage-energy"] as const;

export type AgeRange = (typeof AGE_RANGES)[number];
export type Activity = (typeof ACTIVITY)[number];
export type Lang = (typeof LANGS)[number];
export type ConditionId = (typeof CONDITIONS)[number];
export type IntoleranceId = (typeof INTOLERANCES)[number];
export type GoalId = (typeof GOALS)[number];

export const CONDITION_LABEL: Record<ConditionId, string> = {
  diabetes: "Diabetes",
  prediabetes: "Prediabetes",
  hypertension: "High blood pressure",
  "high-cholesterol": "High cholesterol",
  kidney: "Kidney disease",
  cardiovascular: "Heart / cardiovascular condition",
  coeliac: "Coeliac disease",
};
export const INTOLERANCE_LABEL: Record<IntoleranceId, string> = { lactose: "Lactose intolerance", "gluten-sensitivity": "Gluten sensitivity (non-coeliac)" };
export const GOAL_LABEL: Record<GoalId, string> = {
  "reduce-sodium": "Reduce sodium / salt",
  "reduce-sugar": "Reduce added sugar",
  "reduce-satfat": "Reduce saturated fat",
  "monitor-carbs": "Monitor carbohydrates",
  "more-protein": "Get more protein",
  "more-fibre": "Get more fibre",
  "manage-energy": "Manage calories",
};

export const LIMIT_NUTRIENTS: NutrientKey[] = ["sodiumMg", "addedSugarG", "sugarsG", "carbohydratesG", "saturatedFatG", "totalFatG", "energyKcal", "proteinG", "transFatG"];

export interface NutrientLimit {
  id: string;
  nutrient: NutrientKey;
  amount: number;
  per: "portion" | "day";
  /** true only when the user says a doctor/dietitian advised it — FoodDecode never invents these */
  clinicianAdvised: boolean;
  note?: string;
}

export interface HealthProfile {
  version: 1;
  ageRange: AgeRange | null;
  activity: Activity | null;
  language: Lang;
  diet: { pattern: DietPattern; customAvoid: string[] };
  allergies: { items: AllergenId[]; custom: string[] };
  intolerances: { items: IntoleranceId[]; custom: string[] };
  conditions: { items: ConditionId[]; custom: string[]; preferNotToDisclose: boolean };
  goals: GoalId[];
  limits: NutrientLimit[];
  notes: string;
}

export function emptyProfile(): HealthProfile {
  return {
    version: 1,
    ageRange: null,
    activity: null,
    language: "en",
    diet: { pattern: "none", customAvoid: [] },
    allergies: { items: [], custom: [] },
    intolerances: { items: [], custom: [] },
    conditions: { items: [], custom: [], preferNotToDisclose: false },
    goals: [],
    limits: [],
    notes: "",
  };
}

/* ---------------- validation (server-side source of truth) ---------------- */

export class ProfileValidationError extends Error {
  constructor(public issues: string[]) {
    super("Invalid profile: " + issues.join("; "));
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
function pick<T extends readonly string[]>(list: T, v: unknown, field: string, issues: string[], nullable = true): T[number] | null {
  if (v == null || v === "") return nullable ? null : (issues.push(`${field} is required`), null);
  if (typeof v === "string" && (list as readonly string[]).includes(v)) return v as T[number];
  issues.push(`${field} has an unsupported value`);
  return null;
}
function pickMany<T extends readonly string[]>(list: T, v: unknown, field: string, issues: string[]): T[number][] {
  if (v == null) return [];
  if (!Array.isArray(v)) return issues.push(`${field} must be a list`), [];
  const out: T[number][] = [];
  for (const x of v) {
    if (typeof x === "string" && (list as readonly string[]).includes(x)) {
      if (!out.includes(x)) out.push(x);
    } else issues.push(`${field} contains an unsupported value`);
  }
  return out;
}
function texts(v: unknown, field: string, issues: string[], max = 12, maxLen = 60): string[] {
  if (v == null) return [];
  if (!Array.isArray(v)) return issues.push(`${field} must be a list`), [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string") { issues.push(`${field} must contain text`); continue; }
    const t = x.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, maxLen);
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  if (out.length > max) issues.push(`${field} has too many entries (max ${max})`);
  return out.slice(0, max);
}

export function validateProfile(input: unknown): HealthProfile {
  const issues: string[] = [];
  if (!isObj(input)) throw new ProfileValidationError(["profile must be an object"]);
  const p = emptyProfile();
  p.ageRange = pick(AGE_RANGES, input.ageRange, "ageRange", issues);
  p.activity = pick(ACTIVITY, input.activity, "activity", issues);
  p.language = (pick(LANGS, input.language ?? "en", "language", issues) as Lang) || "en";
  const diet = isObj(input.diet) ? input.diet : {};
  p.diet.pattern = (pick(DIET_PATTERNS, diet.pattern ?? "none", "diet.pattern", issues) as DietPattern) || "none";
  p.diet.customAvoid = texts(diet.customAvoid, "diet.customAvoid", issues);
  const al = isObj(input.allergies) ? input.allergies : {};
  p.allergies.items = pickMany(ALLERGENS, al.items, "allergies.items", issues);
  p.allergies.custom = texts(al.custom, "allergies.custom", issues);
  const it = isObj(input.intolerances) ? input.intolerances : {};
  p.intolerances.items = pickMany(INTOLERANCES, it.items, "intolerances.items", issues);
  p.intolerances.custom = texts(it.custom, "intolerances.custom", issues);
  const co = isObj(input.conditions) ? input.conditions : {};
  p.conditions.preferNotToDisclose = co.preferNotToDisclose === true;
  p.conditions.items = p.conditions.preferNotToDisclose ? [] : pickMany(CONDITIONS, co.items, "conditions.items", issues);
  p.conditions.custom = p.conditions.preferNotToDisclose ? [] : texts(co.custom, "conditions.custom", issues);
  p.goals = pickMany(GOALS, input.goals, "goals", issues);
  if (input.limits != null) {
    if (!Array.isArray(input.limits)) issues.push("limits must be a list");
    else {
      if (input.limits.length > 12) issues.push("too many limits (max 12)");
      for (const l of input.limits.slice(0, 12)) {
        if (!isObj(l)) { issues.push("limit must be an object"); continue; }
        const nutrient = l.nutrient as NutrientKey;
        const amount = typeof l.amount === "number" ? l.amount : Number(l.amount);
        if (!(NUTRIENT_KEYS as readonly string[]).includes(nutrient) || !LIMIT_NUTRIENTS.includes(nutrient)) { issues.push("limit nutrient unsupported"); continue; }
        if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) { issues.push("limit amount must be a positive number"); continue; }
        if (l.per !== "portion" && l.per !== "day") { issues.push("limit period must be 'portion' or 'day'"); continue; }
        p.limits.push({
          id: typeof l.id === "string" && /^[a-z0-9-]{1,40}$/i.test(l.id) ? l.id : `lim-${p.limits.length + 1}`,
          nutrient,
          amount,
          per: l.per,
          clinicianAdvised: l.clinicianAdvised === true,
          note: typeof l.note === "string" ? l.note.replace(/[<>]/g, "").slice(0, 200) : undefined,
        });
      }
    }
  }
  p.notes = typeof input.notes === "string" ? input.notes.replace(/[\u0000-\u0008]/g, "").slice(0, 2000) : "";
  if (issues.length) throw new ProfileValidationError(issues);
  return p;
}

export function profileIsEmpty(p: HealthProfile): boolean {
  return (
    p.diet.pattern === "none" &&
    !p.diet.customAvoid.length &&
    !p.allergies.items.length &&
    !p.allergies.custom.length &&
    !p.intolerances.items.length &&
    !p.intolerances.custom.length &&
    !p.conditions.items.length &&
    !p.conditions.custom.length &&
    !p.goals.length &&
    !p.limits.length
  );
}
