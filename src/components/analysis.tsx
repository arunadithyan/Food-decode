"use client";
import Link from "next/link";
import { useState } from "react";
import { BookOpen, ChevronDown, ExternalLink } from "lucide-react";
import { useApp } from "./AppProvider";
import { ProvBadge, Sheet } from "./ui";
import { parseIngredients, splitStatements } from "@/lib/ingredients/parse";
import { insLookup } from "@/lib/kb/ins";
import { LESSON_FOR_TAG, lessonById } from "@/lib/i18n/lessons";
import { DAILY_REFERENCE } from "@/lib/nutrition/reference";
import { fmt, forPortion, per100Band, goodBand, portionPresets, servingsIn, shareOfReference, portionShareBand, unitOf } from "@/lib/nutrition/calc";
import { sodiumMgToSaltG } from "@/lib/nutrition/reference";
import { priorityName, type Assessment, type Finding } from "@/lib/rules/suitability";
import { NUTRIENT_LABEL, NUTRIENT_UNIT, type NutrientKey, type Product } from "@/lib/types";
import type { StringKey } from "@/lib/i18n/strings";

/* ---------------- verdict ---------------- */
const LEVEL_ORDER = { NO: 0, CAUTION: 1, INFO: 2, OK: 3 } as const;

function lessonFor(f: Finding): string | null {
  const key = f.nutrients?.[0] || (f.tags?.includes("diet") ? "diet" : f.tags?.length ? "allergen" : f.priority === 6 ? "ingredients" : f.priority === 5 ? "portion" : null);
  return key ? LESSON_FOR_TAG[key] || null : null;
}

function FindingRow({ f }: { f: Finding }) {
  const { lang } = useApp();
  const lesson = lessonFor(f);
  const ltitle = lesson ? lessonById(lesson)?.text[lang].title : null;
  return (
    <li className="finding">
      <div className="t"><span className={`lvl ${f.level}`}>{f.level}</span><span>{f.title}</span></div>
      {f.detail && <p className="small">{f.detail}</p>}
      {f.evidence.length > 0 && (
        <dl className="evid">
          {f.evidence.map((e, i) => (<div key={i} style={{ display: "contents" }}><dt>{e.label}</dt><dd>{e.value}</dd></div>))}
        </dl>
      )}
      {f.action && <p className="small"><b>What you can do:</b> {f.action}</p>}
      <p className="rule-src">Rule ({priorityName(f.priority)}): {f.rule} Source: {f.source}</p>
      {lesson && ltitle && <Link className="link small" href={`/learn/${lesson}`}><BookOpen size={14} style={{ display: "inline", verticalAlign: "-2px" }} /> {ltitle}</Link>}
    </li>
  );
}

