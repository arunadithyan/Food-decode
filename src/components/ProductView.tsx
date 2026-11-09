"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Columns2, Flag, Sparkles } from "lucide-react";
import { useApp } from "./AppProvider";
import { IngredientView, NutritionPanel, PortionControl, SourceBox, VerdictCard } from "./analysis";
import { Banner, Disclaimer, ErrorState, PageSkeleton, ProvBadge, Sheet } from "./ui";
import { useProduct } from "./useProduct";
import { AteThis } from "./AteThis";
import { PRODUCTS } from "@/lib/catalogue";
import { api, ApiError } from "@/lib/client/api";
import { defaultAmount, fmt, unitOf } from "@/lib/nutrition/calc";
import { emptyProfile } from "@/lib/profile";
import { findAlternatives, type Alternative } from "@/lib/rules/alternatives";
import { assess } from "@/lib/rules/suitability";
import { NUTRIENT_LABEL, NUTRIENT_UNIT, type Product } from "@/lib/types";

export function AltList({ alts, amount, unit }: { alts: Alternative[]; amount: number; unit: string }) {
  return (
    <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 10 }} data-testid="alternatives">
      {alts.map((a) => (
        <li key={a.product.id} className="card tight alt">
          <div className="stack" style={{ gap: 6 }}>
            <Link className="link" href={`/product/${a.product.id}?amount=${amount}`}>{a.product.brand} — {a.product.name}</Link>
            <div className="row" style={{ gap: 6 }}><span className={`lvl ${a.assessment.status === "YES" ? "OK" : a.assessment.status}`}>{a.assessment.status}</span><ProvBadge p={a.product.provenance} /><span className="small muted">at {fmt(amount)} {unit}</span></div>
            <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
              {a.improvements.map((i) => (
                <li key={i.key}>{NUTRIENT_LABEL[i.key]}: <span className="mono">{fmt(i.from)} → {fmt(i.to)} {NUTRIENT_UNIT[i.key]}</span></li>
              ))}
            </ul>
          </div>
          <Link className="btn ghost sm" href={`/compare?a=${a.product.id}`} aria-label={`Compare with ${a.product.name}`}><Columns2 /></Link>
        </li>
      ))}
    </ul>
  );
}

