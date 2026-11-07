/*
 * Deterministic validation of label values (from OCR or typed in by the user).
 * Issues carry an optional suggestion; the review screen offers it as a button. Nothing is auto-applied.
 */
import { energyCheck } from "../nutrition/calc";
import { SALT_PER_SODIUM } from "../nutrition/reference";
import { NUTRIENT_LABEL, emptyNutrition, type Nutrition, type NutrientKey, type Product, type Unit } from "../types";
import { FIELD_KEYS, type Basis, type FieldKey, type ParsedLabel } from "./parser";

export interface DraftValue { per100: number | null; perServing: number | null }
export interface LabelDraft {
  name: string;
  brand: string;
  category: string;
  unit: Unit;
  values: Record<FieldKey, DraftValue>;
  servingSize: number | null;
  servingsPerPack: number | null;
  packSize: number | null;
  ingredientsText: string;
  allergenStatement: string;
  barcode?: string;
}

export type Severity = "error" | "warning" | "info";
export type IssueField = FieldKey | "servingSize" | "packSize" | "servingsPerPack" | "ingredientsText" | "name";
export interface Issue {
  id: string;
  severity: Severity;
  field?: IssueField;
  basis?: Basis;
  message: string;
  suggestion?: { value: number; label: string };
}

export const FIELD_LABEL: Record<FieldKey, string> = { ...NUTRIENT_LABEL, saltG: "Salt" };
export const FIELD_UNIT: Record<FieldKey, string> = {
  energyKcal: "kcal", proteinG: "g", carbohydratesG: "g", sugarsG: "g", addedSugarG: "g", totalFatG: "g",
  saturatedFatG: "g", transFatG: "g", sodiumMg: "mg", saltG: "g", fibreG: "g",
};
/** Fields the suitability engine relies on; missing ones are called out on the review screen. */
export const CRITICAL_FIELDS: FieldKey[] = ["energyKcal", "sugarsG", "addedSugarG", "totalFatG", "saturatedFatG", "sodiumMg", "carbohydratesG", "proteinG"];

export function emptyValues(): Record<FieldKey, DraftValue> {
  return Object.fromEntries(FIELD_KEYS.map((k) => [k, { per100: null, perServing: null }])) as Record<FieldKey, DraftValue>;
}

