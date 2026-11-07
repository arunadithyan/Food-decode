/*
 * FoodDecode Personal Suitability Engine — deterministic, auditable, no AI.
 *
 * Input:  product (per-100 nutrition + ingredients + provenance) × portion × health profile
 * Output: YES | NO | CAUTION with prioritised, explainable findings.
 *
 * Priority (applied and reported in this order):
 *   1 confirmed allergen conflicts       (+ possible / cross-contact / unknown allergen information)
 *   2 dietary restriction conflicts      (diet pattern, custom avoid list, intolerances, coeliac)
 *   3 clinician-advised limits           (only values the user entered as clinician advice) and conditions that need clinical advice
 *   4 nutrition goals & condition-linked focus nutrients (general-population references)
 *   5 portion-adjusted nutrition facts   (information)
 *   6 missing data and uncertainty
 *
 * Status: any NO → NO; else any CAUTION → CAUTION; else YES. Unknown information never yields YES for
 * the thing it is unknown about. See docs/RECOMMENDATION-ENGINE.md.
 */
import { ALLERGEN_LABEL, checkAllergen, checkCustomTerm, type AllergenId } from "../ingredients/allergens";
import { checkDiet, DIET_LABEL } from "../ingredients/diet";
import { allCodes } from "../ingredients/parse";
import { energyCheck, fmt, forPortion, per100Band, servingsIn, unitOf } from "../nutrition/calc";
import { DAILY_REFERENCE, PER100_BAND_SOURCE, PORTION_HIGH_SHARE, sodiumMgToSaltG } from "../nutrition/reference";
import { CONDITION_LABEL, GOAL_LABEL, INTOLERANCE_LABEL, type HealthProfile, type NutrientLimit, profileIsEmpty } from "../profile";
import { NUTRIENT_LABEL, NUTRIENT_UNIT, type NutrientKey, type Product } from "../types";

export type Status = "YES" | "NO" | "CAUTION";
export type Level = "NO" | "CAUTION" | "INFO" | "OK";
export type Priority = 1 | 2 | 3 | 4 | 5 | 6;

export interface Evidence { label: string; value: string }
export interface Finding {
  id: string;
  priority: Priority;
  level: Level;
  title: string;
  detail: string;
  evidence: Evidence[];
  /** human-readable rule that produced this finding */
  rule: string;
  /** reference / source behind the rule */
  source: string;
  action?: string;
  /** nutrients this finding is about — used to choose alternatives */
  nutrients?: NutrientKey[];
  /** allergen / diet keys this finding is about */
  tags?: string[];
}

export interface Assessment {
  status: Status;
  headline: string;
  findings: Finding[];
  portion: { amount: number; unit: "g" | "ml"; servings: number | null };
  confidence: { level: "high" | "medium" | "low"; reasons: string[] };
  considered: string[];
  emptyProfile: boolean;
}

const PRIORITY_NAME: Record<Priority, string> = {
  1: "Allergens",
  2: "Dietary restrictions",
  3: "Clinician-advised limits",
  4: "Your nutrition goals",
  5: "Portion facts",
  6: "Missing information",
};
export const priorityName = (p: Priority) => PRIORITY_NAME[p];

const pct = (x: number) => `${Math.round(x * 100)}%`;
const qty = (k: NutrientKey, v: number) => `${fmt(v, NUTRIENT_UNIT[k] === "g" ? (v < 1 ? 2 : 1) : 0)} ${NUTRIENT_UNIT[k]}`;