export function VerdictCard({ a, product }: { a: Assessment; product: Product }) {
  const { t } = useApp();
  const [all, setAll] = useState(false);
  const findings = [...a.findings].sort((x, y) => LEVEL_ORDER[x.level] - LEVEL_ORDER[y.level] || x.priority - y.priority);
  const key = findings.filter((f) => f.level === "NO" || f.level === "CAUTION");
  const rest = findings.filter((f) => f.level !== "NO" && f.level !== "CAUTION");
  const subKey = `status${a.status}sub` as StringKey;
  return (
    <section className={`verdict ${a.status}`} aria-labelledby="verdict-h" data-testid="verdict" data-status={a.status}>
      <div className="spread">
        <span className="stamp" aria-hidden>{t(`status${a.status}` as StringKey)}</span>
        <span className="small" title={a.confidence.reasons.join(" ")}>
          {t("confidence")}: <span className={`conf ${a.confidence.level}`} aria-hidden><i /><i /><i /></span> <b>{a.confidence.level}</b>
        </span>
      </div>
      <h2 id="verdict-h" className="head">{a.headline}</h2>
      <p className="small">{t(subKey)} · {fmt(a.portion.amount)} {a.portion.unit}{a.portion.servings != null ? ` (${fmt(a.portion.servings, 1)} serving${Math.abs(a.portion.servings - 1) < 0.02 ? "" : "s"})` : ""}</p>
      {key.length > 0 && <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 8 }}>{key.map((f) => <FindingRow key={f.id} f={f} />)}</ul>}
      {rest.length > 0 && (
        <>
          <button className="btn ghost sm" onClick={() => setAll(!all)} aria-expanded={all} style={{ alignSelf: "flex-start" }}>
            <ChevronDown style={{ transform: all ? "rotate(180deg)" : undefined }} /> {all ? "Hide" : "Show"} {rest.length} other check{rest.length === 1 ? "" : "s"}
          </button>
          {all && <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 8 }}>{rest.map((f) => <FindingRow key={f.id} f={f} />)}</ul>}
        </>
      )}
      <details className="card tight" style={{ boxShadow: "none" }}>
        <summary>{t("whyThis")}</summary>
        <div className="stack small" style={{ marginTop: 10, gap: 10 }}>
          <p>FoodDecode applies fixed rules in this order and the most serious result decides the answer: <b>1 allergens → 2 diet and intolerances → 3 limits from your clinician → 4 your goals → 5 portion facts → 6 missing information</b>. NO beats CAUTION beats YES. CAUTION is used whenever information is missing, unclear, or depends on medical advice.</p>
          {a.considered.length > 0 ? <p><b>From your profile, this check considered:</b> {a.considered.join("; ")}.</p> : <p><b>Your profile is empty</b>, so only general label facts were checked. <Link className="link" href="/profile">Add allergies, diet or goals</Link> to personalise.</p>}
          <p><b>Data used:</b> <ProvBadge p={product.provenance} /> {product.source.verificationStatus}{product.source.checkedDate ? `, checked ${product.source.checkedDate}` : ""}.</p>
          <p><b>Confidence is {a.confidence.level}:</b> {a.confidence.reasons.join(" ")}</p>
          <p className="muted">Explanations are generated from rules and numbers on the label — not by an AI model — and are never a diagnosis. Reference values are listed on the <Link className="link" href="/about#reference">About data</Link> page.</p>
        </div>
      </details>
    </section>
  );
}

/* ---------------- portion ---------------- */
const PRESET_KEY: Record<string, StringKey> = { "1 serving": "oneServing", "2 servings": "twoServings", "Half pack": "halfPack", "Full pack": "fullPack" };

export function PortionControl({ product, amount, setAmount }: { product: Product; amount: number; setAmount(n: number): void }) {
  const { t } = useApp();
  const u = unitOf(product);
  const presets = portionPresets(product);
  const max = Math.max(product.packSize || 0, (product.servingSize || 0) * 4, 300);
  const servings = servingsIn(product, amount);
  const p = forPortion(product.nutrition, amount);
  const stats: NutrientKey[] = ["energyKcal", "addedSugarG", "sodiumMg", "saturatedFatG"];
  return (
    <section className="portion" aria-labelledby="portion-h">
      <div className="spread"><span className="eyebrow">{t("portion")}</span>{servings != null && <span className="small">{fmt(servings, 1)} × {fmt(product.servingSize)} {u} serving</span>}</div>
      <h2 id="portion-h">How much will you have?</h2>
      <div className="chips" role="group" aria-label="Portion presets">
        {presets.map((pr) => (
          <button key={pr.label} className="chip" aria-pressed={Math.abs(pr.amount - amount) < 0.05} onClick={() => setAmount(pr.amount)}>
            {PRESET_KEY[pr.label] ? t(PRESET_KEY[pr.label]) : pr.label} <span className="mono" style={{ opacity: 0.75 }}>{fmt(pr.amount)} {u}</span>
          </button>
        ))}
      </div>
      <div className="ctrl">
        <input type="range" min={1} max={Math.round(max)} step={1} value={Math.min(amount, max)} onChange={(e) => setAmount(parseFloat(e.target.value))} aria-label={`${t("custom")} (${u})`} />
        <label className="amt"><span className="sr">{t("custom")}</span>
          <input type="number" inputMode="decimal" min={1} max={5000} value={Number(amount.toFixed(1))} onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v) && v > 0 && v <= 5000) setAmount(v); }} data-testid="portion-input" />
          <span>{u}</span>
        </label>
      </div>
      <div className="pgrid">
        {stats.map((k) => {
          const v = p[k];
          const share = v == null ? null : shareOfReference(k, v);
          return (
            <div className="pstat" key={k}>
              <span className="k">{NUTRIENT_LABEL[k]}</span>
              <span className="v">{v == null ? "?" : fmt(v)} <small>{NUTRIENT_UNIT[k]}</small></span>
              <span className="bar"><i style={{ width: `${Math.min(100, (share ?? 0) * 100)}%` }} /></span>
              <span className="pct">{share == null ? "not on label" : `${Math.round(share * 100)}% of daily ref.`}</span>
            </div>
          );
        })}
      </div>
      <p className="small" style={{ color: "rgba(255,255,255,.75)" }}>Daily reference values are those used on Indian labels (FSSAI), not personal targets or medical limits.</p>
    </section>
  );
}

