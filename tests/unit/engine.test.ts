import { describe, expect, it } from "vitest";
import { getLocalProduct, PRODUCTS } from "@/lib/catalogue";
import { checkAllergen } from "@/lib/ingredients/allergens";
import { checkDiet } from "@/lib/ingredients/diet";
import { forPortion, portionPresets } from "@/lib/nutrition/calc";
import { saltGToSodiumMg, sodiumMgToSaltG } from "@/lib/nutrition/reference";
import { emptyProfile, validateProfile } from "@/lib/profile";
import { findAlternatives } from "@/lib/rules/alternatives";
import { assess } from "@/lib/rules/suitability";
import type { Product } from "@/lib/types";

const P = (id: string) => getLocalProduct(id)!;
const prof = (x: object) => validateProfile(x);
const peanut = prof({ allergies: { items: ["peanut"] } });
const sodium = prof({ conditions: { items: ["hypertension"] }, goals: ["reduce-sodium"] });
const fake = (patch: Partial<Product>): Product => ({ ...P("parle-g"), id: "t-fake", ...patch });

describe("allergen matching (priority 1)", () => {
  it("peanut allergy → NO when groundnut is an ingredient", () => {
    const a = assess(P("maggi-masala"), peanut, 70);
    expect(a.status).toBe("NO");
    expect(a.findings.find((f) => f.priority === 1 && f.level === "NO")?.evidence.map((e) => e.value).join(" ")).toMatch(/groundnut/i);
  });
  it("'may contain' statement → CAUTION, not NO", () => {
    const p = fake({ ingredientsText: "Wheat flour, sugar, palm oil.", allergenStatement: "May contain traces of peanuts." });
    const a = assess(p, peanut, 30);
    expect(a.status).toBe("CAUTION");
    expect(checkAllergen("peanut", p.ingredientsText, p.allergenStatement).kind).toBe("cross-contact");
  });
  it("missing ingredient list is unknown, never allergen-free", () => {
    const a = assess(fake({ ingredientsText: null, allergenStatement: null }), peanut, 30);
    expect(a.status).toBe("CAUTION");
    expect(checkAllergen("peanut", null, null).kind).toBe("unknown");
  });
  it("ambiguous sources (lecithin) are 'possible' soy, not confirmed", () => {
    expect(checkAllergen("soy", "Sugar, emulsifier (lecithin)", null).kind).toBe("possible");
    expect(checkAllergen("soy", "Sugar, soy lecithin", null).kind).toBe("confirmed");
  });
  it("cocoa butter and coconut milk are not milk; nutmeg is not a tree nut", () => {
    expect(checkAllergen("milk", "Sugar, cocoa butter, coconut milk powder", null).kind).toBe("none");
    expect(checkAllergen("tree-nuts", "Spices (nutmeg, clove)", null).kind).toBe("none");
  });
});

describe("dietary restrictions (priority 2)", () => {
  it("Jain → NO for onion and garlic", () => {
    const a = assess(P("maggi-masala"), prof({ diet: { pattern: "jain" } }), 70);
    expect(a.status).toBe("NO");
    expect(checkDiet("jain", P("maggi-masala").ingredientsText).verdict).toBe("conflict");
  });
  it("vegan → conflict for milk solids; vegetarian ok", () => {
    expect(checkDiet("vegan", "Sugar, milk solids, cocoa").verdict).toBe("conflict");
    expect(checkDiet("vegetarian", "Sugar, milk solids, cocoa").verdict).toBe("ok");
  });
  it("vegetarian → conflict for chicken; uncertain for INS 471", () => {
    expect(checkDiet("vegetarian", "Chicken extract, salt").verdict).toBe("conflict");
    expect(checkDiet("vegan", "Flour, emulsifier (471)").verdict).toBe("uncertain");
  });
  it("coeliac → NO for wheat flour", () => {
    expect(assess(P("parle-g"), prof({ conditions: { items: ["coeliac"] } }), 30).status).toBe("NO");
  });
});

describe("same food, different profiles", () => {
  it("Maggi: no restrictions YES, peanut allergy NO, Jain NO", () => {
    expect(assess(P("maggi-masala"), emptyProfile(), 70).status).toBe("YES");
    expect(assess(P("maggi-masala"), peanut, 70).status).toBe("NO");
  });
  it("Coca-Cola: diabetes + reduce sugar → CAUTION; empty profile → YES", () => {
    const d = prof({ conditions: { items: ["diabetes"] }, goals: ["reduce-sugar"] });
    expect(assess(P("coca-cola"), d, 300).status).toBe("CAUTION");
    expect(assess(P("coca-cola"), emptyProfile(), 300).status).toBe("YES");
  });
});

