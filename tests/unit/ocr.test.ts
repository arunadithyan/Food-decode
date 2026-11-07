import { describe, expect, it } from "vitest";
import { parseLabel } from "@/lib/ocr/parser";
import { draftFromParsed, draftToProduct, emptyValues, toNutritionPer100, validateDraft, type LabelDraft } from "@/lib/ocr/validate";
import { adaptiveThreshold, homography, applyH, invert, looksInverted, type Gray } from "@/lib/ocr/image";
import { mergeParsed } from "@/lib/ocr/pipeline";

const TABLE = `NUTRITIONAL INFORMATION (Approx.)
Serving size: 30 g Servings per pack: 4
Nutrient Per 100 g Per serve %RDA*
Energy (kcal) 500 150 7.5%
Protein (g) 6.7 2.0
Carbohydrate (g) 68.3 20.5
Total Sugars (g) 30.0 9.0
Added Sugars (g) 26.7 8.0 16%
Total Fat (g) 23.3 7.0 10.4%
Saturated Fat (g) 11.7 3.5 15.9%
Trans Fat (g) 0.1 0.03 1.5%
Sodium (mg) 600 180 9%
INGREDIENTS: Refined Wheat Flour (Maida), Sugar, Palm Oil, Sodium bicarbonate, Emulsifiers [INS 322, INS 471].
Contains Wheat, Milk and Soy. May contain traces of nuts.
Net Quantity: 120 g`;

const draft = (patch: Partial<LabelDraft> = {}): LabelDraft => ({ name: "x", brand: "", category: "", unit: "g", values: emptyValues(), servingSize: null, servingsPerPack: null, packSize: null, ingredientsText: "x", allergenStatement: "", ...patch });

describe("label parser", () => {
  const p = parseLabel(TABLE);
  it("reads both columns and ignores %RDA values", () => {
    expect(p.columns).toEqual(["100", "serving"]);
    expect(p.fields.energyKcal).toMatchObject({ per100: 500, perServing: 150 });
    expect(p.fields.addedSugarG).toMatchObject({ per100: 26.7, perServing: 8 });
    expect(p.fields.sodiumMg).toMatchObject({ per100: 600, perServing: 180 });
  });
  it("reads serving size, servings per pack, pack size, ingredients, allergen statement and INS codes", () => {
    expect(p.servingSize).toBe(30);
    expect(p.servingsPerPack).toBe(4);
    expect(p.packSize).toBe(120);
    expect(p.ingredientsText).toMatch(/^Refined Wheat Flour/);
    expect(p.allergenStatement).toMatch(/May contain traces of nuts/);
    expect(p.insCodes).toEqual(expect.arrayContaining(["322", "471"]));
  });
  it("does not read 'sodium bicarbonate' in the ingredient list as a sodium value", () => {
    expect(parseLabel("Sodium bicarbonate 500").fields.sodiumMg).toBeUndefined();
  });
  it("never invents missing values", () => {
    expect(p.fields.fibreG).toBeUndefined();
    expect(p.fields.saltG).toBeUndefined();
  });
  it("handles OCR output without spaces", () => {
    const r = parseLabel("Protein(g)8.2\nCarbodrateg71.9\nTotalFat12.5\nSodiummg1000");
    expect(r.fields.proteinG?.per100).toBe(8.2);
    expect(r.fields.carbohydratesG?.per100).toBe(71.9);
    expect(r.fields.totalFatG?.per100).toBe(12.5);
    expect(r.fields.sodiumMg?.per100).toBe(1000);
  });
  it("converts kJ and g-sodium with a visible note", () => {
    const r = parseLabel("Per 100 g\nEnergy (kJ) 2092\nSodium (g) 0.45");
    expect(r.fields.energyKcal?.per100).toBe(500);
    expect(r.fields.energyKcal?.notes.join()).toMatch(/kJ/);
    expect(r.fields.sodiumMg?.per100).toBe(450);
    expect(r.fields.sodiumMg?.notes.join()).toMatch(/converted to mg/);
  });
  it("reads 'Nil' as 0 and says so", () => {
    const r = parseLabel("Per 100 g\nTrans Fat (g) Nil");
    expect(r.fields.transFatG?.per100).toBe(0);
    expect(r.fields.transFatG?.notes.join()).toMatch(/Nil/);
  });
  it("splits run-together columns only when the serving ratio makes it unambiguous, and flags it", () => {
    const r = parseLabel("NUTRITION Per 100g/70g serve\nEnergy (kcal) 38426913%\nProtein (9) 8.25.711%");
    expect(r.fields.energyKcal).toMatchObject({ per100: 384, perServing: 269 });
    expect(r.fields.proteinG).toMatchObject({ per100: 8.2, perServing: 5.7 });
    expect(r.fields.energyKcal?.notes.join()).toMatch(/please check/);
  });
  it("monounsaturated fat is not read as saturated fat", () => {
    const r = parseLabel("Per 100 g\nMonounsaturated fatty acids 5.1\nSaturated fat 2.0");
    expect(r.fields.saturatedFatG?.per100).toBe(2);
  });
  it("merges several photos without overwriting the best reading", () => {
    const a = parseLabel("Per 100 g\nEnergy (kcal) 480\nProtein (g) 6");
    const b = parseLabel("INGREDIENTS: Wheat flour, sugar.");
    const m = mergeParsed([a, b]);
    expect(m.fields.energyKcal?.per100).toBe(480);
    expect(m.ingredientsText).toMatch(/Wheat flour/);
  });
});

