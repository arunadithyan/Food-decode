/*
 * Per-user data access. Every function takes the user id from the authenticated session — no route
 * accepts a user id from the request — and every query is scoped `WHERE user_id = ?`. This is the
 * application-level equivalent of Postgres Row Level Security (see db/postgres for the RLS version).
 */
import "server-only";
import { emptyProfile, type HealthProfile, validateProfile } from "../profile";
import type { Product } from "../types";
import { decryptJSON, encryptJSON, newId } from "./crypto";
import { getDb, tx } from "./db";

const AAD = {
  profile: (u: string) => `profile:${u}`,
  history: (u: string) => `profile_history:${u}`,
  scan: (u: string) => `scan:${u}`,
  comparison: (u: string) => `comparison:${u}`,
};

/* ---------------- consents & settings ---------------- */
export type ConsentKind = "health_data" | "cloud_ocr" | "scan_history";
export function getConsents(userId: string): Record<ConsentKind, boolean> {
  const rows = getDb().prepare("SELECT kind, granted FROM consents WHERE user_id = ?").all(userId) as { kind: ConsentKind; granted: number }[];
  const out = { health_data: false, cloud_ocr: false, scan_history: false };
  for (const r of rows) out[r.kind] = r.granted === 1;
  return out;
}
export function setConsent(userId: string, kind: ConsentKind, granted: boolean) {
  getDb()
    .prepare("INSERT INTO consents (user_id, kind, granted, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, kind) DO UPDATE SET granted = excluded.granted, updated_at = excluded.updated_at")
    .run(userId, kind, granted ? 1 : 0, new Date().toISOString());
}
export function getSettings(userId: string): { language: "en" | "hi" | "ta" } {
  const r = getDb().prepare("SELECT language FROM settings WHERE user_id = ?").get(userId) as { language: "en" | "hi" | "ta" } | undefined;
  return { language: r?.language ?? "en" };
}
export function setLanguage(userId: string, language: "en" | "hi" | "ta") {
  getDb()
    .prepare("INSERT INTO settings (user_id, language, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET language = excluded.language, updated_at = excluded.updated_at")
    .run(userId, language, new Date().toISOString());
}

/* ---------------- health profile ---------------- */
export function getProfile(userId: string): { profile: HealthProfile; updatedAt: string } | null {
  const r = getDb().prepare("SELECT data_enc, updated_at FROM profiles WHERE user_id = ?").get(userId) as { data_enc: string; updated_at: string } | undefined;
  if (!r) return null;
  return { profile: { ...emptyProfile(), ...decryptJSON<HealthProfile>(r.data_enc, AAD.profile(userId)) }, updatedAt: r.updated_at };
}

export function saveProfile(userId: string, input: unknown, summary: string): HealthProfile {
  const profile = validateProfile(input);
  const now = new Date().toISOString();
  tx((db) => {
    db.prepare("INSERT INTO profiles (user_id, data_enc, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data_enc = excluded.data_enc, updated_at = excluded.updated_at")
      .run(userId, encryptJSON(profile, AAD.profile(userId)), now);
    db.prepare("INSERT INTO profile_history (id, user_id, data_enc, created_at) VALUES (?, ?, ?, ?)")
      .run(newId(), userId, encryptJSON({ summary: summary.slice(0, 300), snapshot: profile }, AAD.history(userId)), now);
  });
  return profile;
}

export function profileHistory(userId: string): { id: string; createdAt: string; summary: string; snapshot: HealthProfile }[] {
  const rows = getDb().prepare("SELECT id, data_enc, created_at FROM profile_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").all(userId) as { id: string; data_enc: string; created_at: string }[];
  return rows.map((r) => ({ id: r.id, createdAt: r.created_at, ...decryptJSON<{ summary: string; snapshot: HealthProfile }>(r.data_enc, AAD.history(userId)) }));
}

/** Deletes the health profile and its history, and withdraws health-data consent. */
export function deleteProfile(userId: string) {
  tx((db) => {
    db.prepare("DELETE FROM profiles WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM profile_history WHERE user_id = ?").run(userId);
    db.prepare("UPDATE consents SET granted = 0, updated_at = ? WHERE user_id = ? AND kind = 'health_data'").run(new Date().toISOString(), userId);
  });
}

