"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { ProvBadge } from "@/components/ui";
import { CATEGORIES, searchLocal } from "@/lib/catalogue";
import { api, ApiError } from "@/lib/client/api";
import { fmt, per100Band, unitOf } from "@/lib/nutrition/calc";

interface OffHit { barcode: string; name: string; brand: string; image?: string; india: boolean }

export default function SearchPage() {
  const { t, online } = useApp();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [useOff, setUseOff] = useState(false);
  const [off, setOff] = useState<{ status: string; hits: OffHit[] } | null>(null);
  const local = useMemo(() => searchLocal(q, cat), [q, cat]);

  useEffect(() => {
    if (!useOff || q.trim().length < 2) { setOff(null); return; }
    const h = setTimeout(async () => {
      setOff({ status: "loading", hits: [] });
      try {
        const r = await api<{ off: OffHit[]; offStatus: string }>(`/api/products/search?q=${encodeURIComponent(q)}&off=1`);
        setOff({ status: r.offStatus, hits: r.off });
      } catch (e) {
        setOff({ status: e instanceof ApiError && e.code === "offline" ? "unavailable" : "unavailable", hits: [] });
      }
    }, 400);
    return () => clearTimeout(h);
  }, [q, useOff]);

  return (
    <div className="page">
      <h1>{t("navSearch")}</h1>
      <div className="searchbox"><Search aria-hidden /><input className="input" type="search" placeholder={t("searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("searchPlaceholder")} data-testid="search-input" /></div>
      <div className="chips" role="group" aria-label="Category">
        <button className="chip" aria-pressed={cat === ""} onClick={() => setCat("")}>All</button>
        {CATEGORIES.map((c) => <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      <p className="small muted">{local.length} product{local.length === 1 ? "" : "s"} in FoodDecode&apos;s checked catalogue (works offline).</p>
      <div className="plist">
        {local.map((p) => {
          const u = unitOf(p);
          const s = per100Band("sodiumMg", p.nutrition.sodiumMg, u), su = per100Band("sugarsG", p.nutrition.sugarsG, u);
          return (
            <Link key={p.id} className="pcard" href={`/product/${p.id}`}>
              <span className="cat">{p.category}</span><span className="nm">{p.name}</span>
              <span className="meta">{p.brand} · {fmt(p.nutrition.energyKcal)} kcal/100 {u}</span>
              <span className="pills">{su && <span className={`pill ${su.code}`}>sugar {su.code}</span>}{s && <span className={`pill ${s.code}`}>sodium {s.code}</span>}<ProvBadge p={p.provenance} /></span>
            </Link>
          );
        })}
      </div>
      <section className="card stack">
        <label className="check"><input type="checkbox" checked={useOff} onChange={(e) => setUseOff(e.target.checked)} disabled={!online} />{t("alsoOff")}</label>
        <p className="small muted">Open Food Facts is a crowdsourced database. FoodDecode shows these records as community data, caches them for a week, and never treats them as verified.</p>
        {off?.status === "loading" && <p className="small">{t("loading")}</p>}
        {off?.status === "unavailable" && <p className="small err">Open Food Facts can&apos;t be reached right now.</p>}
        {off?.status === "disabled" && <p className="small">Open Food Facts lookups are switched off on this server.</p>}
        {off?.status === "ok" && (off.hits.length === 0 ? <p className="small">No matches on Open Food Facts.</p> : (
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 6 }}>
            {off.hits.map((h) => (
              <li key={h.barcode}><Link className="link" href={`/product/off-${h.barcode}`}>{h.brand ? `${h.brand} — ` : ""}{h.name}</Link> <span className="small muted mono">{h.barcode}{h.india ? " · India" : ""}</span></li>
            ))}
          </ul>
        ))}
        <p className="small muted">Data © Open Food Facts contributors, ODbL.</p>
      </section>
    </div>
  );
}