export function draftFromParsed(p: ParsedLabel, extra?: Partial<LabelDraft>): LabelDraft {
  const values = emptyValues();
  for (const k of FIELD_KEYS) {
    const f = p.fields[k];
    if (f) values[k] = { per100: f.per100, perServing: f.perServing };
  }
  return {
    name: "",
    brand: "",
    category: "Scanned label",
    unit: p.unit ?? "g",
    values,
    servingSize: p.servingSize,
    servingsPerPack: p.servingsPerPack,
    packSize: p.packSize,
    ingredientsText: p.ingredientsText ?? "",
    allergenStatement: p.allergenStatement ?? "",
    ...extra,
  };
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const fmtv = (v: number) => (Math.abs(v) >= 100 ? String(Math.round(v)) : String(r1(v)));

export function validateDraft(d: LabelDraft): Issue[] {
  const issues: Issue[] = [];
  const add = (i: Issue) => issues.push(i);
  const v = d.values;
  const isG = d.unit === "g";
  const bases: Basis[] = ["100", "serving"];
  const get = (k: FieldKey, b: Basis) => (b === "100" ? v[k].per100 : v[k].perServing);
  const basisName = (b: Basis) => (b === "100" ? `per 100 ${d.unit}` : "per serving");
  const anyServing = FIELD_KEYS.some((k) => v[k].perServing != null);
  const anyPer100 = FIELD_KEYS.some((k) => v[k].per100 != null);

  if (!d.name.trim()) add({ id: "name-missing", severity: "warning", field: "name", message: "Add the product name so you can find this scan later." });

  // missing critical values (sodium may be derived from salt)
  for (const k of CRITICAL_FIELDS) {
    const has = v[k].per100 != null || v[k].perServing != null;
    if (has) continue;
    if (k === "sodiumMg" && (v.saltG.per100 != null || v.saltG.perServing != null)) continue;
    if (k === "addedSugarG") {
      add({ id: `missing-${k}`, severity: "info", field: k, message: "Added sugar was not found. Older or imported labels may not show it. Enter it if the label has it; otherwise it stays unknown." });
      continue;
    }
    add({ id: `missing-${k}`, severity: "warning", field: k, message: `${FIELD_LABEL[k]} was not found. Enter it from the label, or leave it blank — it will be treated as unknown, not zero.` });
  }

  if (!anyPer100 && !anyServing) add({ id: "no-values", severity: "error", message: "No nutrition values were read. Retake the photo or type the values in." });
  if (anyServing && !d.servingSize) add({ id: "serving-missing", severity: "error", field: "servingSize", message: "Per-serving values were read but the serving size was not. Enter the serving size printed on the label." });
  if (!anyPer100 && anyServing && d.servingSize) add({ id: "per100-derived", severity: "info", message: `Only per-serving values were read. Per-100 ${d.unit} values will be calculated from the ${d.servingSize} ${d.unit} serving.` });

  // impossible values
  for (const b of bases) {
    for (const k of FIELD_KEYS) {
      const x = get(k, b);
      if (x == null) continue;
      if (x < 0) add({ id: `neg-${k}-${b}`, severity: "error", field: k, basis: b, message: `${FIELD_LABEL[k]} ${basisName(b)} cannot be negative.` });
    }
    if (b === "100") {
      for (const k of ["proteinG", "carbohydratesG", "sugarsG", "addedSugarG", "totalFatG", "saturatedFatG", "transFatG", "fibreG", "saltG"] as FieldKey[]) {
        const x = get(k, b);
        if (x != null && x > 100) add({ id: `gt100-${k}`, severity: "error", field: k, basis: b, message: `${FIELD_LABEL[k]} of ${fmtv(x)} g per 100 ${d.unit} is impossible. A decimal point may have been missed.`, suggestion: { value: r1(x / 10), label: `Use ${fmtv(x / 10)}` } });
      }
      const e = get("energyKcal", b);
      if (e != null && e > 900) add({ id: "energy-impossible", severity: "error", field: "energyKcal", basis: b, message: `Energy of ${fmtv(e)} kcal per 100 ${d.unit} is above the maximum possible (~900 kcal for pure fat). It may be in kJ, or a digit was misread.`, suggestion: { value: r1(e / 4.184), label: `Treat as kJ → ${fmtv(e / 4.184)} kcal` } });
      const s = get("sodiumMg", b);
      if (s != null && s > 40000) add({ id: "sodium-impossible", severity: "error", field: "sodiumMg", basis: b, message: `Sodium of ${fmtv(s)} mg per 100 ${d.unit} is more than pure salt contains.` });
      else if (s != null && s > 3500) add({ id: "sodium-high", severity: "warning", field: "sodiumMg", basis: b, message: `Sodium of ${fmtv(s)} mg per 100 ${d.unit} is far higher than almost any packaged food. A unit (g vs mg) or digit may be misread.`, suggestion: { value: r1(s / 10), label: `Use ${fmtv(s / 10)} mg` } });
      const macro = ["proteinG", "carbohydratesG", "totalFatG"].map((k) => get(k as FieldKey, b) ?? 0).reduce((a, c) => a + c, 0);
      if (isG && macro > 105) add({ id: "macro-sum", severity: "error", message: `Protein + carbohydrates + fat add up to ${fmtv(macro)} g per 100 g, which is impossible. Check those three values.` });
    }
  }

  // internal consistency, per basis
  for (const b of bases) {
    const fat = get("totalFatG", b), sat = get("saturatedFatG", b), trans = get("transFatG", b);
    if (fat != null && sat != null && sat + (trans ?? 0) > fat * 1.05 + 0.15) {
      const sug = sat / 10 + (trans ?? 0) <= fat * 1.05 + 0.15 ? { value: r1(sat / 10), label: `Saturated fat ${fmtv(sat / 10)}?` } : undefined;
      add({ id: `fat-parts-${b}`, severity: "error", field: "saturatedFatG", basis: b, message: `Saturated${trans ? " + trans" : ""} fat (${fmtv(sat + (trans ?? 0))} g) is more than total fat (${fmtv(fat)} g) ${basisName(b)}.`, suggestion: sug });
    }
    const carbs = get("carbohydratesG", b), sug = get("sugarsG", b), added = get("addedSugarG", b);
    if (carbs != null && sug != null && sug > carbs * 1.05 + 0.15) add({ id: `sugar-carbs-${b}`, severity: "error", field: "sugarsG", basis: b, message: `Total sugars (${fmtv(sug)} g) are more than carbohydrates (${fmtv(carbs)} g) ${basisName(b)}.`, suggestion: sug / 10 <= carbs ? { value: r1(sug / 10), label: `Use ${fmtv(sug / 10)}` } : undefined });
    if (sug != null && added != null && added > sug * 1.05 + 0.15) add({ id: `added-sugar-${b}`, severity: "error", field: "addedSugarG", basis: b, message: `Added sugar (${fmtv(added)} g) is more than total sugars (${fmtv(sug)} g) ${basisName(b)}.` });
    const sod = get("sodiumMg", b), salt = get("saltG", b);
    if (sod != null && salt != null && salt > 0 && sod > 0) {
      const expected = (sod * SALT_PER_SODIUM) / 1000;
      if (Math.abs(expected - salt) / salt > 0.15) add({ id: `sodium-salt-${b}`, severity: "warning", field: "sodiumMg", basis: b, message: `Sodium ${fmtv(sod)} mg and salt ${fmtv(salt)} g don't match ${basisName(b)} (salt ≈ sodium × 2.5 → ${r1(expected)} g). One of them was probably misread.`, suggestion: { value: Math.round((salt * 1000) / SALT_PER_SODIUM), label: `Sodium from salt: ${Math.round((salt * 1000) / SALT_PER_SODIUM)} mg` } });
    }
    if (sod != null && sod > 0 && sod < 3 && !Number.isInteger(sod)) add({ id: `sodium-unit-${b}`, severity: "warning", field: "sodiumMg", basis: b, message: `Sodium of ${sod} mg ${basisName(b)} is unusually low. Labels sometimes print sodium in grams — check the unit.`, suggestion: { value: Math.round(sod * 1000), label: `It's in g → ${Math.round(sod * 1000)} mg` } });
    if (sod == null && salt != null) add({ id: `sodium-from-salt-${b}`, severity: "info", field: "sodiumMg", basis: b, message: `The label shows salt but not sodium ${basisName(b)}. Sodium can be calculated as salt ÷ 2.5.`, suggestion: { value: Math.round((salt * 1000) / SALT_PER_SODIUM), label: `Use ${Math.round((salt * 1000) / SALT_PER_SODIUM)} mg` } });
  }

  // energy vs macros (Atwater 4/4/9) on per-100 values
  const n100 = toNutritionPer100(d);
  const ec = energyCheck(n100);
  if (ec && !ec.ok) add({ id: "energy-check", severity: "warning", field: "energyKcal", message: `Energy (${fmtv(n100.energyKcal!)} kcal) differs from what the protein, carbs and fat imply (≈${Math.round(ec.estimate)} kcal) by ${Math.round(ec.deviation * 100)}%. One of these values may be misread.` });

  // per-100 vs per-serving consistency
  if (d.servingSize && d.servingSize > 0) {
    const ratio = d.servingSize / 100;
    for (const k of FIELD_KEYS) {
      const a = v[k].per100, s = v[k].perServing;
      if (a == null || s == null) continue;
      const expected = a * ratio;
      const tol = Math.max(0.15 * expected, k === "sodiumMg" || k === "energyKcal" ? 3 : 0.25);
      if (Math.abs(s - expected) > tol) {
        // which side is more plausibly wrong? try ×/÷10 on either side
        // Candidate fixes; the one that best restores per-serving ≈ per-100 × serving/100 wins.
        // Dropped decimal points are the commonest OCR slip, so "÷10" readings are preferred over "×10".
        const cands: { basis: Basis; value: number; err: number; label: string }[] = [
          { basis: "serving" as Basis, value: s / 10, err: Math.abs(s / 10 - expected) / Math.max(expected, 0.05) * 0.5, label: `Per serving ${fmtv(s / 10)}?` },
          { basis: "serving" as Basis, value: s * 10, err: Math.abs(s * 10 - expected) / Math.max(expected, 0.05), label: `Per serving ${fmtv(s * 10)}?` },
          { basis: "100" as Basis, value: a / 10, err: Math.abs((a / 10) * ratio - s) / Math.max(s, 0.05) * 0.5, label: `Per 100 ${d.unit}: ${fmtv(a / 10)}?` },
          { basis: "100" as Basis, value: a * 10, err: Math.abs(a * 10 * ratio - s) / Math.max(s, 0.05), label: `Per 100 ${d.unit}: ${fmtv(a * 10)}?` },
        ].filter((c) => c.err <= 0.15).sort((x, y) => x.err - y.err);
        const best = cands[0];
        const basis: Basis = best ? best.basis : "serving";
        const suggestion: Issue["suggestion"] = best ? { value: r1(best.value), label: best.label } : { value: r1(expected), label: `Per serving from per 100: ${fmtv(expected)}` };
        add({ id: `ratio-${k}`, severity: "warning", field: k, basis, message: `${FIELD_LABEL[k]}: per serving (${fmtv(s)}) doesn't match per 100 ${d.unit} (${fmtv(a)}) for a ${d.servingSize} ${d.unit} serving (expected ≈${fmtv(expected)}). A digit or decimal may be misread, or the serving size is wrong.`, suggestion });
      }
    }
  }

  // serving / pack
  if (d.servingSize != null && (d.servingSize <= 0 || d.servingSize > 2000)) add({ id: "serving-range", severity: "error", field: "servingSize", message: "Serving size looks wrong. Enter the value printed on the label." });
  if (d.packSize != null && d.servingSize != null && d.servingSize > d.packSize * 1.02) add({ id: "serving-gt-pack", severity: "error", field: "servingSize", message: `Serving size (${d.servingSize} ${d.unit}) is larger than the pack (${d.packSize} ${d.unit}).` });
  if (d.packSize && d.servingSize && d.servingsPerPack) {
    const implied = d.packSize / d.servingSize;
    if (Math.abs(implied - d.servingsPerPack) / d.servingsPerPack > 0.25) add({ id: "servings-mismatch", severity: "warning", field: "servingsPerPack", message: `${d.servingsPerPack} servings per pack doesn't match ${d.packSize} ÷ ${d.servingSize} = ${r1(implied)}. Labels often round this; please check.` });
  }
  if (!d.ingredientsText.trim()) add({ id: "ingredients-missing", severity: "warning", field: "ingredientsText", message: "No ingredient list. Allergen and diet checks will be marked as unknown — photograph the ingredients too, or type them in." });
  return issues;
}

/** Per-100 nutrition for the engine. Per-serving-only values are scaled using the serving size. Salt is NOT turned into sodium here. */
export function toNutritionPer100(d: LabelDraft): Nutrition {
  const n = emptyNutrition();
  for (const k of Object.keys(n) as NutrientKey[]) {
    const val = d.values[k];
    if (val.per100 != null) n[k] = val.per100;
    else if (val.perServing != null && d.servingSize && d.servingSize > 0) n[k] = Math.round(((val.perServing * 100) / d.servingSize) * 100) / 100;
  }
  return n;
}

/** Build the product record used by the engine once the user has confirmed the values. */
export function draftToProduct(d: LabelDraft, keptIssues: Issue[], id: string): Product {
  const derived = FIELD_KEYS.some((k) => d.values[k].per100 == null && d.values[k].perServing != null);
  return {
    id,
    barcode: d.barcode,
    brand: d.brand.trim() || "Unknown brand",
    name: d.name.trim() || "Scanned product",
    category: d.category || "Scanned label",
    packSize: d.packSize,
    servingSize: d.servingSize,
    unit: d.unit,
    servingsPerPack: d.servingsPerPack,
    nutrition: toNutritionPer100(d),
    ingredientsText: d.ingredientsText.trim() || null,
    allergenStatement: d.allergenStatement.trim() || null,
    provenance: "ocr-user-verified",
    source: {
      name: "Your label photo (OCR, reviewed by you)",
      sourceType: "OCR-extracted and user-verified",
      checkedDate: new Date().toISOString().slice(0, 10),
      verificationStatus: "OCR-extracted, confirmed by you",
      notes: derived ? "Some per-100 values were calculated from per-serving values." : undefined,
    },
    unresolvedIssues: keptIssues.filter((i) => i.severity !== "info").map((i) => i.message),
  };
}
