"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { ErrorState, ProvBadge, Skeleton } from "@/components/ui";
import { getLocalProduct } from "@/lib/catalogue";
import { api, ApiError } from "@/lib/client/api";
import { defaultAmount, fmt } from "@/lib/nutrition/calc";
import { emptyProfile } from "@/lib/profile";
import { assess } from "@/lib/rules/suitability";
import type { ScanRecord } from "@/lib/server/repo";

export default function HistoryPage() {
  const { t, profile, consents } = useApp();
  const [scans, setScans] = useState<ScanRecord[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "YES" | "CAUTION" | "NO">("all");
  const load = () => api<{ scans: ScanRecord[] }>("/api/scans").then((r) => setScans(r.scans)).catch((e) => setErr(e instanceof ApiError ? e.message : "Could not load history."));
  useEffect(() => { load(); }, []);
  const prof = profile ?? emptyProfile();
  const rows = useMemo(() => (scans || []).flatMap((s) => {
    const p = s.product ?? (s.productId ? getLocalProduct(s.productId) : null);
    if (!p) return [];
    const amount = s.amount ?? defaultAmount(p);
    return [{ s, p, amount, status: assess(p, prof, amount).status }];
  }), [scans, prof]);
  const shown = rows.filter((r) => filter === "all" || r.status === filter);

  return (
    <div className="page">
      <h1>{t("navHistory")}</h1>
      <p className="small muted">Verdicts are recalculated with your current profile each time, so they change if your profile changes. Only you can see this list.</p>
      {!consents.scan_history && <p className="empty">Scan history is switched off — nothing is being saved. <Link className="link" href="/settings">Turn it on in Privacy &amp; Settings</Link>.</p>}
      {err && <ErrorState message={err} onRetry={load} />}
      {scans === null && !err ? <Skeleton h={180} /> : rows.length > 0 && (
        <>
          <div className="seg" role="group" aria-label="Filter">
            {(["all", "NO", "CAUTION", "YES"] as const).map((f) => <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === "all" ? "All" : f}</button>)}
          </div>
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 8 }} data-testid="history-list">
            {shown.map(({ s, p, amount, status }) => (
              <li key={s.id} className="card tight spread">
                <div className="stack" style={{ gap: 4 }}>
                  <Link className="link" href={`/product/${p.id}?amount=${amount}${s.kind === "ocr" ? `&h=${s.id}` : ""}`}>{p.name}</Link>
                  <span className="row small" style={{ gap: 6 }}><span className={`lvl ${status === "YES" ? "OK" : status}`}>{status}</span><ProvBadge p={p.provenance} /> {s.kind === "ocr" ? "Label scan" : "Looked up"} · {fmt(amount)} {p.unit} · {new Date(s.createdAt).toLocaleString()}</span>
                </div>
                <button className="btn ghost sm" aria-label={`Delete ${p.name} from history`} onClick={async () => { await api(`/api/scans/${s.id}`, { method: "DELETE" }); setScans((x) => x?.filter((y) => y.id !== s.id) ?? null); }}><Trash2 /></button>
              </li>
            ))}
          </ul>
          <div><button className="btn danger sm" onClick={async () => { if (confirm("Delete your whole scan history?")) { await api("/api/scans", { method: "DELETE" }); setScans([]); } }}><Trash2 /> Clear history</button></div>
        </>
      )}
      {scans && rows.length === 0 && consents.scan_history && <p className="empty">Nothing here yet. <Link className="link" href="/scan">Scan a label</Link> or open a product.</p>}
    </div>
  );
}
