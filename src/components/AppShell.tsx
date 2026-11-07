"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BookOpen, Clock, Columns2, Home, LogIn, ScanLine, Search, Settings, UserRound, WifiOff } from "lucide-react";
import { useApp } from "./AppProvider";
import { LANG_NAME } from "@/lib/i18n/strings";
import type { Lang } from "@/lib/i18n/lessons";

function LangSwitch() {
  const { lang, setLang, t } = useApp();
  return (
    <div className="lang" role="group" aria-label={t("language")}>
      {(["en", "hi", "ta"] as Lang[]).map((l) => (
        <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)} lang={l}>{LANG_NAME[l]}</button>
      ))}
    </div>
  );
}

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="FoodDecode home">
      <span className="brand-mark" aria-hidden>FD</span>
      <span className="brand-name">FoodDecode</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname() || "/";
  const { t, user, online } = useApp();
  const on = (href: string) => (href === "/dashboard" ? path === href : path.startsWith(href)) ? "page" : undefined;
  const nav = [
    { href: "/dashboard", label: t("navHome"), icon: Home },
    { href: "/scan", label: t("navScan"), icon: ScanLine },
    { href: "/search", label: t("navSearch"), icon: Search },
    { href: "/compare", label: t("navCompare"), icon: Columns2 },
    { href: "/history", label: t("navHistory"), icon: Clock },
    { href: "/learn", label: t("navLearn"), icon: BookOpen },
    { href: "/profile", label: t("navProfile"), icon: UserRound },
    { href: "/settings", label: t("navSettings"), icon: Settings },
  ];
  const tabs = [nav[0], nav[2], nav[1], nav[5], nav[6]];
  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      {!online && <div className="offline-bar" role="status"><WifiOff size={15} style={{ display: "inline", verticalAlign: "-2px" }} /> {t("offline")} — {t("offlineSub")}</div>}
      <div className="shell">
        <aside className="rail" aria-label="Main navigation">
          <Brand />
          <nav className="nav">
            {nav.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} aria-current={on(href)}><Icon aria-hidden />{label}</Link>
            ))}
          </nav>
          <div className="stack" style={{ marginTop: "auto" }}>
            <LangSwitch />
            {user === null && <Link className="btn sm" href="/login"><LogIn />{t("logIn")}</Link>}
            {user && <span className="small muted">Signed in as <b>{user.username}</b></span>}
          </div>
        </aside>
        <div style={{ minWidth: 0 }}>
          <header className="topbar">
            <Brand />
            <div className="row" style={{ gap: 8 }}>
              <Link className="btn ghost sm" href="/settings" aria-label={t("navSettings")}><Settings /></Link>
              {user === null && <Link className="btn sm" href="/login">{t("logIn")}</Link>}
            </div>
          </header>
          <main id="main">{children}</main>
        </div>
      </div>
      <nav className="tabbar" aria-label="Main navigation">
        {tabs.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={on(href)} className={href === "/scan" ? "scan-tab" : undefined}>
            <span className="ic"><Icon aria-hidden /></span>{label}
          </Link>
        ))}
      </nav>
    </>
  );
}

export { LangSwitch };
