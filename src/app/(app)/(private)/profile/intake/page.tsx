"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Flame, NotebookPen, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Banner, PageSkeleton, Sheet } from "@/components/ui";
import { useDiary } from "@/components/useDiary";
import { searchLocal } from "@/lib/catalogue";
import { ApiError } from "@/lib/client/api";
import { sessionStore } from "@/lib/client/session-store";
import {
  addDays, entryFromProduct, fmtTarget, MEAL_LABEL, MEALS, mealForTime, ON_TRACK_BAND, TRACKED,
  type DiaryEntry, type DiaryEntryInput, type EntryUnit, type Meal,
} from "@/lib/diary";
import { defaultAmount, fmt, unitOf } from "@/lib/nutrition/calc";
import { NUTRIENT_LABEL, NUTRIENT_UNIT, type NutrientKey, type Product } from "@/lib/types";

const prettyDay = (d: string, today: string) =>
  d === today ? "Today" : d === addDays(today, -1) ? "Yesterday" : new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

const MANUAL_FIELDS: NutrientKey[] = ["proteinG", "carbohydratesG", "addedSugarG", "sodiumMg", "saturatedFatG", "fibreG"];

function AddFood({ day, onAdd }: { day: string; onAdd(e: DiaryEntryInput): Promise<void> }) {
  const [tab, setTab] = useState<"product" | "manual">("product");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Product | null>(null);
  const [amount, setAmount] = useState(0);
  const [meal, setMeal] = useState<Meal>(mealForTime());
  const [m, setM] = useState<{ name: string; amount: string; unit: EntryUnit; kcal: string; n: Partial<Record<NutrientKey, string>> }>({ name: "", amount: "1", unit: "serving", kcal: "", n: {} });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const results = useMemo(() => {
    const extra = sessionStore.listProducts().filter((p) => !q || `${p.name} ${p.brand}`.toLowerCase().includes(q.toLowerCase()));
    return [...extra, ...searchLocal(q, "")].slice(0, 8);
  }, [q]);

  const submit = async (e: DiaryEntryInput) => {
    setErr(null);
    setBusy(true);
    try {
      await onAdd(e);
      setPicked(null);
      setQ("");
      setM({ name: "", amount: "1", unit: "serving", kcal: "", n: {} });
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Could not add this.");
    } finally {
      setBusy(false);
    }
  };
  const num = (s: string | undefined) => (s == null || s.trim() === "" ? null : parseFloat(s.replace(",", ".")));

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="seg" role="group" aria-label="How to add">
        <button aria-pressed={tab === "product"} onClick={() => setTab("product")}><Search size={15} style={{ display: "inline", verticalAlign: "-2px" }} /> From products</button>
        <button aria-pressed={tab === "manual"} onClick={() => setTab("manual")}><NotebookPen size={15} style={{ display: "inline", verticalAlign: "-2px" }} /> Enter manually</button>
      </div>
      <div className="field"><label htmlFor="meal">Meal</label>
        <select id="meal" className="input" value={meal} onChange={(e) => setMeal(e.target.value as Meal)} data-testid="add-meal">
          {MEALS.map((x) => <option key={x} value={x}>{MEAL_LABEL[x]}</option>)}
        </select>
      </div>
      {tab === "product" ? (
        picked ? (
          <div className="stack" style={{ gap: 10 }}>
            <p><b>{picked.name}</b> <span className="muted small">{picked.brand}</span></p>
            <div className="chips">
              {picked.servingSize && <button className="chip" aria-pressed={amount === picked.servingSize} onClick={() => setAmount(picked.servingSize!)}>1 serving · {fmt(picked.servingSize)} {unitOf(picked)}</button>}
              {picked.servingSize && <button className="chip" aria-pressed={amount === picked.servingSize * 2} onClick={() => setAmount(picked.servingSize! * 2)}>2 servings</button>}
              {picked.packSize && <button className="chip" aria-pressed={amount === picked.packSize} onClick={() => setAmount(picked.packSize!)}>Full pack · {fmt(picked.packSize)} {unitOf(picked)}</button>}
            </div>
            <label className="row small" style={{ gap: 8 }}>Amount <input className="input" style={{ width: 110 }} type="number" min={1} value={amount || ""} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} data-testid="add-amount" /> {unitOf(picked)}</label>
            <p className="small muted">≈ {fmt(((picked.nutrition.energyKcal ?? 0) * amount) / 100)} kcal{picked.nutrition.energyKcal == null ? " (calories not stated for this product)" : ""}</p>
            <div className="row">
              <button className="btn primary" disabled={busy || amount <= 0 || picked.nutrition.energyKcal == null} onClick={() => submit(entryFromProduct(picked, amount, day, meal))} data-testid="add-product-submit"><Plus /> Add to {MEAL_LABEL[meal].toLowerCase()}</button>
              <button className="btn ghost" onClick={() => setPicked(null)}>Back</button>
            </div>
          </div>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            <input className="input" type="search" placeholder="Search FoodDecode products or your scans" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" data-testid="add-search" />
            <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 4 }}>
              {results.map((p) => (
                <li key={p.id}><button className="btn ghost sm" style={{ width: "100%", justifyContent: "flex-start" }} onClick={() => { setPicked(p); setAmount(defaultAmount(p)); }}>{p.brand} — {p.name}</button></li>
              ))}
            </ul>
            <p className="small muted">Not here? Use “Enter manually” for home-cooked food, or <Link className="link" href="/scan">scan the label</Link> and tap “I ate this”.</p>
          </div>
        )
      ) : (
        <form className="stack" style={{ gap: 10 }} onSubmit={(e) => {
          e.preventDefault();
          const nutrients: Partial<Record<NutrientKey, number | null>> = { energyKcal: num(m.kcal) };
          for (const k of MANUAL_FIELDS) nutrients[k] = num(m.n[k]);
          submit({ day, meal, source: "manual", name: m.name, amount: num(m.amount) ?? 0, unit: m.unit, nutrients });
        }}>
          <div className="field"><label htmlFor="mn">What did you eat?</label><input id="mn" className="input" maxLength={120} value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} placeholder="e.g. 2 chapatis with dal" required data-testid="manual-name" /></div>
          <div className="grid3">
            <div className="field"><label htmlFor="ma">Amount</label><input id="ma" className="input" type="number" min={0.1} step="any" value={m.amount} onChange={(e) => setM({ ...m, amount: e.target.value })} required /></div>
            <div className="field"><label htmlFor="mu">Unit</label>
              <select id="mu" className="input" value={m.unit} onChange={(e) => setM({ ...m, unit: e.target.value as EntryUnit })}>
                <option value="serving">serving(s)</option><option value="piece">piece(s)</option><option value="g">g</option><option value="ml">ml</option>
              </select></div>
            <div className="field"><label htmlFor="mk">Calories (kcal) — total</label><input id="mk" className="input" type="number" min={0} step="any" value={m.kcal} onChange={(e) => setM({ ...m, kcal: e.target.value })} required data-testid="manual-kcal" /></div>
          </div>
          <details><summary className="small">Add more nutrients (optional)</summary>
            <div className="grid3" style={{ marginTop: 10 }}>
              {MANUAL_FIELDS.map((k) => (
                <div className="field" key={k}><label htmlFor={`mf-${k}`}>{NUTRIENT_LABEL[k]} ({NUTRIENT_UNIT[k]})</label><input id={`mf-${k}`} className="input" type="number" min={0} step="any" value={m.n[k] ?? ""} onChange={(e) => setM({ ...m, n: { ...m.n, [k]: e.target.value } })} /></div>
              ))}
            </div>
          </details>
          <p className="small muted">Totals for the whole amount you ate. Leave a nutrient empty if you don’t know it — it is counted as unknown, not zero.</p>
          <div><button className="btn primary" disabled={busy} data-testid="manual-submit"><Plus /> Add to {MEAL_LABEL[meal].toLowerCase()}</button></div>
        </form>
      )}
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  );
}

