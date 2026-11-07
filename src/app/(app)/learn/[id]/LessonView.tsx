"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { LESSONS, lessonById } from "@/lib/i18n/lessons";

export function LessonView({ id }: { id: string }) {
  const { lang, t } = useApp();
  const l = lessonById(id);
  if (!l) return <div className="page"><p className="empty">Lesson not found.</p></div>;
  const tx = l.text[lang];
  const idx = LESSONS.findIndex((x) => x.id === id);
  const next = LESSONS[idx + 1];
  return (
    <div className="page">
      <Link className="back" href="/learn"><ArrowLeft size={16} /> {t("teachMe")}</Link>
      <article className="prose" lang={lang} data-testid="lesson">
        <div className="spread" style={{ alignItems: "flex-start" }}>
          <div className="stack" style={{ gap: 6 }}><span className="eyebrow">{l.mins} {t("minutes")}</span><h2 style={{ fontSize: "clamp(26px,4vw,34px)" }}>{tx.title}</h2></div>
          <Image src={`/illustrations/${l.illustration}.webp`} alt="" width={84} height={90} style={{ height: "auto" }} />
        </div>
        <p className="lede">{tx.blurb}</p>
        {tx.body.map((b, i) =>
          "p" in b ? <p key={i}>{b.p}</p>
          : "list" in b ? <ul key={i}>{b.list.map((x, j) => <li key={j}>{x}</li>)}</ul>
          : "tip" in b ? <div key={i} className="callout"><b>FoodDecode tip · </b>{b.tip}</div>
          : <div key={i} className="callout" style={{ background: "var(--amber-soft)" }}><b>Example · </b>{b.example}</div>,
        )}
      </article>
      {next && <Link className="lesson" href={`/learn/${next.id}`}><span className="n">→</span><span><b>{next.text[lang].title}</b><span>{next.text[lang].blurb}</span></span><ArrowRight size={16} style={{ marginLeft: "auto" }} /></Link>}
    </div>
  );
}
