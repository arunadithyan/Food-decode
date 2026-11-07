"use client";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Lock, ScanLine } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Brand, LangSwitch } from "@/components/AppShell";
import { Disclaimer } from "@/components/ui";

export default function Landing() {
  const { user, t } = useApp();
  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "16px 16px 64px" }}>
      <header className="spread" style={{ padding: "8px 0 24px" }}>
        <Brand />
        <div className="row">
          <LangSwitch />
          {user ? <Link className="btn primary sm" href="/dashboard">{t("navHome")} <ArrowRight /></Link> : <Link className="btn sm" href="/login">{t("logIn")}</Link>}
        </div>
      </header>
      <main id="main" className="stack" style={{ gap: 40 }}>
        <section className="landing-hero">
          <div className="stack" style={{ gap: 18 }}>
            <span className="eyebrow">India-first food label intelligence</span>
            <h1 style={{ fontSize: "clamp(34px,5.4vw,54px)" }}>Is this packet a <em style={{ fontStyle: "normal", color: "var(--teal-ink)" }}>yes</em> for you?</h1>
            <p className="lede">Scan a label, check it against your allergies, diet and health goals, and see exactly why — with the portion you actually eat.</p>
            <div className="row">
              {user ? (
                <Link className="btn primary" href="/scan"><ScanLine /> {t("scanFood")}</Link>
              ) : (
                <>
                  <Link className="btn primary" href="/register">{t("signUp")} <ArrowRight /></Link>
                  <Link className="btn" href="/scan"><ScanLine /> Try a scan without an account</Link>
                </>
              )}
            </div>
            <div className="flow" aria-label="How it works"><span>photo</span><i>→</i><span>OCR</span><i>→</i><span>you verify</span><i>→</i><span>YES / NO / CAUTION</span><i>→</i><span>why</span></div>
          </div>
          <Image src="/illustrations/reader.webp" alt="Illustration of a person reading a nutrition label with a magnifying glass" width={420} height={450} className="illus" priority />
        </section>
        <section className="feat" aria-label="What FoodDecode does">
          <div><Image src="/illustrations/scanner.webp" alt="" width={52} height={62} /><div><b>Reads real labels</b><p className="small muted">On-device OCR that works offline, or a more accurate online reader — you choose, and you check every value.</p></div></div>
          <div><Image src="/illustrations/head.webp" alt="" width={52} height={68} /><div><b>Personal, and explained</b><p className="small muted">Allergens first, then diet, then your clinician&apos;s limits and goals. Every verdict shows the rule and the numbers behind it.</p></div></div>
          <div><Image src="/illustrations/calculator.webp" alt="" width={52} height={70} /><div><b>Portion-aware</b><p className="small muted">30 g and 90 g of the same namkeen are different answers. Change the portion and the verdict updates.</p></div></div>
        </section>
        <section className="card soft row" style={{ alignItems: "flex-start" }}>
          <Lock aria-hidden style={{ flex: "none", color: "var(--teal-ink)" }} />
          <div className="stack" style={{ gap: 6 }}>
            <b>Your health information stays yours</b>
            <p className="small">Health profiles are encrypted on the server, visible only to you, never used in analytics, and can be downloaded or deleted any time. Label photos are read on your device unless you choose online OCR.</p>
            <Link className="link small" href="/about">How FoodDecode handles data and sources →</Link>
          </div>
        </section>
        <Disclaimer />
      </main>
    </div>
  );
}