describe("validation", () => {
  it("flags saturated > total fat and suggests a decimal fix without applying it", () => {
    const v = emptyValues();
    v.totalFatG = { per100: 23.3, perServing: null };
    v.saturatedFatG = { per100: 117, perServing: null };
    const d = draft({ values: v });
    const issues = validateDraft(d);
    const i = issues.find((x) => x.id === "fat-parts-100")!;
    expect(i.severity).toBe("error");
    expect(i.suggestion?.value).toBe(11.7);
    expect(d.values.saturatedFatG.per100).toBe(117); // untouched
  });
  it("flags sugars > carbohydrates and added > total sugars", () => {
    const v = emptyValues();
    v.carbohydratesG = { per100: 10, perServing: null };
    v.sugarsG = { per100: 12, perServing: null };
    v.addedSugarG = { per100: 15, perServing: null };
    const ids = validateDraft(draft({ values: v })).map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(["sugar-carbs-100", "added-sugar-100"]));
  });
  it("checks sodium against salt (salt = sodium × 2.5)", () => {
    const v = emptyValues();
    v.sodiumMg = { per100: 400, perServing: null };
    v.saltG = { per100: 2.5, perServing: null };
    expect(validateDraft(draft({ values: v })).some((i) => i.id === "sodium-salt-100")).toBe(true);
    v.saltG = { per100: 1.0, perServing: null };
    expect(validateDraft(draft({ values: v })).some((i) => i.id === "sodium-salt-100")).toBe(false);
  });
  it("salt alone is offered as a sodium suggestion but never silently converted", () => {
    const v = emptyValues();
    v.saltG = { per100: 1.25, perServing: null };
    const d = draft({ values: v });
    expect(toNutritionPer100(d).sodiumMg).toBeNull();
    expect(validateDraft(d).find((i) => i.id === "sodium-from-salt-100")?.suggestion?.value).toBe(500);
  });
  it("flags sodium that looks like grams, and per-100 vs per-serving mismatches", () => {
    const v = emptyValues();
    v.sodiumMg = { per100: 0.6, perServing: null };
    expect(validateDraft(draft({ values: v })).some((i) => i.id === "sodium-unit-100")).toBe(true);
    const w = emptyValues();
    w.fibreG = { per100: 15, perServing: 0.5 };
    const r = validateDraft(draft({ values: w, servingSize: 30 })).find((i) => i.id === "ratio-fibreG")!;
    expect(r.basis).toBe("100");
    expect(r.suggestion?.value).toBe(1.5);
  });
  it("flags impossible values and missing critical values", () => {
    const v = emptyValues();
    v.proteinG = { per100: 120, perServing: null };
    v.energyKcal = { per100: 2000, perServing: null };
    const ids = validateDraft(draft({ values: v })).map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(["gt100-proteinG", "energy-impossible", "missing-sodiumMg"]));
  });
  it("requires a serving size when per-serving values exist, and derives per-100 from it", () => {
    const v = emptyValues();
    v.sodiumMg = { per100: null, perServing: 120 };
    expect(validateDraft(draft({ values: v })).some((i) => i.id === "serving-missing")).toBe(true);
    expect(toNutritionPer100(draft({ values: v, servingSize: 40 })).sodiumMg).toBe(300);
  });
  it("confirmed draft becomes an ocr-user-verified product that keeps unresolved problems", () => {
    const d = draftFromParsed(parseLabel(TABLE), { name: "Biscuit" });
    const v = { ...d.values, saturatedFatG: { per100: 30, perServing: 3.5 } };
    const dd = { ...d, values: v };
    const p = draftToProduct(dd, validateDraft(dd), "scan-x");
    expect(p.provenance).toBe("ocr-user-verified");
    expect(p.unresolvedIssues!.length).toBeGreaterThan(0);
    expect(p.nutrition.energyKcal).toBe(500);
  });
});

describe("image preprocessing", () => {
  const img = (w: number, h: number, f: (x: number, y: number) => number): Gray => {
    const d = new Uint8ClampedArray(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[y * w + x] = f(x, y);
    return { width: w, height: h, data: d };
  };
  it("adaptive threshold separates dark text from a lighting gradient", () => {
    const g = img(200, 100, (x, y) => (x % 20 < 3 && y > 40 && y < 60 ? 40 + x / 4 : 120 + x / 2));
    const t = adaptiveThreshold(g);
    expect(t.data[50 * 200 + 1]).toBe(0); // stroke
    expect(t.data[10 * 200 + 10]).toBe(255); // background
  });
  it("detects light-on-dark labels", () => {
    const dark = img(100, 100, (x) => (x % 10 === 0 ? 240 : 30));
    expect(looksInverted(dark)).toBe(true);
    expect(looksInverted(invert(dark))).toBe(false);
  });
  it("homography maps the four corners exactly", () => {
    const src = [{ x: 10, y: 5 }, { x: 90, y: 12 }, { x: 95, y: 80 }, { x: 3, y: 70 }];
    const dst = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
    const H = homography(src, dst);
    src.forEach((s, i) => {
      const r = applyH(H, s);
      expect(r.x).toBeCloseTo(dst[i].x, 6);
      expect(r.y).toBeCloseTo(dst[i].y, 6);
    });
  });
});