function EditEntry({ entry, onSave, onClose }: { entry: DiaryEntry; onSave(e: DiaryEntryInput): Promise<void>; onClose(): void }) {
  const [amount, setAmount] = useState(String(entry.amount));
  const [meal, setMeal] = useState<Meal>(entry.meal);
  const save = async () => {
    const a = parseFloat(amount);
    if (!(a > 0)) return;
    const f = a / entry.amount; // nutrients scale with the amount
    const nutrients = Object.fromEntries(Object.entries(entry.nutrients).map(([k, v]) => [k, v == null ? null : Math.round(v * f * 10) / 10]));
    const { id: _id, createdAt: _c, ...rest } = entry;
    await onSave({ ...rest, amount: a, meal, nutrients });
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={`Edit: ${entry.name}`}>
      <div className="field"><label htmlFor="ea">Amount ({entry.unit})</label><input id="ea" className="input" type="number" min={0.1} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      <div className="field"><label htmlFor="em">Meal</label><select id="em" className="input" value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>{MEALS.map((x) => <option key={x} value={x}>{MEAL_LABEL[x]}</option>)}</select></div>
      <p className="small muted">Nutrients are rescaled to the new amount.</p>
      <button className="btn primary" onClick={save}>Save</button>
    </Sheet>
  );
}

