"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Wand2 } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Banner } from "@/components/ui";
import { api } from "@/lib/client/api";
import { sessionStore, type PendingReview } from "@/lib/client/session-store";
import { FIELD_KEYS, type FieldKey, type ParsedLabel } from "@/lib/ocr/parser";
import { CRITICAL_FIELDS, draftToProduct, emptyValues, FIELD_LABEL, FIELD_UNIT, validateDraft, type Issue, type LabelDraft } from "@/lib/ocr/validate";

type Conf = "high" | "medium" | "low" | "none" | "edited";
const CONF_LABEL: Record<Conf, string> = { high: "Read clearly", medium: "Check this", low: "Low confidence — check carefully", none: "Not found", edited: "Entered by you" };

function fieldConf(k: FieldKey, parsed: ParsedLabel | null, issues: Issue[], edited: Set<string>, d: LabelDraft): Conf {
  if (edited.has(k)) return "edited";
  const v = d.values[k];
  if (v.per100 == null && v.perServing == null) return "none";
  const f = parsed?.fields[k];
  const mine = issues.filter((i) => i.field === k);
  const risky = f?.notes.some((n) => /ran together|leading zero|line after|header not found|letter O/.test(n));
  if (mine.some((i) => i.severity === "error") || risky || (f?.conf != null && f.conf < 60)) return "low";
  if (mine.some((i) => i.severity === "warning") || (f?.conf != null && f.conf < 85) || (f?.notes.length ?? 0) > 0) return "medium";
  return "high";
}

const blankDraft = (): LabelDraft => ({ name: "", brand: "", category: "Scanned label", unit: "g", values: emptyValues(), servingSize: null, servingsPerPack: null, packSize: null, ingredientsText: "", allergenStatement: "" });

