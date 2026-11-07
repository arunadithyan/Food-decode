/*
 * Allergen matching. Distinguishes three kinds of evidence:
 *  - confirmed: the allergen appears in the ingredient list or in a "Contains" statement
 *  - possible:  a precautionary "may contain"/shared-facility statement, or an ingredient whose source is not stated
 *  - unknown:   no ingredient information is available — never treated as allergen-free
 */
import { normText, splitStatements } from "./parse";

export const ALLERGENS = [
  "milk",
  "peanut",
  "tree-nuts",
  "soy",
  "gluten",
  "egg",
  "fish",
  "shellfish",
  "sesame",
  "sulphite",
] as const;
export type AllergenId = (typeof ALLERGENS)[number];

export const ALLERGEN_LABEL: Record<AllergenId, string> = {
  milk: "Milk",
  peanut: "Peanuts (groundnut)",
  "tree-nuts": "Tree nuts",
  soy: "Soy",
  gluten: "Wheat / gluten",
  egg: "Eggs",
  fish: "Fish",
  shellfish: "Shellfish (crustaceans, molluscs)",
  sesame: "Sesame (til)",
  sulphite: "Sulphite",
};

interface AllergenTerms {
  terms: RegExp;
  /** phrases that contain a trigger word but are not the allergen (e.g. "cocoa butter" for milk) */
  exclude?: RegExp;
  /** ingredients whose source is often, but not necessarily, this allergen */
  possible?: { re: RegExp; why: string }[];
}

const T: Record<AllergenId, AllergenTerms> = {
  milk: {
    terms: /\b(milk|milk solids|milk powder|dairy|butter|butter ?oil|ghee|cream|cheese|paneer|khoa|khoya|curd|yogh?urt|dahi|whey|casein(?:ate)?|lactose|buttermilk|lassi)\b/,
    exclude: /\b(cocoa butter|peanut butter|nut butter|shea butter|coconut milk|coconut cream|cream of tartar|ice ?cream flavou?r|cream crackers?)\b/g,
  },
  peanut: { terms: /\b(peanuts?|groundnuts?|ground nuts?|arachis|monkey ?nuts?)\b/ },
  "tree-nuts": {
    terms: /\b(almonds?|badam|cashews?|kaju|walnuts?|akhrot|pistachios?|pista|hazelnuts?|pecans?|macadamia|brazil nuts?|pine nuts?|chilgoza|tree nuts?)\b/,
    exclude: /\b(nutmeg|coconut|doughnut|butternut|groundnuts?|peanuts?|nutrition|nutrients?|nutritional)\b/g,
    possible: [{ re: /\bnuts?\b/, why: "“nuts” is listed without naming which nut" }],
  },
  soy: {
    terms: /\b(soy|soya|soybeans?|soyabeans?|tofu|edamame)\b/,
    possible: [
      { re: /\blecithins?\b|\b322\b/, why: "lecithin (INS 322) is listed without its source; it is often made from soy" },
      { re: /\bhydroly[sz]ed vegetable protein\b|\bvegetable protein\b/, why: "vegetable protein is listed without its source; it may come from soy" },
    ],
  },
  gluten: {
    terms: /\b(wheat|maida|atta|semolina|sooji|suji|rava|durum|spelt|barley|rye|malt|malted|gluten|cereal extract|couscous|bulgur|seitan)\b/,
    exclude: /\b(buckwheat|malt(?:o)?dextrin|gluten[- ]free)\b/g,
    possible: [
      { re: /\boats?\b/, why: "oats are often cross-contaminated with wheat unless labelled gluten-free" },
      { re: /\bhydroly[sz]ed vegetable protein\b/, why: "hydrolysed vegetable protein may be made from wheat" },
      { re: /\bcereal products?\b/, why: "“cereal products” are listed without naming the cereal" },
    ],
  },
  egg: { terms: /\b(eggs?|egg yolk|egg white|albumin|ovalbumin|mayonnaise|meringue)\b/ },
  fish: { terms: /\b(fish|anchov(?:y|ies)|tuna|salmon|sardines?|mackerel|cod|fish sauce|fish oil|bombay duck)\b/, exclude: /\bshellfish\b/g },
  shellfish: { terms: /\b(prawns?|shrimps?|crabs?|lobsters?|crustaceans?|shellfish|oysters?|mussels?|clams?|squid|scallops?)\b/ },
  sesame: { terms: /\b(sesame|til|gingelly|tahini)\b/ },
  sulphite: {
    terms: /\b(sulphites?|sulfites?|sulphur dioxide|sulfur dioxide|metabisulphite|metabisulfite|22[0-8])\b/,
  },
};