export default function IntakePage() {
  const { profileLoaded } = useApp();
  const d = useDiary();
  const [day, setDay] = useState(d.today);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [targetDraft, setTargetDraft] = useState<string | null>(null);
  const [tErr, setTErr] = useState<string | null>(null);

  if (!profileLoaded) return <PageSkeleton />;
  if (!d.enabled) {
    return (
      <div className="page">
        <div className="tabs-row"><Link href="/profile" className="link">← Health profile</Link></div>
        <h1>My intake</h1>
        <section className="card stack">
          <h2 className="h3">Keep a food diary</h2>
          <p>Log what you eat — from any product page with “I ate this”, or by hand — and see your calories for each day, what is left against your target, and your streak.</p>
          <ul className="small" style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>
            <li>Stored encrypted and visible only to you; included in your data download.</li>
            <li>Off by default. Turning it off later deletes the whole diary.</li>
            <li>Targets are general reference values unless you set your own or your doctor gave you one.</li>
          </ul>
          <div><button className="btn primary" onClick={d.enable} data-testid="enable-diary">Turn on my food diary</button></div>
        </section>
      </div>
    );
  }
  if (!d.entries) return <PageSkeleton />;

  const totals = d.totalsFor(day);
  const status = d.statusFor(day);
  const et = d.targets.energyKcal!;
  const eaten = totals.totals.energyKcal;
  const left = et.value - eaten;
  const pct = Math.min(1.25, eaten / et.value);
  const dayEntries = d.entries.filter((e) => e.day === day);
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(d.today, i - 13));
  const maxBar = Math.max(et.value * 1.25, ...last14.map((x) => d.totalsFor(x).totals.energyKcal));

  return (
    <div className="page">
      <div className="tabs-row" role="navigation" aria-label="Profile sections">
        <Link href="/profile" className="chip">Health profile</Link>
        <span className="chip" aria-current="page" style={{ background: "var(--teal)", color: "#fff", borderColor: "var(--teal)" }}>My intake</span>
      </div>
      <div className="spread">
        <h1>My intake</h1>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn ghost sm" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day"><ChevronLeft /></button>
          <b data-testid="intake-day" style={{ minWidth: 110, textAlign: "center" }}>{prettyDay(day, d.today)}</b>
          <button className="btn ghost sm" onClick={() => setDay(addDays(day, 1))} disabled={day >= d.today} aria-label="Next day"><ChevronRight /></button>
          {day !== d.today && <button className="btn sm" onClick={() => setDay(d.today)}>Today</button>}
        </div>
      </div>
      {d.error && <Banner kind="warn">{d.error}</Banner>}

      <section className="card stack" aria-labelledby="cal-h" data-testid="calorie-card">
        <div className="spread">
          <h2 id="cal-h" className="h3">Calories</h2>
          <span className="small muted">Target: {fmt(et.value)} kcal · {et.basis === "reference" ? "general reference" : et.basis === "own" ? "your target" : et.basis === "clinician" ? "from your doctor" : "your profile limit"}</span>
        </div>
        <div className="row" style={{ alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: "var(--display)", fontSize: 46, fontWeight: 800 }} data-testid="kcal-eaten">{fmt(eaten)}</span>
          <span className="muted">/ {fmt(et.value)} kcal eaten</span>
        </div>
        <div className="progress" style={{ height: 14 }} aria-label={`${Math.round((eaten / et.value) * 100)}% of target`}>
          <i style={{ width: `${(pct / 1.25) * 100}%`, background: eaten > et.value * ON_TRACK_BAND.high ? "var(--amber)" : "var(--teal)" }} />
        </div>
        <p data-testid="kcal-left"><b>{left >= 0 ? `${fmt(left)} kcal left` : `${fmt(-left)} kcal over target`}</b>{day === d.today && left > 0 ? " for today" : ""}. {!status.logged ? "Nothing logged for this day yet." : day === d.today && !status.onTrack && (status.energyPct ?? 0) < ON_TRACK_BAND.low && status.overLimits.length === 0 ? "The day is still in progress." : status.reason + "."}</p>
        {totals.missing.energyKcal > 0 && <p className="small muted">Calories unknown for {totals.missing.energyKcal} item(s).</p>}
        {targetDraft === null ? (
          <button className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={() => setTargetDraft(String(d.settings.energyTargetKcal ?? et.value))}><Pencil /> Set my own calorie target</button>
        ) : (
          <form className="row" onSubmit={async (e) => {
            e.preventDefault();
            setTErr(null);
            try { await d.setTarget(targetDraft.trim() ? parseFloat(targetDraft) : null); setTargetDraft(null); } catch (x) { setTErr(x instanceof ApiError ? x.message : "Could not save."); }
          }}>
            <label className="row small" style={{ gap: 6 }}>Daily target <input className="input" style={{ width: 110 }} type="number" min={800} max={6000} value={targetDraft} onChange={(e) => setTargetDraft(e.target.value)} data-testid="target-input" /> kcal</label>
            <button className="btn sm primary">Save</button>
            {d.settings.energyTargetKcal != null && <button type="button" className="btn sm ghost" onClick={async () => { await d.setTarget(null); setTargetDraft(null); }}>Use default</button>}
            <button type="button" className="btn sm ghost" onClick={() => setTargetDraft(null)}>Cancel</button>
            {tErr && <span className="err">{tErr}</span>}
          </form>
        )}
      </section>

      <section className="grid3" aria-label="Streaks" data-testid="streaks">
        <div className="card tight stack" style={{ gap: 4 }}>
          <span className="small muted"><Flame size={15} style={{ display: "inline", verticalAlign: "-2px", color: "var(--amber)" }} /> On-track streak</span>
          <span style={{ fontFamily: "var(--display)", fontSize: 34, fontWeight: 800 }} data-testid="streak-on-track">{d.streak.onTrack} day{d.streak.onTrack === 1 ? "" : "s"}</span>
          <span className="small muted">Best: {d.streak.bestOnTrack}</span>
        </div>
        <div className="card tight stack" style={{ gap: 4 }}>
          <span className="small muted">Logging streak</span>
          <span style={{ fontFamily: "var(--display)", fontSize: 34, fontWeight: 800 }} data-testid="streak-logging">{d.streak.logging} day{d.streak.logging === 1 ? "" : "s"}</span>
          <span className="small muted">Days in a row with anything logged</span>
        </div>
        <div className="card tight stack small" style={{ gap: 4 }}>
          <b>What counts as on track?</b>
          <span className="muted">Calories between {Math.round(ON_TRACK_BAND.low * 100)}% and {Math.round(ON_TRACK_BAND.high * 100)}% of your target, and no daily limit (sugar, sodium, saturated fat) passed. Today counts once it qualifies.</span>
        </div>
      </section>

      <section className="card stack" aria-labelledby="nut-h">
        <h2 id="nut-h" className="h3">Nutrients {prettyDay(day, d.today).toLowerCase() === "today" ? "today" : "this day"}</h2>
        {TRACKED.filter((k) => k !== "energyKcal").map((k) => {
          const t = d.targets[k];
          const v = totals.totals[k];
          const share = t ? v / t.value : null;
          const over = t?.kind === "limit" && v > t.value;
          return (
            <div key={k} className="stack" style={{ gap: 4 }}>
              <div className="spread small"><span><b>{NUTRIENT_LABEL[k]}</b> {fmt(v)} {NUTRIENT_UNIT[k]}{totals.missing[k] > 0 && totals.count > 0 ? <span className="muted"> · unknown for {totals.missing[k]} item(s)</span> : null}</span>
                <span className="muted">{t ? `${fmtTarget(t)}${t.basis === "clinician" ? " (doctor)" : t.basis === "self-set" ? " (your limit)" : ""}` : "for information"}</span></div>
              {t && <div className="progress" style={{ height: 8 }}><i style={{ width: `${Math.min(100, (share ?? 0) * 100)}%`, background: over ? "var(--red)" : "var(--teal)" }} /></div>}
              {over && <span className="small" style={{ color: "var(--red)" }}>Over the daily {t!.basis === "reference" ? "reference" : "limit"} by {fmt(v - t!.value)} {NUTRIENT_UNIT[k]}</span>}
            </div>
          );
        })}
        <p className="small muted">Reference values are FSSAI label references for an average adult, not personal advice. Limits you add to your health profile (per day) replace them.</p>
      </section>

      <section className="stack" aria-labelledby="log-h">
        <div className="section-h"><h2 id="log-h">What you ate</h2><button className="btn primary sm" onClick={() => setAdding(true)} data-testid="add-food"><Plus /> Add food</button></div>
        {dayEntries.length === 0 ? <p className="empty">Nothing logged {day === d.today ? "today" : "on this day"}. Tap “Add food”, or “I ate this” on any product page.</p> : (
          MEALS.filter((ml) => dayEntries.some((e) => e.meal === ml)).map((ml) => {
            const items = dayEntries.filter((e) => e.meal === ml);
            return (
              <div key={ml} className="card tight stack" style={{ gap: 6 }}>
                <div className="spread"><b>{MEAL_LABEL[ml]}</b><span className="small muted">{fmt(items.reduce((a, e) => a + (e.nutrients.energyKcal ?? 0), 0))} kcal</span></div>
                <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 4 }} data-testid={`meal-${ml}`}>
                  {items.map((e) => (
                    <li key={e.id} className="spread small">
                      <span>{e.productId && !e.productId.startsWith("scan-") ? <Link className="link" href={`/product/${e.productId}?amount=${e.amount}`}>{e.name}</Link> : e.name} <span className="muted">· {fmt(e.amount)} {e.unit === "serving" ? "serving(s)" : e.unit === "piece" ? "piece(s)" : e.unit}{e.source === "manual" ? " · entered by you" : ""}</span></span>
                      <span className="row" style={{ gap: 4 }}><span className="mono">{e.nutrients.energyKcal == null ? "?" : fmt(e.nutrients.energyKcal)} kcal</span>
                        <button className="btn ghost sm" aria-label={`Edit ${e.name}`} onClick={() => setEditing(e)}><Pencil /></button>
                        <button className="btn ghost sm" aria-label={`Delete ${e.name}`} onClick={() => d.remove(e.id)}><Trash2 /></button></span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </section>

      <section className="card stack" aria-labelledby="hist-h">
        <h2 id="hist-h" className="h3">Last 14 days</h2>
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(14, 1fr)", gap: 6, alignItems: "end", height: 160 }} data-testid="history-chart">
          <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: `${(et.value / maxBar) * 100}%`, borderTop: "2px dashed var(--ink-2)", opacity: 0.5 }} />
          {last14.map((x) => {
            const tt = d.totalsFor(x);
            const st = d.statusFor(x);
            return (
              <button key={x} onClick={() => setDay(x)} title={`${prettyDay(x, d.today)}: ${fmt(tt.totals.energyKcal)} kcal${st.onTrack ? " — on track" : ""}`} aria-label={`${prettyDay(x, d.today)}: ${fmt(tt.totals.energyKcal)} kcal${st.onTrack ? ", on track" : ""}`}
                style={{ height: `${Math.max(2, (tt.totals.energyKcal / maxBar) * 100)}%`, background: st.onTrack ? "var(--teal)" : tt.count ? "var(--amber)" : "var(--line)", border: x === day ? "2px solid var(--ink)" : "none", borderRadius: 6, cursor: "pointer", padding: 0 }} />
            );
          })}
        </div>
        <div className="spread small muted"><span>{prettyDay(last14[0], d.today)}</span><span>Dashed line = your calorie target · teal = on track · amber = logged, not on track</span><span>Today</span></div>
      </section>

      <p className="disclaimer">The food diary helps you see patterns in what you log. It is not a diet plan or medical advice; for calorie or nutrient goals, talk to your doctor or a dietitian.</p>
      <Sheet open={adding} onClose={() => setAdding(false)} title={`Add food — ${prettyDay(day, d.today)}`}>
        <AddFood day={day} onAdd={async (e) => { await d.add(e); setAdding(false); }} />
      </Sheet>
      {editing && <EditEntry entry={editing} onClose={() => setEditing(null)} onSave={(e) => d.update(editing.id, e)} />}
    </div>
  );
}