/* ---------------- nutrition table ---------------- */
const ROWS: { k: NutrientKey; indent?: boolean }[] = [
  { k: "energyKcal" }, { k: "proteinG" }, { k: "carbohydratesG" }, { k: "sugarsG", indent: true }, { k: "addedSugarG", indent: true }, { k: "fibreG" },
  { k: "totalFatG" }, { k: "saturatedFatG", indent: true }, { k: "transFatG", indent: true }, { k: "sodiumMg" },
];

export function NutritionPanel({ product, amount }: { product: Product; amount: number }) {
  const u = unitOf(product);
  const p = forPortion(product.nutrition, amount);
  return (
    <div className="npanel" data-testid="nutrition-panel">
      <h4>Nutrition information</h4>
      <div className="sub">Per 100 {u} and for your portion ({fmt(amount)} {u}){product.servingSize ? ` · serving size ${fmt(product.servingSize)} ${u}` : " · serving size not stated"}</div>
      <table>
        <thead><tr><th scope="col">Nutrient</th><th scope="col">Per 100 {u}</th><th scope="col">Your portion</th><th scope="col">% daily ref.</th><th scope="col">Per-100 band</th></tr></thead>
        <tbody>
          {ROWS.map(({ k, indent }) => {
            const v100 = product.nutrition[k];
            const pv = p[k];
            const share = pv == null ? null : shareOfReference(k, pv);
            const band = per100Band(k, v100, u);
            const good = goodBand(k, v100, u);
            const unit = NUTRIENT_UNIT[k];
            return (
              <tr key={k} className={indent ? "indent" : undefined}>
                <td>{NUTRIENT_LABEL[k]} ({unit})</td>
                <td>{v100 == null ? <span title="Not stated on the label or in the record">–</span> : fmt(v100)}</td>
                <td>{pv == null ? "–" : fmt(pv)}</td>
                <td>{share == null || !DAILY_REFERENCE[k === "sugarsG" ? "addedSugarG" : k] || k === "sugarsG" ? "" : `${Math.round(share * 100)}%`}</td>
                <td>{band ? <span className={`pill ${band.code}`} title={band.rule}>{band.code}</span> : good ? <span className={`pill ${good.code === "none" ? "neutral" : "good"}`} title={good.rule}>{good.code === "none" ? "low" : good.code}</span> : ""}</td>
              </tr>
            );
          })}
          {product.nutrition.sodiumMg != null && (
            <tr className="indent"><td>≈ Salt (g) = sodium × 2.5</td><td>{fmt(sodiumMgToSaltG(product.nutrition.sodiumMg))}</td><td>{p.sodiumMg == null ? "–" : fmt(sodiumMgToSaltG(p.sodiumMg))}</td><td></td><td></td></tr>
          )}
        </tbody>
      </table>
      <div className="foot">“–” means the value is not on the label or in the record: it is unknown, not zero. Bands: UK FSA per-100 criteria; % uses FSSAI daily references.</div>
    </div>
  );
}

