"use client";
import Link from "next/link";
import { Flame } from "lucide-react";
import { useDiary } from "./useDiary";
import { fmt } from "@/lib/nutrition/calc";

/** Compact "today" card for the profile page and dashboard. */
export function IntakeSummary() {
  const d = useDiary();
  if (!d.enabled) {
    return (
      <Link href="/profile/intake" className="card tight spread" style={{ textDecoration: "none", color: "inherit" }}>
        <span><b>My intake</b> <span className="small muted">— keep a food diary with daily calories and streaks</span></span><span className="link small">Set up →</span>
      </Link>
    );
  }
  if (!d.entries) return null;
  const t = d.totalsFor(d.today);
  const target = d.targets.energyKcal!.value;
  const left = target - t.totals.energyKcal;
  return (
    <Link href="/profile/intake" className="card tight stack" style={{ textDecoration: "none", color: "inherit", gap: 8 }} data-testid="intake-summary">
      <div className="spread"><b>Today’s intake</b><span className="small"><Flame size={15} style={{ display: "inline", verticalAlign: "-2px", color: "var(--amber)" }} /> {d.streak.onTrack}-day on-track streak</span></div>
      <div className="progress" style={{ height: 10 }}><i style={{ width: `${Math.min(100, (t.totals.energyKcal / target) * 100)}%` }} /></div>
      <span className="small">{fmt(t.totals.energyKcal)} / {fmt(target)} kcal · {left >= 0 ? `${fmt(left)} kcal left` : `${fmt(-left)} kcal over`} · {t.count} item{t.count === 1 ? "" : "s"} logged <span className="link">Open →</span></span>
    </Link>
  );
}
