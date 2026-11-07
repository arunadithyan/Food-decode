"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { ProvBadge } from "@/components/ui";
import { getLocalProduct, PRODUCTS } from "@/lib/catalogue";
import { api, ApiError } from "@/lib/client/api";
import { sessionStore } from "@/lib/client/session-store";
import { fmt, forPortion, unitOf } from "@/lib/nutrition/calc";
import { emptyProfile } from "@/lib/profile";
import { assess } from "@/lib/rules/suitability";
import { NUTRIENT_LABEL, NUTRIENT_UNIT, type NutrientKey, type Product } from "@/lib/types";

const KEYS: NutrientKey[] = ["energyKcal", "proteinG", "carbohydratesG", "sugarsG", "addedSugarG", "fibreG", "totalFatG", "saturatedFatG", "transFatG", "sodiumMg"];
const LOWER_BETTER: NutrientKey[] = ["energyKcal", "sugarsG", "addedSugarG", "totalFatG", "saturatedFatG", "transFatG", "sodiumMg"];
type Mode = "100" | "serving" | "amount";

export function CompareView() {
  const sp = useSearchParams();
  const router = useRouter();
  const { t, user, profile } = useApp();
  const get = (id: string | null): Product | null => (id ? getLocalProduct(id) ?? sessionStore.getProduct(id) : null);
  const [aId, setA] = useState(sp.get("a") || "");
  const [bId, setB] = useState(sp.get("b") || "");
  const [mode, setMode] = useState<Mode>((sp.get("mode") as Mode) || "100");
  const [amount, setAmount] = useState(parseFloat(sp.get("amount") || "") || 30);
  const [msg, setMsg] = useState<string | null>(null);
  const a = get(aId), b = get(bId);
  const options = [...PRODUCTS, ...sessionStore.listProducts().filter((p) => !getLocalProduct(p.id))];
  const sameUnit = a && b && unitOf(a) === unitOf(b);
  const amt = (p: Product) => (mode === "100" ? 100 : mode === "serving" ? p.servingSize ?? 100 : amount);
  const prof = profile ?? emptyProfile();
  const va = useMemo(() => (a ? assess(a, prof, amt(a)) : null), [a, prof, mode, amount]); // eslint-disable-line react-hooks/exhaustive-deps
  const vb = useMemo(() => (b ? assess(b, prof, amt(b)) : null), [b, prof, mode, amount]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (which: "a" | "b", id: string) => {
    which === "a" ? setA(id) : setB(id);
    const q = new URLSearchParams(sp.toString());
    q.set(which, id);
    router.replace(`/compare?${q.toString()}`, { scroll: false });
  };
  const save = async () => {
    try {
      await api("/api/comparisons", { body: { a: aId, b: bId, mode, amount: mode === "amount" ? amount : undefined } });
      setMsg("Saved to your dashboard.");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Could not save.");
    }
  };

  return (
    <div className="page">
      <h1>{t("navCompare")}</h1>
      <div className="cmp-head">
        {(["a", "b"] as const).map((w) => {
          const p = w === "a" ? a : b;
          return (
            <div key={w} className={`card ${w} stack`} style={{ gap: 8 }}>
              <label className="small" htmlFor={`sel-${w}`}>Product {w.toUpperCase()}</label>
              <select id={`sel-${w}`} className="input" value={w === "a" ? aId : bId} onChange={(e) => pick(w, e.target.value)} data-testid={`compare-${w}`}>
                <option value="">Choose…</option>
                {options.map((o) => <option key={o.id} value={o.id}>{o.brand} — {o.name}</option>)}
              </select>
              {p && <div className="row small" style={{ gap: 6 }}><ProvBadge p={p.provenance} />{(w === "a" ? va : vb) && <span className={`lvl ${(w === "a" ? va : vb)!.status === "YES" ? "OK" : (w === "a" ? va : vb)!.status}`}>{(w === "a" ? va : vb)!.status}</span>}<Link className="link" href={`/product/${p.id}`}>Open</Link></div>}
            </div>
          );
        })}
      </div>
      <div className="row">
        <div className="seg" role="group" aria-label="Compare by">
          <button aria-pressed={mode === "100"} onClick={() => setMode("100")}>Per 100 g/ml</button>
          <button aria-pressed={mode === "serving"} onClick={() => setMode("serving")}>Per serving</button>
          <button aria-pressed={mode === "amount"} onClick={() => setMode("amount")}>Same amount</button>
        </div>
        {mode === "amount" && <label className="row small" style={{ gap: 6 }}>Amount <input className="input" style={{ width: 90 }} type="number" min={1} value={amount} onChange={(e) => setAmount(Math.max(1, parseFloat(e.target.value) || 1))} /></label>}
      </div>
      {a && b && !sameUnit && <p className="small" style={{ color: "var(--amber)" }}>One is measured in g and the other in ml — a like-for-like comparison isn&apos;t exact.</p>}
      {mode === "serving" && a && b && <p className="small muted">Serving sizes differ ({fmt(a.servingSize)} vs {fmt(b.servingSize)}) — per-serving numbers are what the labels say, not equal amounts.</p>}
      {a && b ? (
        <section className="card">
          {KEYS.map((k) => {
            const x = forPortion(a.nutrition, amt(a))[k], y = forPortion(b.nutrition, amt(b))[k];
            const max = Math.max(x ?? 0, y ?? 0) || 1;
            return (
              <div className="cmprow" key={k}>
                <span className="nm">{NUTRIENT_LABEL[k]} <span className="muted small">({NUTRIENT_UNIT[k]})</span></span>
                <div className="cmpbars">
                  <div className="cmpbar a"><span className="track"><i style={{ width: `${((x ?? 0) / max) * 100}%` }} /></span><span className="v">{x == null ? "not stated" : fmt(x)}</span></div>
                  <div className="cmpbar b"><span className="track"><i style={{ width: `${((y ?? 0) / max) * 100}%` }} /></span><span className="v">{y == null ? "not stated" : fmt(y)}</span></div>
                </div>
              </div>
            );
          })}
          <ul className="diffs small" style={{ marginTop: 12 }}>
            {KEYS.filter((k) => LOWER_BETTER.includes(k)).map((k) => {
              const x = forPortion(a.nutrition, amt(a))[k], y = forPortion(b.nutrition, amt(b))[k];
              if (x == null || y == null || Math.max(x, y) === 0 || Math.abs(x - y) / Math.max(x, y) < 0.15) return null;
              return <li key={k}><b>{x < y ? a.name : b.name}</b> has less {NUTRIENT_LABEL[k].toLowerCase()} ({fmt(Math.min(x, y))} vs {fmt(Math.max(x, y))} {NUTRIENT_UNIT[k]}).</li>;
            })}
          </ul>
        </section>
      ) : <p className="empty">Choose two products to compare.</p>}
      {user && a && b && <div className="row"><button className="btn" onClick={save}><Save /> Save comparison</button>{msg && <span className="small" role="status">{msg}</span>}</div>}
    </div>
  );
}