/* ---------------- scan history ---------------- */
export interface ScanRecord {
  id: string;
  createdAt: string;
  kind: "lookup" | "ocr";
  productId?: string;
  /** full product snapshot for OCR scans (user-verified) and external products */
  product?: Product;
  amount?: number;
}
export function addScan(userId: string, rec: Omit<ScanRecord, "id" | "createdAt">): ScanRecord {
  const id = newId();
  const createdAt = new Date().toISOString();
  const db = getDb();
  // keep one "lookup" entry per product: viewing again moves it to the top
  if (rec.kind === "lookup" && rec.productId) {
    for (const r of listScans(userId, 200)) if (r.kind === "lookup" && r.productId === rec.productId) db.prepare("DELETE FROM scans WHERE id = ? AND user_id = ?").run(r.id, userId);
  }
  db.prepare("INSERT INTO scans (id, user_id, data_enc, created_at) VALUES (?, ?, ?, ?)").run(id, userId, encryptJSON(rec, AAD.scan(userId)), createdAt);
  return { id, createdAt, ...rec };
}
export function listScans(userId: string, limit = 100): ScanRecord[] {
  const rows = getDb().prepare("SELECT id, data_enc, created_at FROM scans WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").all(userId, limit) as { id: string; data_enc: string; created_at: string }[];
  return rows.map((r) => ({ id: r.id, createdAt: r.created_at, ...decryptJSON<Omit<ScanRecord, "id" | "createdAt">>(r.data_enc, AAD.scan(userId)) }));
}
export function getScan(userId: string, id: string): ScanRecord | null {
  const r = getDb().prepare("SELECT id, data_enc, created_at FROM scans WHERE id = ? AND user_id = ?").get(id, userId) as { id: string; data_enc: string; created_at: string } | undefined;
  return r ? { id: r.id, createdAt: r.created_at, ...decryptJSON<Omit<ScanRecord, "id" | "createdAt">>(r.data_enc, AAD.scan(userId)) } : null;
}
export function deleteScan(userId: string, id: string): boolean {
  const res = getDb().prepare("DELETE FROM scans WHERE id = ? AND user_id = ?").run(id, userId) as { changes: number };
  return res.changes > 0;
}
export function clearScans(userId: string) {
  getDb().prepare("DELETE FROM scans WHERE user_id = ?").run(userId);
}

/* ---------------- saved comparisons ---------------- */
export interface Comparison { id: string; createdAt: string; a: string; b: string; mode: "100" | "serving" | "amount"; amount?: number }
export function addComparison(userId: string, c: Omit<Comparison, "id" | "createdAt">): Comparison {
  const id = newId();
  const createdAt = new Date().toISOString();
  getDb().prepare("INSERT INTO comparisons (id, user_id, data_enc, created_at) VALUES (?, ?, ?, ?)").run(id, userId, encryptJSON(c, AAD.comparison(userId)), createdAt);
  return { id, createdAt, ...c };
}
export function listComparisons(userId: string): Comparison[] {
  const rows = getDb().prepare("SELECT id, data_enc, created_at FROM comparisons WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").all(userId) as { id: string; data_enc: string; created_at: string }[];
  return rows.map((r) => ({ id: r.id, createdAt: r.created_at, ...decryptJSON<Omit<Comparison, "id" | "createdAt">>(r.data_enc, AAD.comparison(userId)) }));
}
export function deleteComparison(userId: string, id: string): boolean {
  const res = getDb().prepare("DELETE FROM comparisons WHERE id = ? AND user_id = ?").run(id, userId) as { changes: number };
  return res.changes > 0;
}

/* ---------------- user-submitted corrections (public product data, not health data) ---------------- */
export function addCorrection(userId: string, c: { productId: string; field: string; value: string; note?: string }) {
  const id = newId();
  getDb().prepare("INSERT INTO corrections (id, user_id, product_id, field, value, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, userId, c.productId.slice(0, 80), c.field.slice(0, 40), c.value.slice(0, 200), (c.note || "").slice(0, 500), new Date().toISOString());
  return { id };
}
export function listCorrections(userId: string) {
  return getDb().prepare("SELECT id, product_id AS productId, field, value, note, status, created_at AS createdAt FROM corrections WHERE user_id = ? ORDER BY created_at DESC").all(userId);
}

/* ---------------- export & deletion ---------------- */
export function exportAll(userId: string) {
  const user = getDb().prepare("SELECT id, username, created_at AS createdAt FROM users WHERE id = ?").get(userId);
  return {
    exportedAt: new Date().toISOString(),
    format: "FoodDecode export v1",
    user,
    settings: getSettings(userId),
    consents: getConsents(userId),
    healthProfile: getProfile(userId),
    profileHistory: profileHistory(userId),
    scans: listScans(userId, 1000),
    comparisons: listComparisons(userId),
    corrections: listCorrections(userId),
  };
}

export function deleteAccount(userId: string) {
  // ON DELETE CASCADE removes sessions, profile, history, consents, settings, scans, comparisons, corrections
  getDb().prepare("DELETE FROM users WHERE id = ?").run(userId);
}