/* ---------------- ingredients ---------------- */
export function IngredientView({ product }: { product: Product }) {
  const [code, setCode] = useState<string | null>(null);
  const items = parseIngredients(product.ingredientsText);
  const st = splitStatements(product.ingredientsText, product.allergenStatement);
  const info = code ? insLookup(code) : null;
  if (!product.ingredientsText) return <p className="empty">No ingredient list in this record. Allergen and diet checks are marked as unknown — scan the pack&apos;s ingredient panel to check them.</p>;
  return (
    <div className="stack">
      <div className="ing" data-testid="ingredients">
        {items.map((it, i) =>
          it.type === "section" ? <span key={i} className="sect">{it.name}</span>
          : it.type === "additive" ? (
            <button key={i} className="it add" onClick={() => setCode(it.codes[0])} title="What is this additive?">
              {it.name} {it.codes.map((c) => <span key={c} className="code">INS {c}</span>)}
            </button>
          ) : <span key={i} className="it" title={it.gloss?.body}>{it.name}{it.pct && <span className="pc">{it.pct}%</span>}</span>,
        )}
      </div>
      {(st.contains.length > 0 || st.mayContain.length > 0) && (
        <div className="stack small" style={{ gap: 4 }}>
          {st.contains.map((s, i) => <p key={i}><b>Allergen statement:</b> {s}</p>)}
          {st.mayContain.map((s, i) => <p key={i}><b>Precautionary (cross-contact):</b> {s}</p>)}
        </div>
      )}
      <Sheet open={!!code} onClose={() => setCode(null)} title={info ? `INS ${info.key}: ${info.name}` : `INS ${code}`}>
        {info ? (
          <dl>
            <dt>Type</dt><dd>{info.cls}</dd>
            <dt>What it is</dt><dd>{info.what}</dd>
            <dt>Why it&apos;s used</dt><dd>{info.why}</dd>
            <dt>Good to know</dt><dd>{info.ctx}</dd>
          </dl>
        ) : <p>This code isn&apos;t in FoodDecode&apos;s additive list yet. It is an International Numbering System code for a food additive; FSSAI publishes which additives are permitted in which foods.</p>}
      </Sheet>
    </div>
  );
}

/* ---------------- source ---------------- */
export function SourceBox({ product }: { product: Product }) {
  const s = product.source;
  return (
    <dl className="srcbox">
      <dt>Data type</dt><dd><ProvBadge p={product.provenance} /></dd>
      <dt>Source</dt><dd>{s.url ? <a className="link" href={s.url} target="_blank" rel="noopener noreferrer">{s.name} <ExternalLink size={12} style={{ display: "inline" }} /></a> : s.name}</dd>
      {s.sourceType && (<><dt>Kind</dt><dd>{s.sourceType}</dd></>)}
      <dt>Status</dt><dd>{s.verificationStatus}</dd>
      {s.sourceDate && (<><dt>Record date</dt><dd>{s.sourceDate}</dd></>)}
      {s.checkedDate && (<><dt>Checked</dt><dd>{s.checkedDate}</dd></>)}
      {s.notes && (<><dt>Notes</dt><dd>{s.notes}</dd></>)}
      {product.unresolvedIssues && product.unresolvedIssues.length > 0 && (<><dt>Unresolved</dt><dd>{product.unresolvedIssues.join(" ")}</dd></>)}
      {product.provenance === "community" && (<><dt>Licence</dt><dd>Open Food Facts data is available under the Open Database License (ODbL); photos under CC BY-SA.</dd></>)}
    </dl>
  );
}