export function assess(product: Product, profile: HealthProfile, amount: number): Assessment {
  const unit = unitOf(product);
  const n = product.nutrition;
  const portion = forPortion(n, amount);
  const servings = servingsIn(product, amount);
  const amtTxt = `${fmt(amount)} ${unit}${servings != null ? ` (${fmt(servings, servings < 10 ? 1 : 0)} serving${Math.abs(servings - 1) < 0.02 ? "" : "s"})` : ""}`;
  const F: Finding[] = [];
  const considered: string[] = [];
  const hasIngredients = !!(product.ingredientsText || product.allergenStatement);

  /* ---------- P1: allergens ---------- */
  for (const a of profile.allergies.items) {
    considered.push(`${ALLERGEN_LABEL[a]} allergy`);
    F.push(allergenFinding(a, product));
  }
  for (const c of profile.allergies.custom) {
    considered.push(`${c} allergy`);
    const r = checkCustomTerm(c, product.ingredientsText, product.allergenStatement);
    F.push(customFinding(1, `allergy-${c}`, c, r.kind, "allergy", product));
  }

  /* ---------- P2: diet, avoid list, intolerances, coeliac ---------- */
  if (profile.diet.pattern !== "none" && profile.diet.pattern !== "non-vegetarian") {
    const label = DIET_LABEL[profile.diet.pattern];
    const lname = profile.diet.pattern === "jain" ? "Jain" : label.toLowerCase();
    considered.push(`${label} diet`);
    const d = checkDiet(profile.diet.pattern, product.ingredientsText, product.allergenStatement);
    const base = { id: `diet-${profile.diet.pattern}`, priority: 2 as Priority, rule: `Ingredient list checked against a ${lname} pattern (keyword rules in lib/ingredients/diet.ts).`, source: "FoodDecode diet rules; FSSAI veg/non-veg symbol is the legal indicator on the pack.", tags: ["diet"] };
    if (d.verdict === "conflict")
      F.push({ ...base, level: "NO", title: `This product lists ${d.matches.slice(0, 3).join(", ")}, which conflicts with your ${lname} preference.`, detail: d.reasons.join(" "), evidence: d.matches.map((m) => ({ label: "Found on label", value: m })), action: "Look for a product that fits your diet; see alternatives below." });
    else if (d.verdict === "uncertain")
      F.push({ ...base, level: "CAUTION", title: `Some ingredients may not fit your ${lname} preference.`, detail: d.reasons.join(" "), evidence: d.matches.map((m) => ({ label: "Source not stated", value: m })), action: "Check the green/brown symbol and the brand's information before eating." });
    else if (d.verdict === "unknown")
      F.push({ ...base, level: "CAUTION", title: `FoodDecode can't check this against your ${lname} preference.`, detail: d.reasons.join(" "), evidence: [], action: "Read the ingredient list on the pack, or scan it." });
    else F.push({ ...base, level: "OK", title: `No ingredients that conflict with a ${lname} diet were found.`, detail: "Based on the listed ingredients. Check the pack's veg symbol too.", evidence: [] });
  }
  for (const t of profile.diet.customAvoid) {
    considered.push(`Avoiding ${t}`);
    const r = checkCustomTerm(t, product.ingredientsText, product.allergenStatement);
    F.push(customFinding(2, `avoid-${t}`, t, r.kind, "avoid", product));
  }
  for (const i of profile.intolerances.items) {
    considered.push(INTOLERANCE_LABEL[i]);
    const allergen: AllergenId = i === "lactose" ? "milk" : "gluten";
    const r = checkAllergen(allergen, product.ingredientsText, product.allergenStatement);
    const what = i === "lactose" ? "milk ingredients" : "gluten-containing ingredients";
    const base = { id: `intol-${i}`, priority: 2 as Priority, rule: `Ingredient list checked for ${what} because your profile records ${INTOLERANCE_LABEL[i].toLowerCase()}.`, source: "FoodDecode allergen term list (lib/ingredients/allergens.ts)", tags: [allergen] };
    if (r.kind === "confirmed") F.push({ ...base, level: "CAUTION", title: `Contains ${r.matches.join(", ")}, relevant to your ${INTOLERANCE_LABEL[i].toLowerCase()}.`, detail: `How much is tolerated differs between people, and the label doesn't state the ${i === "lactose" ? "lactose" : "gluten"} content.`, evidence: r.matches.map((m) => ({ label: `In ${r.where.join(" and ")}`, value: m })), action: "Decide based on what you usually tolerate." });
    else if (r.kind === "unknown") F.push({ ...base, level: "CAUTION", title: `No ingredient list available to check for ${what}.`, detail: "Missing ingredient information is not proof that they are absent.", evidence: [], action: "Check the pack's ingredient list." });
    else if (r.kind !== "none") F.push({ ...base, level: "INFO", title: `Possible ${what}: ${r.matches.join(", ")}.`, detail: r.why || "Precautionary statement on the label.", evidence: r.matches.map((m) => ({ label: r.where.join(", "), value: m })) });
    else F.push({ ...base, level: "OK", title: `No ${what} listed.`, detail: "", evidence: [] });
  }
  for (const t of profile.intolerances.custom) {
    considered.push(`${t} intolerance`);
    const r = checkCustomTerm(t, product.ingredientsText, product.allergenStatement);
    F.push(customFinding(2, `intol-${t}`, t, r.kind, "intolerance", product));
  }
  if (profile.conditions.items.includes("coeliac")) {
    considered.push("Coeliac disease (strict gluten avoidance)");
    const r = checkAllergen("gluten", product.ingredientsText, product.allergenStatement);
    const base = { id: "coeliac", priority: 2 as Priority, rule: "Coeliac disease requires strict avoidance of gluten (wheat, barley, rye and their derivatives).", source: "General coeliac dietary guidance; gluten term list in lib/ingredients/allergens.ts", tags: ["gluten"] };
    if (r.kind === "confirmed") F.push({ ...base, level: "NO", title: `Lists ${r.matches.join(", ")}, which contains gluten.`, detail: "Your profile records coeliac disease.", evidence: r.matches.map((m) => ({ label: `In ${r.where.join(" and ")}`, value: m })), action: "Choose a product labelled gluten-free." });
    else if (r.kind === "possible" || r.kind === "cross-contact") F.push({ ...base, level: "CAUTION", title: `Possible gluten: ${r.matches.join(", ")}.`, detail: r.why || "The label carries a precautionary statement.", evidence: r.matches.map((m) => ({ label: r.where.join(", "), value: m })), action: "Prefer products certified gluten-free." });
    else if (r.kind === "unknown") F.push({ ...base, level: "CAUTION", title: "No ingredient list available to check for gluten.", detail: "Missing information is not proof the product is gluten-free.", evidence: [], action: "Check the pack for a gluten-free claim." });
    else F.push({ ...base, level: "OK", title: "No gluten-containing ingredients listed.", detail: "This is not the same as a certified gluten-free claim.", evidence: [] });
  }

  /* ---------- P3: clinician-advised limits; conditions needing clinical advice ---------- */
  for (const l of profile.limits.filter((x) => x.clinicianAdvised)) {
    considered.push(`Clinician-advised ${NUTRIENT_LABEL[l.nutrient].toLowerCase()} limit`);
    F.push(limitFinding(l, product, portion, amtTxt, 3));
  }
  if (profile.conditions.items.includes("kidney")) {
    considered.push(CONDITION_LABEL.kidney);
    const phosphates = allCodes(product.ingredientsText).filter((c) => /^(338|339|340|341|343|450|451|452|542)/.test(c));
    const k508 = allCodes(product.ingredientsText).some((c) => c.startsWith("508"));
    const ev: Evidence[] = [];
    if (portion.sodiumMg != null) ev.push({ label: "Sodium in this portion", value: qty("sodiumMg", portion.sodiumMg) });
    if (portion.proteinG != null) ev.push({ label: "Protein in this portion", value: qty("proteinG", portion.proteinG) });
    if (phosphates.length) ev.push({ label: "Phosphate additives listed", value: phosphates.map((c) => `INS ${c}`).join(", ") });
    if (k508) ev.push({ label: "Potassium salt listed", value: "INS 508 (potassium chloride)" });
    F.push({
      id: "kidney", priority: 3, level: "CAUTION",
      title: "Kidney-related diets are individual; this depends on your clinician's advice.",
      detail: "Potassium and phosphorus are usually not on Indian labels, so FoodDecode can't assess them. " + (profile.limits.some((x) => x.clinicianAdvised) ? "Your clinician-advised limits are checked above." : "Add limits your doctor or dietitian gave you to your profile, and FoodDecode will check them."),
      evidence: ev, rule: "Any product → CAUTION when the profile records kidney disease, because suitability depends on individual clinical limits.", source: "FoodDecode safety rule (no condition-specific thresholds are assumed)", action: "Follow your renal dietitian's advice.", nutrients: ["sodiumMg", "proteinG"],
    });
  }

  /* ---------- P4: goals & condition-linked focus nutrients ---------- */
  const reasonsFor = (goal: string, conds: string[]) => {
    const r: string[] = [];
    if (profile.goals.includes(goal as never)) r.push(`your “${GOAL_LABEL[goal as keyof typeof GOAL_LABEL]}” goal`);
    for (const c of conds) if (profile.conditions.items.includes(c as never)) r.push(`your recorded ${CONDITION_LABEL[c as keyof typeof CONDITION_LABEL].toLowerCase()}`);
    return r;
  };
  const focus: { key: NutrientKey; why: string[]; label: string }[] = [];
  const sodiumWhy = reasonsFor("reduce-sodium", ["hypertension", "cardiovascular"]);
  if (sodiumWhy.length) focus.push({ key: "sodiumMg", why: sodiumWhy, label: "sodium" });
  const sugarWhy = reasonsFor("reduce-sugar", ["diabetes", "prediabetes"]);
  if (sugarWhy.length) focus.push({ key: "addedSugarG", why: sugarWhy, label: "added sugar" });
  const satWhy = reasonsFor("reduce-satfat", ["high-cholesterol", "cardiovascular"]);
  if (satWhy.length) focus.push({ key: "saturatedFatG", why: satWhy, label: "saturated fat" });
  for (const f of focus) {
    considered.push(`${f.label} (${f.why.join(", ")})`);
    F.push(focusFinding(f.key, f.why, product, portion, amount));
  }
  if (satWhy.length && portion.transFatG != null && portion.transFatG > 0) {
    const share = portion.transFatG / 2;
    F.push({
      id: "trans", priority: 4, level: share >= PORTION_HIGH_SHARE ? "CAUTION" : "INFO",
      title: `${amtTxt} has ${qty("transFatG", portion.transFatG)} trans fat (${pct(share)} of the 2 g daily reference).`,
      detail: "Trans fat is best kept as low as possible.", evidence: [{ label: "Trans fat per 100 " + unit, value: qty("transFatG", n.transFatG!) }],
      rule: "Trans fat ≥20% of the daily reference in one portion → CAUTION when a fat-related goal or condition is recorded.", source: DAILY_REFERENCE.transFatG!.source, nutrients: ["transFatG"],
    });
  }
  const diabetic = profile.conditions.items.some((c) => c === "diabetes" || c === "prediabetes");
  if (diabetic || profile.goals.includes("monitor-carbs")) {
    considered.push("Carbohydrate monitoring");
    if (portion.carbohydratesG == null)
      F.push({ id: "carbs-missing", priority: 6, level: "CAUTION", title: "Carbohydrate is not stated, so it can't be shown for your portion.", detail: "", evidence: [], rule: "Carbohydrate monitoring needs the carbohydrate value.", source: "Label data", nutrients: ["carbohydratesG"] });
    else {
      const carbLimit = profile.limits.find((l) => l.nutrient === "carbohydratesG");
      const pctEnergy = n.energyKcal ? Math.min(100, Math.round(((n.carbohydratesG! * 4) / n.energyKcal) * 100)) : null;
      F.push({
        id: "carbs", priority: 4, level: "INFO",
        title: `${amtTxt} has ${qty("carbohydratesG", portion.carbohydratesG)} carbohydrate${portion.addedSugarG != null ? `, including ${qty("addedSugarG", portion.addedSugarG)} added sugar` : ""}.`,
        detail: `${pctEnergy != null ? `Carbohydrate supplies about ${pctEnergy}% of this product's energy. ` : ""}${diabetic ? "Sugar alone doesn't decide whether a food fits a diabetes plan — total carbohydrate, the rest of the meal and your own plan matter. " : ""}${carbLimit ? "Your carbohydrate limit is checked separately." : "If your clinician gave you a carbohydrate amount per meal, add it to your profile and FoodDecode will check it."}`,
        evidence: [{ label: "Carbohydrate per 100 " + unit, value: qty("carbohydratesG", n.carbohydratesG!) }],
        rule: "Show total carbohydrate for the selected portion when carbohydrate monitoring or diabetes is recorded. No diabetes threshold is assumed.", source: "Label data", nutrients: ["carbohydratesG"],
      });
    }
  }
  for (const l of profile.limits.filter((x) => !x.clinicianAdvised)) {
    considered.push(`Your ${NUTRIENT_LABEL[l.nutrient].toLowerCase()} target`);
    F.push(limitFinding(l, product, portion, amtTxt, 4));
  }
  if (profile.goals.includes("manage-energy") && portion.energyKcal != null) {
    const share = portion.energyKcal / 2000;
    F.push({
      id: "energy", priority: 4, level: share >= PORTION_HIGH_SHARE ? "CAUTION" : "INFO",
      title: `${amtTxt} provides ${fmt(portion.energyKcal, 0)} kcal (${pct(share)} of a 2,000 kcal reference day).`,
      detail: share >= PORTION_HIGH_SHARE ? "That's a substantial share of a day's energy in one portion. Your profile includes a calorie goal." : "A modest share of a day's energy.",
      evidence: [{ label: "Energy per 100 " + unit, value: `${fmt(n.energyKcal!, 0)} kcal` }],
      rule: "Energy ≥20% of 2,000 kcal in one portion → CAUTION when a calorie goal is recorded.", source: DAILY_REFERENCE.energyKcal!.source, action: share >= PORTION_HIGH_SHARE ? "Try a smaller portion with the portion control above." : undefined, nutrients: ["energyKcal"],
    });
  }
  for (const [goal, key] of [["more-protein", "proteinG"], ["more-fibre", "fibreG"]] as const) {
    if (!profile.goals.includes(goal)) continue;
    considered.push(GOAL_LABEL[goal]);
    const v = portion[key];
    const ref = DAILY_REFERENCE[key]!;
    if (v == null) F.push({ id: goal, priority: 6, level: "INFO", title: `${NUTRIENT_LABEL[key]} isn't stated on this label.`, detail: "", evidence: [], rule: "", source: "Label data", nutrients: [key] });
    else {
      const share = v / ref.value;
      F.push({
        id: goal, priority: 4, level: "INFO",
        title: `${amtTxt} gives ${qty(key, v)} ${NUTRIENT_LABEL[key].toLowerCase()} (${pct(share)} of a ${ref.value} g daily reference).`,
        detail: share >= PORTION_HIGH_SHARE ? "A good contribution towards your goal." : share <= 0.05 ? "Contributes little towards your goal." : "A moderate contribution towards your goal.",
        evidence: [], rule: "≥20% of the daily reference = good contribution; ≤5% = little (FDA 5/20 convention).", source: ref.source, nutrients: [key],
      });
    }
  }

  /* ---------- P5: portion facts ---------- */
  if (portion.energyKcal != null)
    F.push({
      id: "portion", priority: 5, level: "INFO",
      title: `You're looking at ${amtTxt}: ${fmt(portion.energyKcal, 0)} kcal${portion.sodiumMg != null ? `, ${qty("sodiumMg", portion.sodiumMg)} sodium` : ""}${portion.addedSugarG != null ? `, ${qty("addedSugarG", portion.addedSugarG)} added sugar` : portion.sugarsG != null ? `, ${qty("sugarsG", portion.sugarsG)} total sugars` : ""}.`,
      detail: product.servingSize ? `The label's serving is ${fmt(product.servingSize)} ${unit}. Change the portion above and everything here updates.` : `The label doesn't state a serving size, so values are scaled from per-100 ${unit}.`,
      evidence: [], rule: "All values are per-100 label values × portion ÷ 100.", source: "Label data",
    });

  /* ---------- P6: data quality and uncertainty ---------- */
  const core: NutrientKey[] = ["energyKcal", "sugarsG", "saturatedFatG", "sodiumMg"];
  const missingCore = core.filter((k) => n[k] == null);
  if (missingCore.length >= 3)
    F.push({ id: "limited", priority: 6, level: "CAUTION", title: "Most key nutrition values are missing.", detail: `Not stated: ${missingCore.map((k) => NUTRIENT_LABEL[k].toLowerCase()).join(", ")}.`, evidence: [], rule: "Three or more of energy, sugars, saturated fat and sodium missing → CAUTION.", source: "FoodDecode data-quality rule", action: "Scan the nutrition table to complete the information." });
  if (product.provenance === "illustrative")
    F.push({ id: "illustrative", priority: 6, level: "CAUTION", title: "This is fictional demo data, not a real product.", detail: "Use it to see how FoodDecode works, not to make a decision.", evidence: [], rule: "Illustrative data can never produce YES.", source: "FoodDecode data-quality rule" });
  if (product.unresolvedIssues?.length)
    F.push({ id: "unresolved", priority: 6, level: "CAUTION", title: "Some scanned values were flagged and not resolved.", detail: product.unresolvedIssues.join(" "), evidence: [], rule: "Unresolved validation conflicts in scanned values → CAUTION.", source: "FoodDecode validation layer", action: "Re-check those values against the pack." });
  const ec = energyCheck(n);
  if (ec && !ec.ok && product.provenance !== "illustrative")
    F.push({ id: "energy-check", priority: 6, level: "INFO", title: `The stated energy differs by ${pct(ec.deviation)} from what carbs, protein and fat add up to.`, detail: "One of the label values may be misprinted or misread.", evidence: [{ label: "Calculated", value: `${fmt(ec.estimate, 0)} kcal per 100 ${unit}` }], rule: "4×carbs + 4×protein + 9×fat should be within 15% of the stated energy.", source: "Atwater factors" });

  /* ---------- status ---------- */
  const order = { NO: 0, CAUTION: 1, INFO: 2, OK: 3 } as const;
  F.sort((a, b) => a.priority - b.priority || order[a.level] - order[b.level]);
  const firstNo = F.find((f) => f.level === "NO");
  const firstCaution = F.find((f) => f.level === "CAUTION");
  const status: Status = firstNo ? "NO" : firstCaution ? "CAUTION" : "YES";
  const empty = profileIsEmpty(profile);
  const headline =
    status === "NO" ? `NO — ${firstNo!.title}`
      : status === "CAUTION" ? `CAUTION — ${firstCaution!.title}`
      : empty ? "YES — Nothing in your profile conflicts with this product at this portion, based on the available information."
      : "YES — This product appears compatible with your selected dietary preferences and nutritional criteria for the chosen portion.";

  /* ---------- confidence ---------- */
  const reasons: string[] = [];
  let level: "high" | "medium" | "low" = "high";
  if (product.provenance === "community") { level = "medium"; reasons.push("Community-entered data (Open Food Facts), checked for consistency but not against the label photo."); }
  if (product.provenance === "label-photo-checked") reasons.push("Values checked against a photo of the printed label.");
  if (product.provenance === "ocr-user-verified") reasons.push("Values read from your photo and confirmed by you.");
  if (product.provenance === "illustrative") { level = "low"; reasons.push("Fictional demo data."); }
  const needsIngredients = profile.allergies.items.length + profile.allergies.custom.length + profile.intolerances.items.length + profile.diet.customAvoid.length > 0 || !["none", "non-vegetarian"].includes(profile.diet.pattern) || profile.conditions.items.includes("coeliac");
  if (needsIngredients && !hasIngredients) { level = "low"; reasons.push("No ingredient list, so allergens and diet can't be checked."); }
  if (product.unresolvedIssues?.length) { level = "low"; reasons.push("Unresolved scan issues."); }
  if (missingCore.length >= 2) { level = level === "high" ? "medium" : level; reasons.push(`${missingCore.length} key nutrition values not stated.`); }
  if (!reasons.length) reasons.push("Complete label information.");

  return { status, headline, findings: F, portion: { amount, unit, servings }, confidence: { level, reasons }, considered, emptyProfile: empty };
}

