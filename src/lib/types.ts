/* Shared domain types. Nutrition values are always stored per 100 g or per 100 ml. */

export type Unit = "g" | "ml";

export const NUTRIENT_KEYS = [
  "energyKcal",
  "carbohydratesG",
  "sugarsG",
  "addedSugarG",
  "proteinG",
  "totalFatG",
  "saturatedFatG",
  "transFatG",
  "sodiumMg",
  "fibreG",
] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
export type Nutrition = Record<NutrientKey, number | null>;

/**
 * Where a product's data came from. The UI must always show this, and the
 * suitability engine adjusts its confidence with it.
 *  - label-photo-checked: community record checked by the FoodDecode team against the photo of the printed label
 *  - community: Open Food Facts community record, only checked for internal consistency
 *  - ocr-user-verified: read from the user's own photo by OCR and confirmed/corrected by the user
 *  - illustrative: fictional demo data (the sample label)
 */
export type Provenance = "label-photo-checked" | "community" | "ocr-user-verified" | "illustrative";

export interface ProductSource {
  name: string;
  url?: string;
  sourceType?: string;
  sourceDate?: string;
  checkedDate?: string;
  verificationStatus: string;
  notes?: string;
  labelImageUrl?: string;
}

export interface Product {
  id: string;
  barcode?: string;
  brand: string;
  name: string;
  category: string;
  variant?: string;
  market?: string;
  packSize: number | null;
  servingSize: number | null;
  unit: Unit;
  servingsPerPack?: number | null;
  nutrition: Nutrition;
  ingredientsText: string | null;
  /** Free text such as "Contains: milk. May contain nuts." if captured separately from the ingredient list */
  allergenStatement?: string | null;
  provenance: Provenance;
  source: ProductSource;
  /** Validation issues the user chose to keep when confirming an OCR scan */
  unresolvedIssues?: string[];
}

export const NUTRIENT_LABEL: Record<NutrientKey, string> = {
  energyKcal: "Energy",
  carbohydratesG: "Carbohydrates",
  sugarsG: "Total sugars",
  addedSugarG: "Added sugar",
  proteinG: "Protein",
  totalFatG: "Total fat",
  saturatedFatG: "Saturated fat",
  transFatG: "Trans fat",
  sodiumMg: "Sodium",
  fibreG: "Dietary fibre",
};

export const NUTRIENT_UNIT: Record<NutrientKey, "kcal" | "g" | "mg"> = {
  energyKcal: "kcal",
  carbohydratesG: "g",
  sugarsG: "g",
  addedSugarG: "g",
  proteinG: "g",
  totalFatG: "g",
  saturatedFatG: "g",
  transFatG: "g",
  sodiumMg: "mg",
  fibreG: "g",
};

export function emptyNutrition(): Nutrition {
  return Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, null])) as Nutrition;
}
