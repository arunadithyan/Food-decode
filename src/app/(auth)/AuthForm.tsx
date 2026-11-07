"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Brand } from "@/components/AppShell";
import { api, ApiError } from "@/lib/client/api";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { t, refresh } = useApp();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [accept, setAccept] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api(`/api/auth/${mode}`, { body: mode === "register" ? { username, password, acceptTerms: accept } : { username, password } });
      await refresh();
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      router.replace(mode === "register" ? "/onboarding" : safeNext || "/dashboard");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card stack" style={{ gap: 18 }}>
      <Brand />
      <form className="card stack" onSubmit={submit} noValidate>
        <h1 style={{ fontSize: 28 }}>{mode === "login" ? t("logIn") : t("signUp")}</h1>
        {mode === "register" && <p className="small muted">Use any username — an email address is not required. We don&apos;t send email, so keep your password safe.</p>}
        <div className="field">
          <label htmlFor="u">{t("username")}</label>
          <input id="u" className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={64} />
        </div>
        <div className="field">
          <label htmlFor="p">{t("password")}</label>
          <input id="p" className="input" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === "register" ? 10 : 1} aria-describedby={mode === "register" ? "pwhelp" : undefined} />
          {mode === "register" && <span id="pwhelp" className="small muted">At least 10 characters.</span>}
        </div>
        {mode === "register" && (
          <label className="check">
            <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
            <span>I understand FoodDecode explains labels and is not medical advice. I&apos;ve read <Link className="link" href="/about#privacy" target="_blank">how my data is handled</Link>. Nothing about my health is stored until I choose to add it.</span>
          </label>
        )}
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn primary block" disabled={busy || (mode === "register" && !accept)}>{busy ? t("loading") : mode === "login" ? t("logIn") : t("signUp")}</button>
        <p className="small" style={{ textAlign: "center" }}>
          {mode === "login" ? <>New here? <Link className="link" href="/register">{t("signUp")}</Link></> : <>Have an account? <Link className="link" href="/login">{t("logIn")}</Link></>}
        </p>
      </form>
      <p className="small muted" style={{ textAlign: "center" }}><Link className="link" href="/scan">Continue without an account</Link> — scanning and Teach Me work without logging in; personal checks need a profile.</p>
    </div>
  );
}