export function ReviewView() {
  const router = useRouter();
  const manual = useSearchParams().get("manual") === "1";
  const { t, user, consents } = useApp();
  const [pending] = useState<PendingReview | null>(() => (manual ? null : sessionStore.getPending()));
  const [d, setD] = useState<LabelDraft>(() => pending?.draft ?? blankDraft());
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const [keep, setKeep] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const issues = useMemo(() => validateDraft(d), [d]);
  const parsed = pending?.parsed ?? null;
  const errors = issues.filter((i) => i.severity === "error");
  const hasPerServing = FIELD_KEYS.some((k) => d.values[k].perServing != null) || !!d.servingSize;

  if (!pending && !manual) {
    return (
      <div className="page">
        <h1>Nothing to review</h1>
        <p className="empty">There is no scan waiting for review in this tab. Photos and readings are kept only in memory while you work.</p>
        <div className="row"><Link className="btn primary" href="/scan">{t("scanFood")}</Link><Link className="btn" href="/scan/review?manual=1">Enter values by hand</Link></div>
      </div>
    );
  }

  const setVal = (k: FieldKey, basis: "per100" | "perServing", raw: string) => {
    const v = raw.trim() === "" ? null : parseFloat(raw.replace(",", "."));
    setD((x) => ({ ...x, values: { ...x.values, [k]: { ...x.values[k], [basis]: v != null && Number.isFinite(v) ? v : null } } }));
    setEdited((s) => new Set(s).add(k));
  };
  const apply = (i: Issue) => {
    if (!i.suggestion || !i.field) return;
    const val = i.suggestion.value;
    if (i.field === "servingSize" || i.field === "packSize" || i.field === "servingsPerPack") setD((x) => ({ ...x, [i.field as string]: val }));
    else if ((FIELD_KEYS as string[]).includes(i.field)) {
      const k = i.field as FieldKey;
      const basis = i.basis === "serving" ? "perServing" : "per100";
      setD((x) => ({ ...x, values: { ...x.values, [k]: { ...x.values[k], [basis]: val } } }));
    }
    setEdited((s) => new Set(s).add(i.field!));
  };

  async function confirm() {
    const id = `scan-${crypto.randomUUID()}`;
    const product = draftToProduct(d, issues, id);
    if (pending?.illustrative) {
      product.provenance = "illustrative";
      product.source = { ...product.source, name: "FoodDecode sample label (fictional)", verificationStatus: "Illustrative demo data — not a real product" };
    }
    sessionStore.putProduct(product);
    sessionStore.setPending(null);
    let h = "";
    if (user && consents.scan_history) {
      try {
        const r = await api<{ saved: boolean; scan?: { id: string } }>("/api/scans", { body: { kind: "ocr", product } });
        if (r.scan) h = `?h=${r.scan.id}`;
      } catch { /* history is optional */ }
    }
    router.push(`/product/${id}${h}`);
  }

  const num = (v: number | null) => (v == null ? "" : String(v));
  const rowClass = (k: FieldKey) => (issues.some((i) => i.field === k && i.severity === "error") ? "bad" : issues.some((i) => i.field === k && i.severity === "warning") ? "flagged" : "");

  return (
    <div className="page">
      <Link className="back" href="/scan"><ArrowLeft size={16} /> {t("retake")}</Link>
      <div className="steps" aria-label="Steps"><span className="done">1 Photo</span><span className="done">2 Read</span><span className="on">3 Verify</span><span>4 Your answer</span></div>
      <h1>{manual ? "Enter the label values" : t("reviewTitle")}</h1>
      {pending && (
        <p className="small muted">Read by {pending.engine} in {(pending.ms / 1000).toFixed(1)} s (best clean-up: {pending.variant}). Values are never filled in or changed without showing you — anything not found stays empty and is treated as unknown.</p>
      )}
      {pending?.illustrative && <Banner kind="warn">This is FoodDecode&apos;s fictional sample label. Results will be marked as illustrative.</Banner>}
      {pending && pending.qualityWarnings.length > 0 && <Banner kind="warn">{pending.qualityWarnings.map((w, i) => <span key={i}>{w}</span>)}</Banner>}
      {pending && pending.photoUrls.length > 0 && (
        <div className="thumbs">{pending.photoUrls.map((u, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <a key={u} href={u} target="_blank" rel="noreferrer" className="thumb" aria-label={`Open photo ${i + 1}`}><img src={u} alt="" /></a>
        ))}</div>
      )}

      <section className="card stack" aria-labelledby="prod-h">
        <h2 id="prod-h" className="h3">Product</h2>
        <div className="grid2">
          <div className="field"><label htmlFor="nm">Product name</label><input id="nm" className="input" value={d.name} maxLength={160} onChange={(e) => setD({ ...d, name: e.target.value })} /></div>
          <div className="field"><label htmlFor="br">Brand</label><input id="br" className="input" value={d.brand} maxLength={120} onChange={(e) => setD({ ...d, brand: e.target.value })} /></div>
        </div>
        <div className="grid3">
          <div className="field"><label htmlFor="un">Unit</label>
            <select id="un" className="input" value={d.unit} onChange={(e) => setD({ ...d, unit: e.target.value as "g" | "ml" })}><option value="g">g (solid)</option><option value="ml">ml (drink)</option></select></div>
          <div className="field"><label htmlFor="ss">{t("servingSize")} ({d.unit})</label><input id="ss" className={`input ${issues.some((i) => i.field === "servingSize" && i.severity === "error") ? "invalid" : ""}`} type="number" inputMode="decimal" value={num(d.servingSize)} onChange={(e) => { setD({ ...d, servingSize: e.target.value ? parseFloat(e.target.value) : null }); setEdited((s) => new Set(s).add("servingSize")); }} /></div>
          <div className="field"><label htmlFor="ps">Pack size ({d.unit})</label><input id="ps" className="input" type="number" inputMode="decimal" value={num(d.packSize)} onChange={(e) => setD({ ...d, packSize: e.target.value ? parseFloat(e.target.value) : null })} /></div>
        </div>
      </section>

      <section className="card stack" aria-labelledby="nv-h">
        <h2 id="nv-h" className="h3">Nutrition values</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="rvt" data-testid="review-table">
            <thead><tr><th scope="col">Nutrient</th><th scope="col">{t("per100")} {d.unit}</th>{hasPerServing && <th scope="col">{t("perServing")}</th>}<th scope="col">Status</th></tr></thead>
            <tbody>
              {FIELD_KEYS.map((k) => {
                const c = fieldConf(k, parsed, issues, edited, d);
                const notes = parsed?.fields[k]?.notes ?? [];
                return (
                  <tr key={k} className={rowClass(k)}>
                    <td><label htmlFor={`f-${k}-100`}>{FIELD_LABEL[k]}{CRITICAL_FIELDS.includes(k) ? "" : ""} <span className="muted small">({FIELD_UNIT[k]})</span></label>
                      {notes.length > 0 && <div className="small muted">{notes.join(" · ")}</div>}</td>
                    <td><input id={`f-${k}-100`} className="input" inputMode="decimal" value={num(d.values[k].per100)} onChange={(e) => setVal(k, "per100", e.target.value)} aria-label={`${FIELD_LABEL[k]} per 100 ${d.unit}`} data-testid={`f-${k}-100`} /></td>
                    {hasPerServing && <td><input className="input" inputMode="decimal" value={num(d.values[k].perServing)} onChange={(e) => setVal(k, "perServing", e.target.value)} aria-label={`${FIELD_LABEL[k]} per serving`} data-testid={`f-${k}-srv`} /></td>}
                    <td className="small"><span className={`cdot ${c === "edited" ? "high" : c}`} aria-hidden />{CONF_LABEL[c]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!hasPerServing && <button className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={() => setD({ ...d, servingSize: d.servingSize ?? 30 })}>Label also has a per-serving column</button>}
      </section>

      <section className="stack" aria-labelledby="iss-h" aria-live="polite">
        <h2 id="iss-h" className="h3">Checks ({errors.length} to fix, {issues.length - errors.length} to look at)</h2>
        {issues.length === 0 && <p className="okmsg"><CheckCircle2 size={16} style={{ display: "inline", verticalAlign: "-3px" }} /> All values are internally consistent.</p>}
        {issues.map((i) => (
          <div key={i.id} className={`issue ${i.severity}`} data-testid={`issue-${i.id}`}>
            <span className={`lvl ${i.severity === "error" ? "NO" : i.severity === "warning" ? "CAUTION" : "INFO"}`}>{i.severity}</span>
            <span style={{ flex: 1 }}>{i.message}</span>
            {i.suggestion && <button className="btn sm" onClick={() => apply(i)}><Wand2 /> {i.suggestion.label}</button>}
          </div>
        ))}
      </section>

      <section className="card stack" aria-labelledby="ing-h">
        <h2 id="ing-h" className="h3">{t("ingredients")} and allergen statement</h2>
        <div className="field"><label htmlFor="ing">Ingredient list</label><textarea id="ing" className="input" value={d.ingredientsText} maxLength={4000} onChange={(e) => setD({ ...d, ingredientsText: e.target.value })} /></div>
        <div className="field"><label htmlFor="alg">Allergen / “may contain” statement</label><textarea id="alg" className="input" style={{ minHeight: 60 }} value={d.allergenStatement} maxLength={1000} onChange={(e) => setD({ ...d, allergenStatement: e.target.value })} /></div>
        {parsed && parsed.insCodes.length > 0 && <p className="small muted">INS codes found: {parsed.insCodes.join(", ")}</p>}
      </section>

      {pending && (
        <details className="card tight"><summary onClick={() => setShowRaw(!showRaw)}>Show the raw text the OCR read</summary><pre className="raw">{pending.text || "(no text)"}</pre></details>
      )}

      <section className="card stack" style={{ borderColor: "var(--ink)" }}>
        {errors.length > 0 && (
          <label className="check"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} data-testid="keep-issues" />
            <span>I&apos;ve checked against the pack and want to continue with {errors.length} unresolved problem{errors.length === 1 ? "" : "s"}. The answer will be CAUTION until they are fixed.</span></label>
        )}
        <button className="btn primary block" onClick={confirm} disabled={errors.length > 0 && !keep} data-testid="confirm-values">{t("confirmValues")}</button>
        <p className="small muted">FoodDecode only gives YES/NO/CAUTION after you confirm. Values you leave empty stay unknown.</p>
      </section>
    </div>
  );
}