export type AllergenEvidenceKind = "confirmed" | "possible" | "cross-contact" | "unknown" | "none";
export interface AllergenFinding {
  allergen: AllergenId;
  kind: AllergenEvidenceKind;
  /** the exact words found on the label */
  matches: string[];
  /** where they were found */
  where: string[];
  why?: string;
}

function strip(text: string, ex?: RegExp): string {
  return ex ? text.replace(ex, " ") : text;
}

function find(re: RegExp, text: string): string[] {
  const g = new RegExp(re.source, "g");
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = g.exec(text))) out.add(m[0]);
  return [...out];
}

/** Check one allergen against a product's ingredient text and allergen statement. */
export function checkAllergen(
  allergen: AllergenId,
  ingredientsText: string | null | undefined,
  allergenStatement?: string | null,
): AllergenFinding {
  if (!ingredientsText && !allergenStatement) return { allergen, kind: "unknown", matches: [], where: [] };
  const sec = splitStatements(ingredientsText, allergenStatement);
  const def = T[allergen];
  const ing = strip(normText(sec.ingredients), def.exclude);
  const contains = strip(normText(sec.contains.join(" ")), def.exclude);
  const may = strip(normText(sec.mayContain.join(" ")), def.exclude);

  const inIng = find(def.terms, ing);
  const inContains = find(def.terms, contains);
  if (inIng.length || inContains.length) {
    return {
      allergen,
      kind: "confirmed",
      matches: [...new Set([...inIng, ...inContains])],
      where: [inIng.length ? "ingredient list" : "", inContains.length ? "“Contains” statement" : ""].filter(Boolean),
    };
  }
  for (const p of def.possible || []) {
    // a qualified source (e.g. "sunflower lecithin", "soy lecithin") is not ambiguous
    const hits = find(p.re, ing).filter((h) => !new RegExp(`(sunflower|rapeseed|canola|egg|soy|soya)\\s+${h}`).test(ing));
    if (hits.length) return { allergen, kind: "possible", matches: hits, where: ["ingredient list"], why: p.why };
  }
  const inMay = find(def.terms, may);
  if (inMay.length) return { allergen, kind: "cross-contact", matches: inMay, where: ["precautionary “may contain” statement"] };
  if (!sec.ingredients) return { allergen, kind: "unknown", matches: [], where: [] };
  return { allergen, kind: "none", matches: [], where: [] };
}

/** Custom, user-entered allergy or avoidance terms (e.g. "mustard", "kiwi"). */
export function checkCustomTerm(term: string, ingredientsText: string | null | undefined, allergenStatement?: string | null) {
  const t = term.trim().toLowerCase();
  if (!t) return { kind: "none" as const, matches: [] as string[] };
  if (!ingredientsText && !allergenStatement) return { kind: "unknown" as const, matches: [] };
  const sec = splitStatements(ingredientsText, allergenStatement);
  const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:e?s)?\\b`, "i");
  const ing = normText(sec.ingredients + " " + sec.contains.join(" "));
  const may = normText(sec.mayContain.join(" "));
  if (re.test(ing)) return { kind: "confirmed" as const, matches: [t] };
  if (re.test(may)) return { kind: "cross-contact" as const, matches: [t] };
  return { kind: "none" as const, matches: [] };
}