describe("portion calculations", () => {
  it("scales per-100 values linearly and keeps missing values missing", () => {
    const n = forPortion(P("haldiram-aloo-bhujia").nutrition, 90);
    expect(n.sodiumMg).toBeCloseTo((P("haldiram-aloo-bhujia").nutrition.sodiumMg! * 90) / 100, 5);
    expect(forPortion({ ...P("parle-g").nutrition, addedSugarG: null }, 50).addedSugarG).toBeNull();
  });
  it("30 g → YES but 90 g → CAUTION for a sodium-watching profile", () => {
    expect(assess(P("haldiram-aloo-bhujia"), sodium, 30).status).toBe("YES");
    expect(assess(P("haldiram-aloo-bhujia"), sodium, 90).status).toBe("CAUTION");
  });
  it("presets include serving, two servings, half and full pack", () => {
    const labels = portionPresets(P("maggi-masala")).map((p) => p.label);
    expect(labels).toEqual(expect.arrayContaining(["1 serving", "2 servings", "100 g"]));
  });
});

describe("clinician limits and conditions (priority 3)", () => {
  it("clinician per-portion sodium limit exceeded → NO; self-set → CAUTION", () => {
    const lim = (c: boolean) => prof({ limits: [{ id: "a", nutrient: "sodiumMg", amount: 500, per: "portion", clinicianAdvised: c }] });
    expect(assess(P("maggi-masala"), lim(true), 70).status).toBe("NO");
    expect(assess(P("maggi-masala"), lim(false), 70).status).toBe("CAUTION");
  });
  it("kidney disease is always CAUTION (label cannot answer it)", () => {
    expect(assess(P("parle-g"), prof({ conditions: { items: ["kidney"] } }), 10).status).toBe("CAUTION");
  });
});

describe("missing / unverified information (priority 6)", () => {
  it("illustrative data never gets YES", () => {
    expect(assess(fake({ provenance: "illustrative" }), emptyProfile(), 30).status).not.toBe("YES");
  });
  it("unresolved OCR issues → CAUTION", () => {
    expect(assess(fake({ provenance: "ocr-user-verified", unresolvedIssues: ["Saturated fat is more than total fat"] }), emptyProfile(), 30).status).toBe("CAUTION");
  });
  it("explanations carry rule, source and evidence", () => {
    const a = assess(P("maggi-masala"), peanut, 70);
    for (const f of a.findings) {
      expect(f.rule.length).toBeGreaterThan(10);
      expect(f.source.length).toBeGreaterThan(3);
    }
    expect(a.headline).toMatch(/^NO — /);
    expect(a.considered.join()).toMatch(/Peanut/);
  });
});

describe("alternatives", () => {
  it("peanut-allergic: Maggi → YiPPee (no peanut), never a NO product", () => {
    const alts = findAlternatives(P("maggi-masala"), peanut, 70, PRODUCTS);
    expect(alts.map((a) => a.product.id)).toContain("yippee");
    for (const a of alts) expect(a.assessment.status).not.toBe("NO");
  });
  it("sodium CAUTION at 90 g namkeen → a lower-sodium real product", () => {
    const alts = findAlternatives(P("haldiram-aloo-bhujia"), sodium, 90, PRODUCTS);
    expect(alts.length).toBeGreaterThan(0);
    for (const a of alts) expect(a.product.nutrition.sodiumMg!).toBeLessThan(P("haldiram-aloo-bhujia").nutrition.sodiumMg!);
  });
  it("returns nothing (not an invented product) when no candidate qualifies", () => {
    expect(findAlternatives(P("maggi-masala"), sodium, 70, PRODUCTS)).toEqual([]);
  });
});

describe("sodium vs salt", () => {
  it("salt = sodium × 2.5", () => {
    expect(sodiumMgToSaltG(1000)).toBeCloseTo(2.5);
    expect(saltGToSodiumMg(5)).toBeCloseTo(2000);
  });
});

describe("Ask FoodDecode (rule-based Q&A ported from the prototype)", async () => {
  const { answer } = await import("@/lib/kb/ask");
  it("explains INS codes and numeric questions without medical advice", () => {
    expect(answer("What does INS 330 mean?")[0].text).toMatch(/330/);
    expect(answer("Is 600 mg sodium a lot?").map((p) => p.text).join(" ")).toMatch(/30%/);
    expect(answer("Can I eat this with diabetes?")[0].text).toMatch(/doctor/);
  });
});
