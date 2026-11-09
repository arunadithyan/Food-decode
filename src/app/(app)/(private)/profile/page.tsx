"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { History, Trash2 } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { IntakeSummary } from "@/components/IntakeSummary";
import { cleanProfile, ProfileEditor, summariseChange } from "@/components/ProfileEditor";
import { Banner, PageSkeleton, Sheet } from "@/components/ui";
import { api, ApiError } from "@/lib/client/api";
import { emptyProfile, type HealthProfile } from "@/lib/profile";

interface HistEntry { id: string; createdAt: string; summary: string }

export default function ProfilePage() {
  const { t, profile, profileLoaded, setProfile, consents, setConsentsLocal } = useApp();
  const [draft, setDraft] = useState<HealthProfile | null>(null);
  const [consent, setConsent] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistEntry[] | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => { if (profileLoaded && !draft) setDraft(profile ?? emptyProfile()); }, [profileLoaded, profile, draft]);
  const loadHistory = () => api<{ history: HistEntry[] }>("/api/profile/history").then((r) => setHistory(r.history)).catch(() => setHistory([]));
  useEffect(() => { loadHistory(); }, []);

  if (!profileLoaded || !draft) return <PageSkeleton />;
  const dirty = JSON.stringify(cleanProfile(draft)) !== JSON.stringify(profile ?? emptyProfile());

  async function save() {
    if (!draft) return;
    setBusy(true);
    setMsg(null);
    try {
      const clean = cleanProfile(draft);
      const r = await api<{ profile: HealthProfile }>("/api/profile", { method: "PUT", body: { profile: clean, consent: consents.health_data ? undefined : consent, summary: summariseChange(profile, clean) } });
      setProfile(r.profile);
      setDraft(r.profile);
      setConsentsLocal({ health_data: true });
      setMsg({ ok: true, text: t("saved") });
      loadHistory();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? e.message + (e.code === "invalid_profile" ? " " + ((e.body as { issues?: string[] })?.issues ?? []).join("; ") : "") : "Could not save." });
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    await api("/api/profile", { method: "DELETE" });
    setProfile(null);
    setDraft(emptyProfile());
    setConsentsLocal({ health_data: false });
    setHistory([]);
    setConfirmDel(false);
    setMsg({ ok: true, text: "Your health profile and its history were deleted." });
  }

  return (
    <div className="page">
      <div className="stack" style={{ gap: 8 }}>
        <span className="eyebrow">Private · encrypted · only you can see this</span>
        <h1>{t("myProfile")}</h1>
        <p className="lede">{t("profileIntro")}</p>
      </div>
      <div className="tabs-row" role="navigation" aria-label="Profile sections">
        <span className="chip" aria-current="page" style={{ background: "var(--teal)", color: "#fff", borderColor: "var(--teal)" }}>Health profile</span>
        <Link href="/profile/intake" className="chip" data-testid="tab-intake">My intake</Link>
      </div>
      <IntakeSummary />
      <Banner kind="info">{t("notMedical")}</Banner>
      <section className="card">
        <ProfileEditor value={draft} onChange={setDraft} sections={["diet", "allergies", "conditions", "goals", "basics", "notes"]} />
      </section>
      <section className="card stack" style={{ position: "sticky", bottom: 76, zIndex: 5 }}>
        {!consents.health_data && (
          <label className="check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />I agree to FoodDecode storing this health information (encrypted, visible only to me) to check labels for me.</label>
        )}
        <div className="row">
          <button className="btn primary" onClick={save} disabled={busy || !dirty || (!consents.health_data && !consent)} data-testid="save-profile">{busy ? t("saving") : t("save")}</button>
          {dirty && <button className="btn ghost" onClick={() => setDraft(profile ?? emptyProfile())}>{t("cancel")}</button>}
          {msg && <span className={msg.ok ? "okmsg" : "err"} role="status">{msg.text}</span>}
        </div>
      </section>

      <section className="stack" aria-labelledby="hist-h">
        <h2 id="hist-h" className="h2"><History size={20} style={{ display: "inline", verticalAlign: "-3px" }} /> Health history</h2>
        <p className="small muted">Each save is kept as a dated entry so you can see how your restrictions and goals changed. Only you can see it; deleting your profile deletes it too.</p>
        {history === null ? null : history.length === 0 ? <p className="empty">No saved changes yet.</p> : (
          <ol className="timeline">{history.map((h) => <li key={h.id}><b className="small">{new Date(h.createdAt).toLocaleString()}</b><div className="small">{h.summary}</div></li>)}</ol>
        )}
      </section>

      <section className="card stack" aria-labelledby="del-h">
        <h2 id="del-h" className="h3">{t("deleteProfile")}</h2>
        <p className="small">Removes your allergies, diet, conditions, goals, limits, notes and their history from FoodDecode, and withdraws your consent. Your account and scan history stay. <Link className="link" href="/settings">Delete everything instead</Link>.</p>
        <div><button className="btn danger" onClick={() => setConfirmDel(true)} disabled={!profile} data-testid="delete-profile"><Trash2 /> {t("deleteProfile")}</button></div>
      </section>
      <Sheet open={confirmDel} onClose={() => setConfirmDel(false)} title="Delete your health profile?">
        <p>This cannot be undone. Verdicts will fall back to general label facts until you add a profile again.</p>
        <div className="row"><button className="btn danger solid" onClick={del} data-testid="confirm-delete-profile">{t("delete")}</button><button className="btn ghost" onClick={() => setConfirmDel(false)}>{t("cancel")}</button></div>
      </Sheet>
    </div>
  );
}