function ReportSheet({ product, open, onClose }: { product: Product; open: boolean; onClose(): void }) {
  const [field, setField] = useState("sodiumMg");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const send = async () => {
    try {
      await api("/api/corrections", { body: { productId: product.id, field, value, note } });
      setMsg("Thanks — your report is saved for review. It does not change the data until it is checked against the label.");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Could not send.");
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Report a wrong value">
      <div className="field"><label htmlFor="rf">Which value?</label>
        <select id="rf" className="input" value={field} onChange={(e) => setField(e.target.value)}>
          {Object.entries(NUTRIENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          <option value="ingredientsText">Ingredients</option><option value="servingSize">Serving size</option><option value="other">Something else</option>
        </select>
      </div>
      <div className="field"><label htmlFor="rv">What does the pack say?</label><input id="rv" className="input" value={value} onChange={(e) => setValue(e.target.value)} maxLength={200} /></div>
      <div className="field"><label htmlFor="rn">Note (optional)</label><input id="rn" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></div>
      {msg && <p className="small">{msg}</p>}
      <button className="btn primary" onClick={send} disabled={!value.trim()}>Send report</button>
    </Sheet>
  );
}

export function ProductView({ id }: { id: string }) {
  const sp = useSearchParams();
  const [state, retry] = useProduct(id, sp.get("h"));
  const { user, profile, profileLoaded, consents, t } = useApp();
  const [amount, setAmount] = useState<number | null>(null);
  const [report, setReport] = useState(false);
  const logged = useRef(false);
  const product = state.status === "ok" ? state.product : null;

  useEffect(() => {
    if (!product || amount != null) return;
    const q = parseFloat(sp.get("amount") || "");
    setAmount(Number.isFinite(q) && q > 0 ? q : defaultAmount(product));
  }, [product, amount, sp]);

  // record a "lookup" in scan history (only if the user switched history on)
  useEffect(() => {
    if (!product || !user || !consents.scan_history || logged.current || product.id.startsWith("scan-")) return;
    logged.current = true;
    api("/api/scans", { body: { kind: "lookup", productId: product.id, product: product.provenance === "community" ? product : undefined } }).catch(() => {});
  }, [product, user, consents.scan_history]);

  const prof = profile ?? emptyProfile();
  const a = useMemo(() => (product && amount ? assess(product, prof, amount) : null), [product, prof, amount]);
  const alts = useMemo(() => (product && amount && a && a.status !== "YES" ? findAlternatives(product, prof, amount, PRODUCTS) : []), [product, prof, amount, a]);

  if (state.status === "loading" || !profileLoaded) return <PageSkeleton />;
  if (state.status === "error") return <div className="page"><ErrorState title="Can't show this product" message={state.message} onRetry={state.code === "off_unavailable" || state.code === "offline" ? retry : undefined} /><Link className="back" href="/search"><ArrowLeft size={16} /> Search products</Link></div>;
  if (!product || !amount || !a) return <PageSkeleton />;
  const u = unitOf(product);

  return (
    <div className="page">
      <Link className="back" href="/search"><ArrowLeft size={16} /> {t("navSearch")}</Link>
      <header className="phead">
        <span className="eyebrow">{product.category}</span>
        <h1>{product.name}</h1>
        <div className="facts">
          <span>{product.brand}</span>
          {product.packSize ? <span>Pack <b>{fmt(product.packSize)} {u}</b></span> : null}
          <span>Serving <b>{product.servingSize ? `${fmt(product.servingSize)} ${u}` : "not stated"}</b></span>
          <ProvBadge p={product.provenance} />
        </div>
      </header>

      {product.provenance === "illustrative" && <Banner kind="warn">This is a fictional demo label. FoodDecode never gives a YES on illustrative data.</Banner>}
      {product.provenance === "community" && <Banner kind="info">Community data from Open Food Facts. It has not been checked against the pack by FoodDecode and is never treated as medically verified.</Banner>}
      {user === null && <Banner kind="info"><span><Link className="link" href={`/login?next=/product/${id}`}>Log in</Link> and add your profile to get a personal YES / NO / CAUTION. Below are general label facts.</span></Banner>}
      {user && !profile && <Banner kind="info"><span>No health profile yet — <Link className="link" href="/onboarding">add allergies, diet or goals</Link> to personalise this.</span></Banner>}

      <VerdictCard a={a} product={product} />
      <PortionControl product={product} amount={amount} setAmount={setAmount} />
      <AteThis product={product} amount={amount} />

      {a.status !== "YES" && (
        <section className="stack" aria-labelledby="alt-h">
          <div className="section-h"><h2 id="alt-h"><Sparkles size={20} style={{ display: "inline", verticalAlign: "-3px" }} /> {t("recommendedAlternatives")}</h2>{alts.length > 0 && <Link className="link small" href={`/alternatives/${product.id}?amount=${amount}`}>Details →</Link>}</div>
          {alts.length ? <AltList alts={alts} amount={amount} unit={u} /> : <p className="empty" data-testid="no-alternatives">{t("noAlternatives")}</p>}
        </section>
      )}

      <section className="stack" aria-labelledby="nut-h"><h2 id="nut-h" className="h2">{t("nutrition")}</h2><NutritionPanel product={product} amount={amount} /></section>
      <section className="stack" aria-labelledby="ing-h"><h2 id="ing-h" className="h2">{t("ingredients")}</h2><IngredientView product={product} /></section>
      <section className="card stack" aria-labelledby="src-h">
        <h2 id="src-h" className="h3">{t("dataSource")}</h2>
        <SourceBox product={product} />
        <div className="row">
          <Link className="btn sm" href={`/compare?a=${product.id}`}><Columns2 /> {t("compareWith")}</Link>
          {user && product.provenance !== "ocr-user-verified" && <button className="btn ghost sm" onClick={() => setReport(true)}><Flag /> Report a wrong value</button>}
        </div>
      </section>
      <Disclaimer />
      {user && <ReportSheet product={product} open={report} onClose={() => setReport(false)} />}
    </div>
  );
}