/* ------------------------------------------------------------------ helpers */

function allergenFinding(a: AllergenId, p: Product): Finding {
  const r = checkAllergen(a, p.ingredientsText, p.allergenStatement);
  const name = ALLERGEN_LABEL[a];
  const base = { id: `allergy-${a}`, priority: 1 as Priority, source: "FoodDecode allergen term list (lib/ingredients/allergens.ts) applied to the label's ingredient list and allergen statements", tags: [a] };
  switch (r.kind) {
    case "confirmed":
      return { ...base, level: "NO", title: `This product lists ${r.matches.join(", ")}, which conflicts with your recorded ${name.toLowerCase()} allergy.`, detail: `Found in the ${r.where.join(" and ")}.`, evidence: r.matches.map((m) => ({ label: `In ${r.where.join(" and ")}`, value: m })), rule: "Allergen named in the ingredient list or a “Contains” statement → NO (highest priority).", action: "Don't rely on this product. See alternatives that don't list this allergen." };
    case "possible":
      return { ...base, level: "CAUTION", title: `Possible ${name.toLowerCase()}: ${r.matches.join(", ")}.`, detail: `${r.why ?? ""}. The source isn't stated on the label.`, evidence: r.matches.map((m) => ({ label: "Source not stated", value: m })), rule: "Ingredient whose source is often the allergen, without the source stated → CAUTION.", action: "Contact the manufacturer or choose a product that states the source." };
    case "cross-contact":
      return { ...base, level: "CAUTION", title: `The label says it may contain ${r.matches.join(", ")} (possible cross-contact).`, detail: "This is a precautionary statement about shared equipment or facilities, not an ingredient.", evidence: r.matches.map((m) => ({ label: "Precautionary statement", value: m })), rule: "“May contain” / shared-facility statement → CAUTION.", action: "Follow your allergist's advice on precautionary labels." };
    case "unknown":
      return { ...base, level: "CAUTION", title: `No ingredient information is available to check for ${name.toLowerCase()}.`, detail: "Missing information is never treated as allergen-free.", evidence: [], rule: "No ingredient list → CAUTION for every recorded allergy.", action: "Read the ingredient list on the pack, or scan it." };
    default:
      return { ...base, level: "OK", title: `No ${name.toLowerCase()} ingredients or warnings listed.`, detail: "Based on the ingredient list and allergen statements available to FoodDecode. Recipes change — check the current pack.", evidence: [], rule: "Allergen terms searched in ingredients, “Contains” and “May contain” statements." };
  }
}

