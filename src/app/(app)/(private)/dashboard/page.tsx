"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Columns2, ScanLine, Trash2 } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { AltList } from "@/components/ProductView";
import { IntakeSummary } from "@/components/IntakeSummary";
import { ProvBadge, Skeleton } from "@/components/ui";
import { getLocalProduct, PRODUCTS } from "@/lib/catalogue";
import { api } from "@/lib/client/api";
import { LESSONS } from "@/lib/i18n/lessons";
import { ALLERGEN_LABEL } from "@/lib/ingredients/allergens";
import { DIET_LABEL } from "@/lib/ingredients/diet";
import { defaultAmount } from "@/lib/nutrition/calc";
import { CONDITION_LABEL, emptyProfile, GOAL_LABEL, type HealthProfile } from "@/lib/profile";
import { findAlternatives } from "@/lib/rules/alternatives";
import { assess, type Status } from "@/lib/rules/suitability";
import type { ScanRecord, Comparison } from "@/lib/server/repo";
import type { NutrientKey, Product } from "@/lib/types";
import { NUTRIENT_LABEL } from "@/lib/types";
import type { StringKey } from "@/lib/i18n/strings";

interface Item { scan: ScanRecord; product: Product; status: Status; amount: number; flagged: NutrientKey[] }

function greetingKey(): StringKey {
  const h = new Date().getHours();
  return h < 12 ? "greetingMorning" : h < 17 ? "greetingAfternoon" : "greetingEvening";
}

function lessonPicks(p: HealthProfile | null): string[] {
  const out: string[] = [];
  if (!p) return ["read-label", "portion", "sodium"];
  if (p.allergies.items.length || p.allergies.custom.length) out.push("allergens");
  if (p.goals.includes("monitor-carbs") || p.conditions.items.includes("diabetes") || p.conditions.items.includes("prediabetes")) out.push("carbs");
  if (p.goals.includes("reduce-sodium") || p.conditions.items.includes("hypertension")) out.push("sodium");
  if (p.goals.includes("reduce-sugar")) out.push("sugar");
  if (p.goals.includes("reduce-satfat") || p.conditions.items.includes("high-cholesterol")) out.push("fats");
  for (const d of ["read-label", "serving-size", "portion"]) if (out.length < 3 && !out.includes(d)) out.push(d);
  return out.slice(0, 3);
}

