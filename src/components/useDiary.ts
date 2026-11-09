"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "./AppProvider";
import { api, ApiError } from "@/lib/client/api";
import { addDays, dayStatus, dayTotals, localToday, streaks, targetsFor, type DiaryEntry, type DiaryEntryInput, type DiarySettings } from "@/lib/diary";

/** Loads the signed-in user's food diary (last ~13 months) and derives totals, targets and streaks. Held in memory only. */
export function useDiary() {
  const { user, profile, consents, setConsentsLocal } = useApp();
  const [entries, setEntries] = useState<DiaryEntry[] | null>(null);
  const [settings, setSettings] = useState<DiarySettings>({ energyTargetKcal: null });
  const [error, setError] = useState<string | null>(null);
  const today = localToday();

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const r = await api<{ entries: DiaryEntry[]; settings: DiarySettings }>(`/api/diary?from=${addDays(today, -370)}&to=${addDays(today, 1)}`);
      setEntries(r.entries);
      setSettings(r.settings);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load your food diary.");
      setEntries((x) => x ?? []);
    }
  }, [user, today]);
  useEffect(() => { load(); }, [load, consents.food_log]);

  const targets = useMemo(() => targetsFor(profile, settings), [profile, settings]);
  const streak = useMemo(() => streaks(entries || [], targets, today), [entries, targets, today]);
  const totalsFor = useCallback((day: string) => dayTotals(day, entries || []), [entries]);
  const statusFor = useCallback((day: string) => dayStatus(dayTotals(day, entries || []), targets), [entries, targets]);

  const enable = async () => {
    await api("/api/settings", { method: "PUT", body: { consents: { food_log: true } } });
    setConsentsLocal({ food_log: true });
  };
  const add = async (e: DiaryEntryInput) => {
    const r = await api<{ entry: DiaryEntry }>("/api/diary", { body: e });
    setEntries((x) => [...(x || []), r.entry]);
    return r.entry;
  };
  const update = async (id: string, e: DiaryEntryInput) => {
    const r = await api<{ entry: DiaryEntry }>(`/api/diary/${id}`, { method: "PUT", body: e });
    setEntries((x) => (x || []).map((y) => (y.id === id ? r.entry : y)));
  };
  const remove = async (id: string) => {
    await api(`/api/diary/${id}`, { method: "DELETE" });
    setEntries((x) => (x || []).filter((y) => y.id !== id));
  };
  const setTarget = async (v: number | null) => {
    const r = await api<{ settings: DiarySettings }>("/api/diary/settings", { method: "PUT", body: { energyTargetKcal: v } });
    setSettings(r.settings);
  };

  return { enabled: consents.food_log, entries, settings, targets, streak, today, error, totalsFor, statusFor, enable, add, update, remove, setTarget, reload: load };
}
