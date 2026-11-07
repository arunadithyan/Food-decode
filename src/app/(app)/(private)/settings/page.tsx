"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, LogOut, Trash2 } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { LangSwitch } from "@/components/AppShell";
import { Sheet } from "@/components/ui";
import { api, ApiError } from "@/lib/client/api";

export default function SettingsPage() {
  const { t, consents, setConsentsLocal, refresh, user } = useApp();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [delOpen, setDelOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [typed, setTyped] = useState("");
  const [delErr, setDelErr] = useState<string | null>(null);

  async function toggle(kind: "scan_history" | "cloud_ocr", v: boolean) {
    if (kind === "scan_history" && !v && !confirm("Turning scan history off deletes your saved scans. Continue?")) return;
    try {
      await api("/api/settings", { method: "PUT", body: { consents: { [kind]: v } } });
      setConsentsLocal({ [kind]: v });
      setMsg(t("saved"));
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Could not save.");
    }
  }
  async function logout() {
    await api("/api/auth/logout", { method: "POST", body: {} }).catch(() => {});
    await refresh();
    router.replace("/");
  }
  async function deleteAccount() {
    setDelErr(null);
    try {
      await api("/api/account", { method: "DELETE", body: { password: pw, confirm: typed } });
      await refresh();
      router.replace("/?deleted=1");
    } catch (e) {
      setDelErr(e instanceof ApiError ? e.message : "Could not delete the account.");
    }
  }

  return (
    <div className="page">
      <h1>{t("navSettings")}</h1>
      <section className="card stack" aria-labelledby="lang-h">
        <h2 id="lang-h" className="h3">{t("language")}</h2>
        <LangSwitch />
        <p className="small muted">{t("translationScope")} Hindi and Tamil text was drafted for this project and is awaiting review by native-speaking nutrition educators.</p>
      </section>

      <section className="card stack" aria-labelledby="priv-h">
        <h2 id="priv-h" className="h3">Privacy choices</h2>
        <label className="check"><input type="checkbox" checked={consents.scan_history} onChange={(e) => toggle("scan_history", e.target.checked)} data-testid="toggle-history" /><span><b>{t("scanHistoryToggle")}</b><br /><span className="small muted">Off by default. Saved scans are encrypted. Turning this off deletes them.</span></span></label>
        <label className="check"><input type="checkbox" checked={consents.cloud_ocr} onChange={(e) => toggle("cloud_ocr", e.target.checked)} /><span><b>{t("cloudOcrToggle")}</b><br /><span className="small muted">Off by default. When on, you can choose “Online” on the scan screen; the photo is sent to the FoodDecode OCR server, read and discarded. On-device reading keeps photos on your phone.</span></span></label>
        <div className="small"><b>Health data consent:</b> {consents.health_data ? "given — " : "not given. "}{consents.health_data ? <Link className="link" href="/profile">withdraw by deleting your health profile</Link> : <Link className="link" href="/onboarding">add a profile</Link>}</div>
        {msg && <p className="small" role="status">{msg}</p>}
      </section>

      <section className="card stack" aria-labelledby="data-h">
        <h2 id="data-h" className="h3">Your data</h2>
        <ul className="small" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
          <li>Health profile, profile history, scans and saved comparisons are encrypted (AES-256-GCM) in the database.</li>
          <li>Every request is checked against your session; no one else can read your records.</li>
          <li>FoodDecode keeps no analytics, and server logs never contain request bodies or health data.</li>
          <li>Connections use HTTPS in production; session cookies are HttpOnly and Secure.</li>
        </ul>
        <div className="row">
          <a className="btn" href="/api/account/export" download data-testid="export"><Download /> {t("exportData")}</a>
          <Link className="btn ghost" href="/about#privacy">How this works</Link>
        </div>
      </section>

      <section className="card stack" aria-labelledby="acct-h">
        <h2 id="acct-h" className="h3">Account</h2>
        <p className="small">Signed in as <b>{user?.username}</b>.</p>
        <div className="row">
          <button className="btn" onClick={logout}><LogOut /> {t("logOut")}</button>
          <button className="btn danger" onClick={() => setDelOpen(true)} data-testid="delete-account"><Trash2 /> {t("deleteAccount")}</button>
        </div>
      </section>
      <Sheet open={delOpen} onClose={() => setDelOpen(false)} title="Delete your account?">
        <p>This permanently deletes your account, health profile and history, scans, comparisons and reports. It cannot be undone. Consider downloading your data first.</p>
        <div className="field"><label htmlFor="dpw">{t("password")}</label><input id="dpw" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></div>
        <div className="field"><label htmlFor="dty">Type DELETE to confirm</label><input id="dty" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} /></div>
        {delErr && <p className="err" role="alert">{delErr}</p>}
        <button className="btn danger solid" disabled={typed !== "DELETE" || !pw} onClick={deleteAccount} data-testid="confirm-delete-account">{t("deleteAccount")}</button>
      </Sheet>
    </div>
  );
}
