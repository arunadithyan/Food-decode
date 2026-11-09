import { describe, expect, it } from "vitest";
import { getLocalProduct } from "@/lib/catalogue";
import { addDays, dayStatus, dayTotals, DiaryValidationError, entryFromProduct, streaks, targetsFor, validateEntry, type DiaryEntry } from "@/lib/diary";
import { validateProfile } from "@/lib/profile";

const today = "2026-11-10";
let n = 0;
const entry = (day: string, kcal: number | null, extra: Record<string, number> = {}): DiaryEntry => ({
  id: `e${n++}`, createdAt: "", day, meal: "lunch", source: "manual", name: "x", amount: 1, unit: "serving", nutrients: { energyKcal: kcal, ...extra },
});

describe("food diary", () => {
  it("builds an entry from a product at the eaten portion", () => {
    const p = getLocalProduct("maggi-masala")!;
    const e = entryFromProduct(p, 140, today, "dinner");
    expect(e.nutrients.energyKcal).toBeCloseTo((p.nutrition.energyKcal! * 140) / 100, 1);
    expect(e.productId).toBe("maggi-masala");
  });
  it("validates entries: calories required, ranges, dates", () => {
    expect(() => validateEntry({ day: today, meal: "lunch", source: "manual", name: "dal", amount: 1, unit: "serving", nutrients: {} }, today)).toThrow(DiaryValidationError);
    expect(() => validateEntry({ day: "2020-01-01", meal: "lunch", source: "manual", name: "dal", amount: 1, unit: "serving", nutrients: { energyKcal: 200 } }, today)).toThrow(DiaryValidationError);
    const ok = validateEntry({ day: today, meal: "lunch", source: "manual", name: "<b>dal</b>", amount: 1, unit: "serving", nutrients: { energyKcal: 200, sodiumMg: "" } }, today);
    expect(ok.name).toBe("bdal/b");
    expect(ok.nutrients.sodiumMg).toBeNull();
  });
  it("sums a day and counts unknown values separately (unknown is not zero)", () => {
    const t = dayTotals(today, [entry(today, 300, { sodiumMg: 200 }), entry(today, 200), entry(addDays(today, -1), 999)]);
    expect(t.count).toBe(2);
    expect(t.totals.energyKcal).toBe(500);
    expect(t.totals.sodiumMg).toBe(200);
    expect(t.missing.sodiumMg).toBe(1);
  });
  it("targets: own target > profile per-day limit > FSSAI reference", () => {
    expect(targetsFor(null, null).energyKcal).toMatchObject({ value: 2000, basis: "reference" });
    const prof = validateProfile({ limits: [{ nutrient: "energyKcal", amount: 1800, per: "day", clinicianAdvised: true }, { nutrient: "sodiumMg", amount: 1500, per: "day", clinicianAdvised: true }] });
    expect(targetsFor(prof, null).energyKcal).toMatchObject({ value: 1800, basis: "clinician" });
    expect(targetsFor(prof, null).sodiumMg).toMatchObject({ value: 1500, kind: "limit" });
    expect(targetsFor(prof, { energyTargetKcal: 2200 }).energyKcal).toMatchObject({ value: 2200, basis: "own" });
  });
  it("on track = 80–110% of calories and no daily limit passed", () => {
    const tg = targetsFor(null, null);
    expect(dayStatus(dayTotals(today, [entry(today, 1900)]), tg).onTrack).toBe(true);
    expect(dayStatus(dayTotals(today, [entry(today, 1000)]), tg).onTrack).toBe(false);
    expect(dayStatus(dayTotals(today, [entry(today, 2400)]), tg).onTrack).toBe(false);
    expect(dayStatus(dayTotals(today, [entry(today, 1900, { sodiumMg: 2500 })]), tg)).toMatchObject({ onTrack: false, overLimits: ["sodiumMg"] });
  });
  it("streaks count back from today, and an unfinished today does not break them", () => {
    const tg = targetsFor(null, null);
    const days = [-5, -3, -2, -1].map((o) => entry(addDays(today, o), 1900));
    const s = streaks([...days, entry(today, 400)], tg, today);
    expect(s.onTrack).toBe(3); // -3, -2, -1 (today not yet on track; -4 missing)
    expect(s.logging).toBe(4); // today, -1, -2, -3
    expect(s.bestOnTrack).toBe(3);
    expect(streaks([...days, entry(today, 1950)], tg, today).onTrack).toBe(4);
    expect(streaks([], tg, today)).toMatchObject({ onTrack: 0, logging: 0 });
  });
});
