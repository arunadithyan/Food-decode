# Suitability and recommendation engine

Code: `src/lib/rules/suitability.ts` (`assess`), `src/lib/rules/alternatives.ts` (`findAlternatives`), with helpers in `src/lib/ingredients/*` and `src/lib/nutrition/*`. Pure TypeScript, no I/O, no randomness, no AI: the same product + profile + portion always gives the same result. Covered by `tests/unit/engine.test.ts`.

## Output

`Assessment = { status: YES | NO | CAUTION, headline, findings[], portion, confidence {level, reasons}, considered[] }`

Each finding has: priority (1–6), level (NO / CAUTION / INFO / OK), title, detail, **evidence** (label values, matched ingredient words, portion amounts), **rule** (in words), **source** (reference behind the rule), and an **action**. The UI shows these as the verdict card, “Show other checks”, and **“Why am I seeing this recommendation?”** (priority order, what in the profile was considered, data provenance, confidence reasons).

Headline wording: `YES — This product appears compatible with your selected dietary preferences and nutritional criteria for the chosen portion.` For an empty profile: `YES — Nothing in your profile conflicts…`. Otherwise `NO — <top finding>` / `CAUTION — <top finding>`.

## Status rule
Findings are sorted by priority; **any NO → NO; otherwise any CAUTION → CAUTION; otherwise YES.** CAUTION is used whenever information is incomplete, ambiguous, or the question depends on medical advice. Nothing is ever “universally safe”.

## Priorities

| # | Area | Rules |
|---|---|---|
| 1 | **Allergens** (10 + custom) | Allergen term in ingredients or a “Contains” statement → **NO**. “May contain / traces / shared facility” → **CAUTION** (cross-contact). Ambiguous source (e.g. lecithin/322 for soy, “nuts”, “vegetable protein”, oats for gluten) → **CAUTION**. No ingredient list or statement → **CAUTION** (*unknown ≠ allergen-free*). False friends excluded: cocoa butter, coconut milk, nutmeg, buckwheat, maltodextrin… |
| 2 | **Diet & intolerances** | Vegetarian / eggetarian / vegan / Jain: conflicting ingredient → **NO**; additives that can be animal- or plant-derived (471, 472e, 481/482, 542, 627/631/635, 901/904/913, mono-/diglycerides) → **CAUTION**; Jain-variable items (ginger, turmeric, yeast, unspecified spices) → CAUTION. Custom “avoid” words → NO/CAUTION. Coeliac: gluten → **NO**. Lactose intolerance / gluten sensitivity: contains → **CAUTION** (tolerance varies). |
| 3 | **Clinician-advised limits** | A per-portion limit exceeded → **NO**; a per-day limit where one portion uses ≥20% → **CAUTION**. Kidney disease → always **CAUTION** (potassium/phosphorus aren't on Indian labels; phosphate additives are listed as evidence). |
| 4 | **Your goals / conditions** | Reduce sodium (or hypertension/cardiovascular), reduce added sugar (or diabetes/prediabetes), reduce saturated fat (or high cholesterol/cardiovascular): portion supplies **≥20% of the daily reference → CAUTION**. Trans fat ≥20% of 2 g → CAUTION when fat-related. Monitor carbs/diabetes: carbohydrate for the portion shown (INFO — no diabetes threshold is assumed). Self-set targets: exceeded → CAUTION. Calorie goal: ≥20% of 2,000 kcal → CAUTION. Protein/fibre goals: INFO. |
| 5 | **Portion facts** | Energy, sodium, added sugar for the chosen amount (INFO). |
| 6 | **Missing / uncertain data** | A focus nutrient not stated → CAUTION. ≥3 of energy/sugars/sat fat/sodium missing → CAUTION. Illustrative data → CAUTION (never YES). Unresolved OCR issues → CAUTION. Energy inconsistency → INFO. |

**Portion changes the answer** because priority 3–4 rules use the nutrient amount *in the selected portion* (e.g. Haldiram's Aloo Bhujia for a sodium-watching profile: 30 g = 185 mg = 9% → YES; 90 g = 554 mg = 28% → CAUTION).

**Targets vs medical thresholds.** FoodDecode distinguishes three things and labels them in the UI: label reference values (FSSAI, same for everyone), targets the user sets, and limits the user says a clinician gave them. Only the last can produce NO for a nutrient. FoodDecode never invents a medical limit.

## Confidence
High: label-photo-checked or user-verified data, ingredients present. Medium: community data, or ≥2 key nutrients missing. Low: illustrative data, missing ingredient list when the profile needs it, unresolved scan issues.

## Reference values (documented, not invented)

| Value | Source |
|---|---|
| Energy 2,000 kcal; total fat 67 g; saturated fat 22 g; trans fat 2 g; added sugar 50 g; sodium 2,000 mg per day | FSSAI (Labelling & Display) Regulations 2020 reference values for %RDA on labels |
| Protein ≈50 g/day | ICMR-NIN 2020 adult RDA ≈ 46–54 g |
| Fibre 30 g/day | commonly used reference (used for INFO only) |
| Portion ≥20% of a daily reference = high, ≤5% = low | US FDA %DV “5/20” convention, applied to FSSAI references |
| Per-100 bands: solids sugars 5/22.5 g, fat 3/17.5 g, sat fat 1.5/5 g, sodium 120/600 mg; drinks sugars 2.5/11.25 g, fat 1.5/8.75 g, sat fat 0.75/2.5 g, sodium 120/300 mg | UK FSA front-of-pack criteria — used as an explicit framework because FSSAI's front-of-pack thresholds are not final |
| Protein 5/10 g, fibre 3/6 g per 100 g = “source of / high in” | Codex / FSSAI claim conditions |
| Salt = sodium × 2.5 | molar mass ratio NaCl/Na |
| Atwater 4/4/9 kcal per g (+2 fibre), ±15% tolerance | standard energy conversion factors |

## Alternatives
`findAlternatives(product, profile, amount, catalogue)` returns at most 3 **real** products from the FoodDecode catalogue:
1. same category and unit; never illustrative;
2. candidate must not be NO and must not be worse than the original;
3. if the original was blocked by allergens/diet (priority 1–2), the candidate must have no priority 1–2 NO/CAUTION;
4. it must improve the nutrients that triggered the CAUTION/NO by ≥15% **at the same portion**;
5. ranked by status, then improvement; sugar, sodium, saturated fat, protein, fibre, energy, allergens and serving size are compared side by side on `/alternatives/[id]`.
If nothing qualifies, the app says: *“No suitable alternative was found in the available product data.”*

## GenAI
None is used to produce or change verdicts. All explanation text is generated from rule templates and label numbers. (The prototype's optional AI answer in Ask FoodDecode was removed.)
