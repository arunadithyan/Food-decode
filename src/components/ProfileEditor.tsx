"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ALLERGENS, ALLERGEN_LABEL } from "@/lib/ingredients/allergens";
import { DIET_LABEL, DIET_PATTERNS, type DietPattern } from "@/lib/ingredients/diet";
import {
  ACTIVITY, AGE_RANGES, CONDITIONS, CONDITION_LABEL, GOALS, GOAL_LABEL, INTOLERANCES, INTOLERANCE_LABEL, LIMIT_NUTRIENTS,
  type HealthProfile, type NutrientLimit,
} from "@/lib/profile";
import { NUTRIENT_LABEL, NUTRIENT_UNIT, type NutrientKey } from "@/lib/types";
import { useApp } from "./AppProvider";

export type Section = "diet" | "allergies" | "conditions" | "goals" | "basics" | "notes";

const AGE_LABEL: Record<string, string> = { "18-29": "18–29", "30-44": "30–44", "45-59": "45–59", "60+": "60+", "prefer-not": "Prefer not to say" };
const ACT_LABEL: Record<string, string> = { sedentary: "Mostly sitting", moderate: "Moderately active", active: "Very active", "prefer-not": "Prefer not to say" };

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function CustomList({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange(v: string[]): void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && values.length < 12 && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className="field">
      <label>{label}</label>
      <div className="row" style={{ gap: 8 }}>
        <input className="input" style={{ flex: 1, minWidth: 160 }} value={draft} maxLength={60} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} aria-label={label} />
        <button type="button" className="btn sm" onClick={add} disabled={!draft.trim()}><Plus /> Add</button>
      </div>
      {values.length > 0 && (
        <div className="chips">
          {values.map((v) => (
            <button type="button" key={v} className="chip" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`}>{v} ✕</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProfileEditor({ value, onChange, sections }: { value: HealthProfile; onChange(p: HealthProfile): void; sections: Section[] }) {
  const { t } = useApp();
  const set = (patch: Partial<HealthProfile>) => onChange({ ...value, ...patch });
  const show = (s: Section) => sections.includes(s);

  const updateLimit = (i: number, patch: Partial<NutrientLimit>) => set({ limits: value.limits.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  return (
    <div className="stack" style={{ gap: 26 }}>
      {show("diet") && (
        <fieldset className="stack">
          <legend>{t("diet")}</legend>
          <div className="opt-grid" role="radiogroup">
            {DIET_PATTERNS.map((d) => (
              <label key={d} className="opt"><input type="radio" name="diet" checked={value.diet.pattern === d} onChange={() => set({ diet: { ...value.diet, pattern: d as DietPattern } })} />{DIET_LABEL[d]}</label>
            ))}
          </div>
          <CustomList label="Anything else you avoid (custom)" values={value.diet.customAvoid} onChange={(v) => set({ diet: { ...value.diet, customAvoid: v } })} placeholder="e.g. mushroom, palm oil" />
        </fieldset>
      )}

      {show("allergies") && (
        <>
          <fieldset className="stack">
            <legend>{t("allergies")}</legend>
            <p className="small muted">Pick allergies you have been told you have. FoodDecode answers NO if one is an ingredient, and CAUTION for “may contain” warnings or unclear ingredients. A label with no allergen statement is treated as unknown, never as allergen-free.</p>
            <div className="opt-grid">
              {ALLERGENS.map((a) => (
                <label key={a} className="opt"><input type="checkbox" checked={value.allergies.items.includes(a)} onChange={() => set({ allergies: { ...value.allergies, items: toggle(value.allergies.items, a) } })} />{ALLERGEN_LABEL[a]}</label>
              ))}
            </div>
            <CustomList label="Other allergies (custom)" values={value.allergies.custom} onChange={(v) => set({ allergies: { ...value.allergies, custom: v } })} placeholder="e.g. mustard, kiwi" />
          </fieldset>
          <fieldset className="stack">
            <legend>{t("intolerances")}</legend>
            <div className="opt-grid">
              {INTOLERANCES.map((a) => (
                <label key={a} className="opt"><input type="checkbox" checked={value.intolerances.items.includes(a)} onChange={() => set({ intolerances: { ...value.intolerances, items: toggle(value.intolerances.items, a) } })} />{INTOLERANCE_LABEL[a]}</label>
              ))}
            </div>
            <CustomList label="Other intolerances (custom)" values={value.intolerances.custom} onChange={(v) => set({ intolerances: { ...value.intolerances, custom: v } })} placeholder="e.g. fructose" />
          </fieldset>
        </>
      )}

      {show("conditions") && (
        <fieldset className="stack">
          <legend>{t("conditions")}</legend>
          <p className="small muted">Optional. This only changes which label facts FoodDecode highlights for you. It never diagnoses or suggests treatment.</p>
          <label className="check"><input type="checkbox" checked={value.conditions.preferNotToDisclose} onChange={(e) => set({ conditions: { items: [], custom: [], preferNotToDisclose: e.target.checked } })} />{t("preferNot")}</label>
          {!value.conditions.preferNotToDisclose && (
            <>
              <div className="opt-grid">
                {CONDITIONS.map((c) => (
                  <label key={c} className="opt"><input type="checkbox" checked={value.conditions.items.includes(c)} onChange={() => set({ conditions: { ...value.conditions, items: toggle(value.conditions.items, c) } })} />{CONDITION_LABEL[c]}</label>
                ))}
              </div>
              <CustomList label="Other (custom)" values={value.conditions.custom} onChange={(v) => set({ conditions: { ...value.conditions, custom: v } })} placeholder="e.g. PCOS" />
            </>
          )}
        </fieldset>
      )}

      {show("goals") && (
        <>
          <fieldset className="stack">
            <legend>{t("goals")}</legend>
            <div className="opt-grid">
              {GOALS.map((g) => (
                <label key={g} className="opt"><input type="checkbox" checked={value.goals.includes(g)} onChange={() => set({ goals: toggle(value.goals, g) })} />{GOAL_LABEL[g]}</label>
              ))}
            </div>
          </fieldset>
          <fieldset className="stack">
            <legend>{t("limits")}</legend>
            <p className="small muted">Only add a number your doctor or dietitian gave you, or one you set yourself (untick the box). FoodDecode never invents medical limits.</p>
            {value.limits.map((l, i) => (
              <div key={l.id} className="card tight stack" style={{ gap: 10 }}>
                <div className="grid3">
                  <div className="field"><label htmlFor={`ln${i}`}>Nutrient</label>
                    <select id={`ln${i}`} className="input" value={l.nutrient} onChange={(e) => updateLimit(i, { nutrient: e.target.value as NutrientKey })}>
                      {LIMIT_NUTRIENTS.map((n) => <option key={n} value={n}>{NUTRIENT_LABEL[n]}</option>)}
                    </select>
                  </div>
                  <div className="field"><label htmlFor={`la${i}`}>Amount ({NUTRIENT_UNIT[l.nutrient]})</label>
                    <input id={`la${i}`} className="input" type="number" inputMode="decimal" min={0} value={Number.isFinite(l.amount) ? l.amount : ""} onChange={(e) => updateLimit(i, { amount: parseFloat(e.target.value) })} />
                  </div>
                  <div className="field"><label htmlFor={`lp${i}`}>Per</label>
                    <select id={`lp${i}`} className="input" value={l.per} onChange={(e) => updateLimit(i, { per: e.target.value as "portion" | "day" })}>
                      <option value="portion">portion / meal</option>
                      <option value="day">day</option>
                    </select>
                  </div>
                </div>
                <div className="spread">
                  <label className="check"><input type="checkbox" checked={l.clinicianAdvised} onChange={(e) => updateLimit(i, { clinicianAdvised: e.target.checked })} />My doctor or dietitian advised this limit</label>
                  <button type="button" className="btn ghost sm" onClick={() => set({ limits: value.limits.filter((_, j) => j !== i) })}><Trash2 /> Remove</button>
                </div>
              </div>
            ))}
            {value.limits.length < 12 && (
              <div><button type="button" className="btn sm" onClick={() => set({ limits: [...value.limits, { id: `lim-${Date.now().toString(36)}`, nutrient: "sodiumMg", amount: NaN, per: "portion", clinicianAdvised: false }] })}><Plus /> Add a limit</button></div>
            )}
          </fieldset>
        </>
      )}

      {show("basics") && (
        <fieldset className="stack">
          <legend>About you (optional)</legend>
          <div className="grid2">
            <div className="field"><label htmlFor="age">Age range</label>
              <select id="age" className="input" value={value.ageRange ?? ""} onChange={(e) => set({ ageRange: (e.target.value || null) as HealthProfile["ageRange"] })}>
                <option value="">Not set</option>
                {AGE_RANGES.map((a) => <option key={a} value={a}>{AGE_LABEL[a]}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="act">Activity level</label>
              <select id="act" className="input" value={value.activity ?? ""} onChange={(e) => set({ activity: (e.target.value || null) as HealthProfile["activity"] })}>
                <option value="">Not set</option>
                {ACTIVITY.map((a) => <option key={a} value={a}>{ACT_LABEL[a]}</option>)}
              </select>
            </div>
          </div>
          <p className="small muted">Age and activity are not used to calculate verdicts — FoodDecode uses the same published label reference values for everyone. They help you keep context in your history.</p>
        </fieldset>
      )}

      {show("notes") && (
        <div className="field">
          <label htmlFor="notes">Private notes (only you can see these)</label>
          <textarea id="notes" className="input" maxLength={2000} value={value.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. Dietitian visit in March: keep sodium under 600 mg per meal." />
        </div>
      )}
    </div>
  );
}

/** Short human summary of what changed, stored with the profile history entry. */
export function summariseChange(before: HealthProfile | null, after: HealthProfile): string {
  if (!before) return "Profile created";
  const parts: string[] = [];
  const diff = <T,>(name: string, a: T[], b: T[], label: (x: T) => string) => {
    const added = b.filter((x) => !a.includes(x)).map(label);
    const removed = a.filter((x) => !b.includes(x)).map(label);
    if (added.length) parts.push(`${name} added: ${added.join(", ")}`);
    if (removed.length) parts.push(`${name} removed: ${removed.join(", ")}`);
  };
  if (before.diet.pattern !== after.diet.pattern) parts.push(`Diet: ${DIET_LABEL[after.diet.pattern]}`);
  diff("Allergies", before.allergies.items, after.allergies.items, (x) => ALLERGEN_LABEL[x]);
  diff("Custom allergies", before.allergies.custom, after.allergies.custom, (x) => x);
  diff("Intolerances", before.intolerances.items, after.intolerances.items, (x) => INTOLERANCE_LABEL[x]);
  diff("Conditions", before.conditions.items, after.conditions.items, (x) => CONDITION_LABEL[x]);
  diff("Goals", before.goals, after.goals, (x) => GOAL_LABEL[x]);
  if (JSON.stringify(before.limits) !== JSON.stringify(after.limits)) parts.push(`Limits: ${after.limits.length} set`);
  if (before.notes !== after.notes) parts.push("Notes edited");
  if (before.ageRange !== after.ageRange || before.activity !== after.activity) parts.push("Basics edited");
  return parts.join("; ") || "Saved without changes";
}

/** Drops half-filled limit rows before saving. */
export const cleanProfile = (p: HealthProfile): HealthProfile => ({ ...p, limits: p.limits.filter((l) => Number.isFinite(l.amount) && l.amount > 0) });