function customFinding(priority: Priority, id: string, term: string, kind: "confirmed" | "cross-contact" | "none" | "unknown", what: "allergy" | "avoid" | "intolerance", _p: Product): Finding {
  const noun = what === "allergy" ? `your recorded ${term} allergy` : what === "intolerance" ? `your recorded ${term} intolerance` : `your choice to avoid ${term}`;
  const base = { id, priority, source: "Your own entry, matched as a word in the ingredient list", rule: `Custom term “${term}” searched in the ingredient list and allergen statements.`, tags: [term] };
  if (kind === "confirmed") return { ...base, level: what === "intolerance" ? "CAUTION" : "NO", title: `Lists “${term}”, which conflicts with ${noun}.`, detail: "", evidence: [{ label: "Found on label", value: term }], action: "See alternatives below." };
  if (kind === "cross-contact") return { ...base, level: "CAUTION", title: `The label says it may contain ${term}.`, detail: "Precautionary statement.", evidence: [{ label: "Precautionary statement", value: term }] };
  if (kind === "unknown") return { ...base, level: what === "avoid" ? "INFO" : "CAUTION", title: `No ingredient list to check for “${term}”.`, detail: "Missing information isn't proof it's absent.", evidence: [] };
  return { ...base, level: "OK", title: `“${term}” is not listed.`, detail: "Custom terms are matched as words; synonyms may be missed.", evidence: [] };
}

