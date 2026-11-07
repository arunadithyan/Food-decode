"use client";
import Link from "next/link";
import { useState } from "react";
import { answer, SUGGESTIONS, type AskPart } from "@/lib/kb/ask";

type Msg = { who: "u"; text: string } | { who: "a"; parts: AskPart[] };

export default function AskPage() {
  const [msgs, setMsgs] = useState<Msg[]>([{ who: "a", parts: [{ text: "Hi! Ask me about a food label: an INS number, an ingredient, or whether a number is high. I explain; I don't diagnose or prescribe." }] }]);
  const [q, setQ] = useState("");
  const ask = (text: string) => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { who: "u", text }, { who: "a", parts: answer(text) }]);
    setQ("");
  };
  return (
    <div className="page">
      <div className="stack" style={{ gap: 6 }}><span className="eyebrow">Ask FoodDecode</span><h1>Questions about a label?</h1></div>
      <p className="small muted">Answers come from FoodDecode&apos;s additive list, glossary and reference values (rule-based, in English). They are general label explanations, not personal advice.</p>
      <div className="chat" aria-live="polite" data-testid="chat">
        {msgs.map((m, i) => m.who === "u" ? <div key={i} className="msg u">{m.text}</div> : (
          <div key={i} className="msg a">{m.parts.map((p, j) => <p key={j}>{p.text} {p.link && <Link className="link" href={p.link.href}>{p.link.label} →</Link>}{p.src && <span className="src"> · {p.src}</span>}</p>)}</div>
        ))}
      </div>
      <div className="chips">{SUGGESTIONS.map((s) => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}</div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <label className="sr" htmlFor="askq">Your question</label>
        <input id="askq" className="input" style={{ flex: 1, minWidth: 0 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about an INS number, ingredient or nutrient" autoComplete="off" />
        <button className="btn primary">Ask</button>
      </form>
    </div>
  );
}
