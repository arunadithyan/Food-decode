"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, Info, X } from "lucide-react";
import { PROVENANCE_LABEL } from "@/lib/catalogue";
import type { Provenance } from "@/lib/types";

export function Skeleton({ h = 20, w = "100%", className = "" }: { h?: number; w?: number | string; className?: string }) {
  return <div className={`skel ${className}`} style={{ height: h, width: w }} aria-hidden="true" />;
}

export function PageSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading">
      <Skeleton h={34} w="60%" />
      <Skeleton h={18} w="40%" />
      <Skeleton h={160} />
      <Skeleton h={120} />
    </div>
  );
}

export function Banner({ kind = "ok", children, icon = true }: { kind?: "ok" | "warn" | "info"; children: ReactNode; icon?: boolean }) {
  return (
    <div className={`banner ${kind === "ok" ? "" : kind}`} role={kind === "warn" ? "alert" : undefined}>
      {icon && (kind === "warn" ? <AlertTriangle aria-hidden /> : <Info aria-hidden />)}
      <div className="stack" style={{ gap: 6 }}>{children}</div>
    </div>
  );
}

export function ProvBadge({ p }: { p: Provenance }) {
  return <span className={`prov ${p}`} title={PROVENANCE_LABEL[p].long}>{PROVENANCE_LABEL[p].short}</span>;
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose(): void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); prev?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="spread"><h3>{title}</h3><button className="btn ghost sm" onClick={onClose} aria-label="Close"><X /></button></div>
        {children}
      </div>
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div className="card stack" role="alert">
      <div className="row"><AlertTriangle aria-hidden style={{ color: "var(--red)" }} /><b>{title}</b></div>
      <p className="muted">{message}</p>
      {onRetry && <div><button className="btn sm" onClick={onRetry}>Try again</button></div>}
    </div>
  );
}

export function Disclaimer() {
  return (
    <p className="disclaimer">
      FoodDecode explains food labels using published reference values and the information you choose to share. It does not diagnose, treat or give medical
      advice, and it cannot guarantee a product is safe for you. Always read the physical pack, especially for allergies, and follow your doctor or dietitian.
    </p>
  );
}