function focusFinding(key: NutrientKey, why: string[], p: Product, portion: Product["nutrition"], amount: number): Finding {
  const unit = unitOf(p);
  const n = p.nutrition;
  let useKey = key;
  let note = "";
  if (key === "addedSugarG" && n.addedSugarG == null && n.sugarsG != null) {
    useKey = "sugarsG";
    note = " The label doesn't separate added sugar, so total sugar is used as an upper estimate.";
  }
  const v = portion[useKey];
  const ref = DAILY_REFERENCE[key === "addedSugarG" ? "addedSugarG" : key]!;
  const label = useKey === "sugarsG" ? "total sugar" : NUTRIENT_LABEL[key].toLowerCase();
  const base = { id: `focus-${key}`, priority: 4 as Priority, nutrients: [key, useKey], source: `${ref.source}; portion rule: ≥20% of the daily reference = high (FDA 5/20 convention); per-100 band: ${PER100_BAND_SOURCE}` };
  if (v == null)
    return { ...base, priority: 6, level: "CAUTION", title: `${NUTRIENT_LABEL[key]} isn't stated, so FoodDecode can't check it for ${why.join(" and ")}.`, detail: "Missing information is not treated as low.", evidence: [], rule: "A nutrient your profile focuses on is missing → CAUTION.", action: "Check the pack or scan the label." };
  const share = v / ref.value;
  const band = per100Band(useKey, n[useKey], unit);
  const ev: Evidence[] = [
    { label: `${label[0].toUpperCase() + label.slice(1)} in this portion`, value: qty(useKey, v) },
    { label: "Share of daily reference", value: `${pct(share)} of ${ref.value} ${ref.unit}` },
    { label: `Per 100 ${unit}`, value: `${qty(useKey, n[useKey]!)}${band ? ` (${band.code} band)` : ""}` },
  ];
  if (key === "sodiumMg") ev.push({ label: "As salt", value: `≈ ${fmt(sodiumMgToSaltG(v), 1)} g` });
  const rule = `${NUTRIENT_LABEL[key]} in the selected portion ≥20% of the daily reference → CAUTION, because of ${why.join(" and ")}.`;
  if (share >= PORTION_HIGH_SHARE)
    return {
      ...base, level: "CAUTION",
      title: `This portion contains ${qty(useKey, v)} ${label} (${pct(share)} of the daily reference). Your profile includes ${why.join(" and ")}.`,
      detail: `That's a substantial contribution from one portion.${note} This is a general-population reference, not a medical limit; if your clinician gave you a specific limit, add it to your profile.`,
      evidence: ev, rule, action: p.servingSize && amount > p.servingSize * 1.05 ? "A smaller portion brings this down — try one serving." : "Consider a smaller portion or an alternative below.",
    };
  return { ...base, level: "OK", title: `${qty(useKey, v)} ${label} in this portion (${pct(share)} of the daily reference) — below the 20% “high” level.`, detail: `Checked because of ${why.join(" and ")}.${note}`, evidence: ev, rule };
}

