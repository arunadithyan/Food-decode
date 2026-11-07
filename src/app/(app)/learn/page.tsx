"use client";
import Image from "next/image";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { LESSONS } from "@/lib/i18n/lessons";

export default function LearnPage() {
  const { t, lang } = useApp();
  return (
    <div className="page">
      <div className="spread">
        <div className="stack" style={{ gap: 6 }}><span className="eyebrow">{t("navLearn")}</span><h1>{t("teachMe")}</h1></div>
        <Image src="/illustrations/magnifier.webp" alt="" width={80} height={79} />
      </div>
      <Link className="card row" href="/ask" style={{ textDecoration: "none", color: "inherit" }}><div><b style={{ fontSize: 17 }}>Ask FoodDecode</b><p className="small muted">Questions like “What is INS 471?” or “Is 600 mg sodium a lot?”</p></div></Link>
      <div className="lessons">
        {LESSONS.map((l, i) => (
          <Link key={l.id} className="lesson" href={`/learn/${l.id}`} lang={lang}>
            <span className="n">{String(i + 1).padStart(2, "0")}</span>
            <span><b>{l.text[lang].title}</b><span>{l.text[lang].blurb} · {l.mins} {t("minutes")}</span></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