export default function Dashboard() {
  const { t, user, profile, consents, lang } = useApp();
  const [scans, setScans] = useState<ScanRecord[] | null>(null);
  const [comparisons, setComparisons] = useState<Comparison[] | null>(null);
  const [greet, setGreet] = useState<StringKey>("greetingMorning");
  useEffect(() => setGreet(greetingKey()), []);
  useEffect(() => {
    if (!user) return;
    api<{ scans: ScanRecord[] }>("/api/scans").then((r) => setScans(r.scans)).catch(() => setScans([]));
    api<{ comparisons: Comparison[] }>("/api/comparisons").then((r) => setComparisons(r.comparisons)).catch(() => setComparisons([]));
  }, [user]);

  const prof = profile ?? emptyProfile();
  const items: Item[] = useMemo(() => (scans || []).flatMap((s) => {
    const product = s.product ?? (s.productId ? getLocalProduct(s.productId) : null);
    if (!product) return [];
    const amount = s.amount ?? defaultAmount(product);
    const a = assess(product, prof, amount);
    const flagged = [...new Set(a.findings.filter((f) => f.level === "NO" || f.level === "CAUTION").flatMap((f) => f.nutrients ?? []))];
    return [{ scan: s, product, status: a.status, amount, flagged }];
  }), [scans, prof]);
  const toReview = items.filter((i) => i.status !== "YES").slice(0, 4);
  const altFor = toReview.find((i) => i.product.provenance !== "illustrative");
  const alts = useMemo(() => (altFor ? findAlternatives(altFor.product, prof, altFor.amount, PRODUCTS) : []), [altFor, prof]);

  const week = items.filter((i) => Date.now() - new Date(i.scan.createdAt).getTime() < 7 * 86400_000);
  const flagCount = new Map<NutrientKey, number>();
  week.forEach((i) => i.flagged.forEach((k) => flagCount.set(k, (flagCount.get(k) || 0) + 1)));
  const topFlag = [...flagCount.entries()].sort((a, b) => b[1] - a[1])[0];

  const chips: string[] = profile ? [
    ...(profile.diet.pattern !== "none" ? [DIET_LABEL[profile.diet.pattern]] : []),
    ...profile.allergies.items.map((a) => `${ALLERGEN_LABEL[a]} allergy`),
    ...profile.allergies.custom.map((a) => `${a} allergy`),
    ...profile.conditions.items.map((c) => CONDITION_LABEL[c]),
    ...profile.goals.map((g) => GOAL_LABEL[g]),
  ] : [];

  return (
    <div className="page">
      <section className="hero" style={{ alignItems: "center" }}>
        <div className="hero-copy">
          <span className="eyebrow">{user?.username}</span>
          <h1 data-testid="greeting">{t(greet)}</h1>
          <Link className="btn primary" href="/scan" style={{ alignSelf: "flex-start" }}><ScanLine /> {t("scanFood")}</Link>
          <span className="small muted">{t("scanFoodSub")}</span>
        </div>
        <Image src="/illustrations/reader.webp" alt="" width={220} height={236} className="illus" style={{ justifySelf: "end", maxWidth: 220 }} />
      </section>

      <section className="card stack" aria-labelledby="prof-h">
        <div className="section-h"><h2 id="prof-h">{t("myProfile")}</h2><Link className="link small" href="/profile">{t("edit")} →</Link></div>
        {!profile ? <p className="small">No health profile yet. FoodDecode is checking general label facts only. <Link className="link" href="/onboarding">Personalise →</Link></p>
          : chips.length ? <div className="chips">{chips.map((c) => <span key={c} className="chip" style={{ cursor: "default" }}>{c}</span>)}</div>
          : <p className="small">Your profile has no restrictions or goals set.</p>}
      </section>

      <IntakeSummary />

      <section className="stack" aria-labelledby="recent-h">
        <div className="section-h"><h2 id="recent-h">{t("recentScans")}</h2><Link className="link small" href="/history">{t("navHistory")} →</Link></div>
        {scans === null ? <Skeleton h={64} /> : !consents.scan_history ? (
          <p className="empty">Scan history is off, so nothing is saved. <Link className="link" href="/settings">Turn it on</Link> to see recent scans here.</p>
        ) : items.length === 0 ? <p className="empty">No scans yet. <Link className="link" href="/scan">Scan your first label</Link>.</p> : (
          <div className="hist">{items.slice(0, 8).map((i) => (
            <Link key={i.scan.id} href={`/product/${i.product.id}?amount=${i.amount}${i.scan.kind === "ocr" ? `&h=${i.scan.id}` : ""}`}>
              <span><span className={`lvl ${i.status === "YES" ? "OK" : i.status}`} style={{ marginRight: 6 }}>{i.status}</span>{i.product.name}</span>
              <small>{new Date(i.scan.createdAt).toLocaleDateString()}</small>
            </Link>
          ))}</div>
        )}
      </section>

      {toReview.length > 0 && (
        <section className="stack" aria-labelledby="rev-h">
          <h2 id="rev-h" className="h2">{t("toReview")}</h2>
          <div className="plist">{toReview.map((i) => (
            <Link key={i.scan.id} className="pcard" href={`/product/${i.product.id}?amount=${i.amount}${i.scan.kind === "ocr" ? `&h=${i.scan.id}` : ""}`}>
              <span className="cat">{i.product.category}</span><span className="nm">{i.product.name}</span>
              <span className="pills"><span className={`lvl ${i.status}`}>{i.status}</span><ProvBadge p={i.product.provenance} /></span>
              {i.flagged.length > 0 && <span className="meta">Flagged: {i.flagged.map((k) => NUTRIENT_LABEL[k]).join(", ")}</span>}
            </Link>
          ))}</div>
        </section>
      )}

      {altFor && (
        <section className="stack" aria-labelledby="alt-h">
          <h2 id="alt-h" className="h2">{t("recommendedAlternatives")}</h2>
          <p className="small muted">Instead of {altFor.product.name}:</p>
          {alts.length ? <AltList alts={alts} amount={altFor.amount} unit={altFor.product.unit} /> : <p className="empty">{t("noAlternatives")}</p>}
        </section>
      )}

      <section className="stack" aria-labelledby="cmp-h">
        <div className="section-h"><h2 id="cmp-h">{t("savedComparisons")}</h2><Link className="link small" href="/compare"><Columns2 size={14} style={{ display: "inline" }} /> {t("navCompare")} →</Link></div>
        {comparisons === null ? <Skeleton h={40} /> : comparisons.length === 0 ? <p className="empty">No saved comparisons yet.</p> : (
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 6 }}>
            {comparisons.slice(0, 5).map((c) => {
              const a = getLocalProduct(c.a), b = getLocalProduct(c.b);
              return (
                <li key={c.id} className="card tight spread">
                  <Link className="link" href={`/compare?a=${c.a}&b=${c.b}&mode=${c.mode}${c.amount ? `&amount=${c.amount}` : ""}`}>{a?.name ?? c.a} vs {b?.name ?? c.b}</Link>
                  <button className="btn ghost sm" aria-label="Delete comparison" onClick={async () => { await api(`/api/comparisons/${c.id}`, { method: "DELETE" }); setComparisons((x) => x?.filter((y) => y.id !== c.id) ?? null); }}><Trash2 /></button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {consents.scan_history && week.length > 0 && (
        <section className="card soft stack" aria-labelledby="wk-h">
          <h2 id="wk-h" className="h3">{t("weeklyInsights")}</h2>
          <p>{week.length} product{week.length === 1 ? "" : "s"} checked; {week.filter((i) => i.status !== "YES").length} needed a closer look{topFlag ? `, most often for ${NUTRIENT_LABEL[topFlag[0]].toLowerCase()}` : ""}.</p>
          <p className="small muted">{t("weeklyNote")}</p>
        </section>
      )}

      <section className="stack" aria-labelledby="learn-h">
        <div className="section-h"><h2 id="learn-h">{t("teachMe")}</h2><Link className="link small" href="/learn">All lessons →</Link></div>
        <div className="lessons">{lessonPicks(profile).map((id) => {
          const l = LESSONS.find((x) => x.id === id)!;
          return <Link key={id} className="lesson" href={`/learn/${id}`}><span className="n">{l.mins} {t("minutes")}</span><span><b>{l.text[lang].title}</b><span>{l.text[lang].blurb}</span></span><ArrowRight size={16} style={{ marginLeft: "auto", flex: "none" }} /></Link>;
        })}</div>
      </section>
    </div>
  );
}