function limitFinding(l: NutrientLimit, p: Product, portion: Product["nutrition"], amtTxt: string, priority: Priority): Finding {
  const label = NUTRIENT_LABEL[l.nutrient];
  const who = l.clinicianAdvised ? "clinician-advised" : "personal";
  const v = portion[l.nutrient];
  const base = { id: `limit-${l.id}`, priority, nutrients: [l.nutrient], source: l.clinicianAdvised ? "Limit entered by you as advised by your clinician" : "Target entered by you", rule: "" };
  const limTxt = `${qty(l.nutrient, l.amount)} per ${l.per === "day" ? "day" : "portion"}`;
  if (v == null)
    return { ...base, level: "CAUTION", title: `${label} isn't stated, so your ${who} limit (${limTxt}) can't be checked.`, detail: "", evidence: [], rule: "A nutrient with a recorded limit is missing → CAUTION.", action: "Check the pack or scan the label." };
  const ratio = v / l.amount;
  const ev = [{ label: `${label} in ${amtTxt}`, value: qty(l.nutrient, v) }, { label: `Your ${who} limit`, value: limTxt }, { label: "Share of your limit", value: pct(ratio) }];
  if (ratio > 1)
    return { ...base, level: l.clinicianAdvised ? "NO" : "CAUTION", title: `${amtTxt} has ${qty(l.nutrient, v)} ${label.toLowerCase()}, above your ${who} limit of ${limTxt}.`, detail: l.note ? `Your note: ${l.note}` : "", evidence: ev, rule: `Portion exceeds a ${who} limit → ${l.clinicianAdvised ? "NO" : "CAUTION"}.`, action: "A smaller portion may fit within your limit." };
  if (l.per === "day" && ratio >= PORTION_HIGH_SHARE)
    return { ...base, level: "CAUTION", title: `${amtTxt} uses ${pct(ratio)} of your ${who} daily ${label.toLowerCase()} limit (${limTxt}).`, detail: "That's a large share of your day's limit in one portion.", evidence: ev, rule: "One portion uses ≥20% of a daily limit → CAUTION.", action: "Plan the rest of the day around it, or choose a smaller portion." };
  return { ...base, level: "OK", title: `${qty(l.nutrient, v)} ${label.toLowerCase()} — within your ${who} limit (${pct(ratio)} of ${limTxt}).`, detail: "", evidence: ev, rule: l.per === "day" ? "Portion uses <20% of the daily limit." : "Portion is within the per-portion limit." };
}
