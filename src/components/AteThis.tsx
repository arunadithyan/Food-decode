"use client";
import Link from "next/link";
import { useState } from "react";
import { Utensils } from "lucide-react";
import { useApp } from "./AppProvider";
import { Sheet } from "./ui";
import { api, ApiError } from "@/lib/client/api";
import { entryFromProduct, localToday, MEAL_LABEL, MEALS, mealForTime, type Meal } from "@/lib/diary";
import { fmt, unitOf } from "@/lib/nutrition/calc";
import type { Product } from "@/lib/types";

/** "I ate this": logs the current portion of a product to today's food diary. */
export function AteThis({ product, amount }: { product: Product; amount: number }) {
  const { user, consents, setConsentsLocal } = useApp();
  const [meal, setMeal] = useState<Meal>(mealForTime());
  const [ask, setAsk] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const kcal = product.nutrition.energyKcal == null ? null : (product.nutrition.energyKcal * amount) / 100;

  const log = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/diary", { body: entryFromProduct(product, amount, localToday(), meal) });
      setMsg({ ok: true, text: `Added ${fmt(amount)} ${unitOf(product)} (${kcal == null ? "?" : fmt(kcal)} kcal) to ${MEAL_LABEL[meal].toLowerCase()} today.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? e.message : "Could not add this." });
    } finally {
      setBusy(false);
    }
  };
  const click = () => (consents.food_log ? log() : setAsk(true));

  if (user === null) return <p className="small muted"><Link className="link" href={`/login?next=/product/${product.id}`}>Log in</Link> to add this to your food diary.</p>;
  if (!user) return null;
  return (
    <section className="card tight row" style={{ justifyContent: "space-between" }} aria-label="Add to food diary">
      <div className="row" style={{ gap: 8 }}>
        <button className="btn primary" onClick={click} disabled={busy || kcal == null} data-testid="ate-this"><Utensils /> I ate this</button>
        <label className="sr" htmlFor="ate-meal">Meal</label>
        <select id="ate-meal" className="input" style={{ width: "auto" }} value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
          {MEALS.map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}
        </select>
        <span className="small muted">{fmt(amount)} {unitOf(product)} · {kcal == null ? "calories not stated" : `${fmt(kcal)} kcal`}</span>
      </div>
      {msg && <span className={msg.ok ? "okmsg" : "err"} role="status" data-testid="ate-msg">{msg.text} {msg.ok && <Link className="link" href="/profile/intake">See my intake →</Link>}</span>}
      <Sheet open={ask} onClose={() => setAsk(false)} title="Turn on your food diary?">
        <p>FoodDecode will keep a private diary of what you log, to show your daily calories, what is left against your target, and your streak.</p>
        <p className="small muted">Encrypted, visible only to you, included in your data download. You can turn it off in Privacy &amp; Settings — that deletes the diary.</p>
        <div className="row">
          <button className="btn primary" onClick={async () => { await api("/api/settings", { method: "PUT", body: { consents: { food_log: true } } }); setConsentsLocal({ food_log: true }); setAsk(false); await log(); }} data-testid="enable-diary-sheet">Turn on and add</button>
          <button className="btn ghost" onClick={() => setAsk(false)}>Not now</button>
        </div>
      </Sheet>
    </section>
  );
}
