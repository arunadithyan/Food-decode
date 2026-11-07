"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { Lang } from "@/lib/i18n/lessons";
import { t as tr, type StringKey } from "@/lib/i18n/strings";
import { emptyProfile, type HealthProfile } from "@/lib/profile";

export interface Consents { health_data: boolean; cloud_ocr: boolean; scan_history: boolean }
interface Me { user: { id: string; username: string }; settings: { language: Lang }; consents: Consents; hasProfile: boolean }

interface Ctx {
  /** undefined while loading, null when logged out */
  user: Me["user"] | null | undefined;
  consents: Consents;
  lang: Lang;
  setLang(l: Lang): void;
  t(k: StringKey): string;
  /** the user's health profile, held in memory only; null if none saved */
  profile: HealthProfile | null;
  profileLoaded: boolean;
  setProfile(p: HealthProfile | null): void;
  refresh(): Promise<void>;
  setConsentsLocal(c: Partial<Consents>): void;
  online: boolean;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
};

const readLangCookie = (): Lang | null => {
  const m = document.cookie.match(/(?:^|;\s*)fd_lang=(en|hi|ta)/);
  return (m?.[1] as Lang) || null;
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Ctx["user"]>(undefined);
  const [consents, setConsents] = useState<Consents>({ health_data: false, cloud_ocr: false, scan_history: false });
  const [lang, setLangState] = useState<Lang>("en");
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [online, setOnline] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api<Me>("/api/auth/me");
      setUser(me.user);
      setConsents(me.consents);
      setLangState(me.settings.language);
      document.cookie = `fd_lang=${me.settings.language}; path=/; max-age=31536000; samesite=lax`;
      if (me.hasProfile) {
        const p = await api<{ profile: HealthProfile | null }>("/api/profile");
        setProfile(p.profile ? { ...emptyProfile(), ...p.profile } : null);
      } else setProfile(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setUser(null);
        setProfile(null);
      } else if (e instanceof ApiError && e.code === "offline") {
        // keep whatever we had in memory; the shell shows the offline banner
        setUser((u) => (u === undefined ? null : u));
      } else setUser(null);
    } finally {
      setProfileLoaded(true);
    }
  }, []);

  useEffect(() => {
    const c = readLangCookie();
    if (c) setLangState(c);
    refresh();
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [refresh]);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.cookie = `fd_lang=${l}; path=/; max-age=31536000; samesite=lax`;
    if (user) api("/api/settings", { method: "PUT", body: { language: l } }).catch(() => {});
  }, [user]);

  const value = useMemo<Ctx>(() => ({
    user, consents, lang, setLang, t: (k) => tr(lang, k), profile, profileLoaded, setProfile, refresh,
    setConsentsLocal: (c) => setConsents((x) => ({ ...x, ...c })), online,
  }), [user, consents, lang, setLang, profile, profileLoaded, refresh, online]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
