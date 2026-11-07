/*
 * Integration tests against a running FoodDecode server (default http://localhost:3000).
 *   npm run build && FD_INSECURE_COOKIES=1 npm start   (in another terminal)   then   npm run test:api
 * They exercise the real HTTP API, session cookies, encryption at rest and per-user isolation.
 */
import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.FD_BASE_URL || "http://localhost:3000";
const ORIGIN = new URL(BASE).origin;
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

class Client {
  cookie = "";
  async req(method: string, p: string, body?: unknown, headers: Record<string, string> = {}) {
    const h: Record<string, string> = { Origin: ORIGIN, ...headers };
    if (this.cookie) h.Cookie = this.cookie;
    if (body !== undefined) h["Content-Type"] = "application/json";
    const res = await fetch(BASE + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
    const sc = res.headers.get("set-cookie");
    if (sc) this.cookie = sc.split(";")[0].endsWith("=") ? "" : sc.split(";")[0];
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text, headers: res.headers };
  }
}
const PW = "a-long-test-password-1";
async function newUser(name: string) {
  const c = new Client();
  const r = await c.req("POST", "/api/auth/register", { username: `${name}.${run}`, password: PW, acceptTerms: true });
  expect(r.status).toBe(201);
  return c;
}
const MARKER = `kiwi-marker-${run}`;

let reachable = false;
beforeAll(async () => {
  try { reachable = (await fetch(BASE + "/")).ok; } catch { reachable = false; }
  if (!reachable) throw new Error(`FoodDecode server not reachable at ${BASE}. Start it first (see docs/TESTING.md).`);
});

describe("authentication", () => {
  it("rejects weak passwords and duplicate usernames; requires terms", async () => {
    const c = new Client();
    expect((await c.req("POST", "/api/auth/register", { username: `weak.${run}`, password: "short", acceptTerms: true })).status).toBe(400);
    expect((await c.req("POST", "/api/auth/register", { username: `noterms.${run}`, password: PW })).status).toBe(400);
    await newUser("dup");
    expect((await c.req("POST", "/api/auth/register", { username: `dup.${run}`, password: PW, acceptTerms: true })).status).toBe(409);
  });
  it("logs in with the right password only, with a uniform error", async () => {
    await newUser("login");
    const c = new Client();
    const bad = await c.req("POST", "/api/auth/login", { username: `login.${run}`, password: "wrong-password-xx" });
    const none = await c.req("POST", "/api/auth/login", { username: `nobody.${run}`, password: "wrong-password-xx" });
    expect(bad.status).toBe(400);
    expect(bad.json.message).toBe(none.json.message);
    const ok = await c.req("POST", "/api/auth/login", { username: `login.${run}`, password: PW });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(ok.headers.get("set-cookie")).toMatch(/SameSite=lax/i);
    expect((await c.req("GET", "/api/auth/me")).json.user.username).toBe(`login.${run}`);
    await c.req("POST", "/api/auth/logout", {});
    expect((await c.req("GET", "/api/auth/me")).status).toBe(401);
  });
  it("protected endpoints need a session; private pages redirect to login", async () => {
    const c = new Client();
    for (const p of ["/api/profile", "/api/scans", "/api/settings", "/api/account/export", "/api/profile/history"]) expect((await c.req("GET", p)).status).toBe(401);
    const page = await c.req("GET", "/profile");
    expect([307, 302]).toContain(page.status);
  });
  it("blocks cross-site requests (Origin check)", async () => {
    const c = await newUser("csrf");
    const r = await c.req("PUT", "/api/profile", { profile: {}, consent: true }, { Origin: "https://evil.example" });
    expect(r.status).toBe(403);
  });
  it("rate-limits repeated failed logins", async () => {
    const c = new Client();
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) statuses.push((await c.req("POST", "/api/auth/login", { username: `rl.${run}`, password: "nope-nope-nope" })).status);
    expect(statuses).toContain(429);
  });
});

describe("health profile CRUD, consent and history", () => {
  it("refuses to store health data without explicit consent (privacy-first default)", async () => {
    const c = await newUser("consent");
    const s = await c.req("GET", "/api/settings");
    expect(s.json.consents).toEqual({ health_data: false, cloud_ocr: false, scan_history: false });
    expect((await c.req("PUT", "/api/profile", { profile: { allergies: { items: ["peanut"] } } })).status).toBe(403);
  });
  it("creates, reads, updates (with history), validates and deletes", async () => {
    const c = await newUser("crud");
    const put = await c.req("PUT", "/api/profile", { profile: { allergies: { items: ["peanut"], custom: [MARKER] } }, consent: true, summary: "created" });
    expect(put.status).toBe(200);
    expect((await c.req("GET", "/api/profile")).json.profile.allergies.custom).toEqual([MARKER]);
    expect((await c.req("PUT", "/api/profile", { profile: { allergies: { items: ["peanut", "soy"] } }, summary: "added soy" })).status).toBe(200);
    expect((await c.req("PUT", "/api/profile", { profile: { allergies: { items: ["unicorn"] } } })).status).toBe(400);
    const hist = (await c.req("GET", "/api/profile/history")).json.history;
    expect(hist.map((h: any) => h.summary)).toEqual(["added soy", "created"]);
    expect((await c.req("DELETE", "/api/profile")).status).toBe(200);
    expect((await c.req("GET", "/api/profile")).json.profile).toBeNull();
    expect((await c.req("GET", "/api/profile/history")).json.history).toEqual([]);
    expect((await c.req("GET", "/api/settings")).json.consents.health_data).toBe(false);
  });
  it("stores profiles encrypted: the plaintext never appears in the database file", async () => {
    const c = await newUser("enc");
    await c.req("PUT", "/api/profile", { profile: { notes: `secret ${MARKER}-enc` }, consent: true });
    const dbFile = process.env.FD_DB_PATH || path.resolve(__dirname, "../../.data/fooddecode.db");
    const raw = [dbFile, dbFile + "-wal"].filter(fs.existsSync).map((f) => fs.readFileSync(f).toString("latin1")).join("");
    expect(raw.length).toBeGreaterThan(0);
    expect(raw).not.toContain(`${MARKER}-enc`);
  });
});

describe("per-user isolation", () => {
  it("user B cannot read, delete or list user A's data", async () => {
    const a = await newUser("iso-a");
    const b = await newUser("iso-b");
    await a.req("PUT", "/api/settings", { consents: { scan_history: true } });
    await a.req("PUT", "/api/profile", { profile: { allergies: { custom: [MARKER] } }, consent: true });
    const scan = await a.req("POST", "/api/scans", { kind: "lookup", productId: "maggi-masala" });
    expect(scan.status).toBe(201);
    const id = scan.json.scan.id;
    expect((await b.req("GET", `/api/scans/${id}`)).status).toBe(404);
    expect((await b.req("DELETE", `/api/scans/${id}`)).status).toBe(404);
    expect((await b.req("GET", "/api/scans")).json.scans).toEqual([]);
    expect(JSON.stringify((await b.req("GET", "/api/profile")).json)).not.toContain(MARKER);
    expect(JSON.stringify((await b.req("GET", "/api/account/export")).json)).not.toContain(MARKER);
    expect((await a.req("GET", `/api/scans/${id}`)).status).toBe(200);
  });
});

describe("scan history, comparisons, corrections, settings", () => {
  it("does not save scans while history is off; turning it off deletes saved scans", async () => {
    const c = await newUser("hist");
    expect((await c.req("POST", "/api/scans", { kind: "lookup", productId: "oreo" })).json.saved).toBe(false);
    await c.req("PUT", "/api/settings", { consents: { scan_history: true } });
    expect((await c.req("POST", "/api/scans", { kind: "lookup", productId: "oreo" })).status).toBe(201);
    expect((await c.req("POST", "/api/scans", { kind: "ocr", product: { id: "bad id!", provenance: "ocr-user-verified" } })).status).toBe(400);
    expect((await c.req("GET", "/api/scans")).json.scans).toHaveLength(1);
    await c.req("PUT", "/api/settings", { consents: { scan_history: false } });
    expect((await c.req("GET", "/api/scans")).json.scans).toHaveLength(0);
  });
  it("saves and deletes comparisons; stores corrections; sets language", async () => {
    const c = await newUser("cmp");
    const r = await c.req("POST", "/api/comparisons", { a: "oreo", b: "bourbon", mode: "100" });
    expect(r.status).toBe(201);
    expect((await c.req("DELETE", `/api/comparisons/${r.json.comparison.id}`)).status).toBe(200);
    expect((await c.req("POST", "/api/corrections", { productId: "oreo", field: "sodiumMg", value: "420" })).status).toBe(201);
    expect((await c.req("PUT", "/api/settings", { language: "ta" })).json.settings.language).toBe("ta");
    expect((await c.req("PUT", "/api/settings", { language: "xx" })).status).toBe(400);
  });
  it("online OCR requires consent before any image is accepted", async () => {
    const c = await newUser("ocr");
    const res = await fetch(BASE + "/api/ocr/server", { method: "POST", headers: { Origin: ORIGIN, Cookie: c.cookie, "Content-Type": "image/png" }, body: new Uint8Array([137, 80, 78, 71]) });
    expect(res.status).toBe(403);
  });
});

describe("export and account deletion", () => {
  it("exports everything for the user, then deletes the account completely", async () => {
    const c = await newUser("del");
    await c.req("PUT", "/api/profile", { profile: { notes: MARKER }, consent: true });
    const ex = await c.req("GET", "/api/account/export");
    expect(ex.headers.get("content-disposition")).toMatch(/attachment/);
    expect(ex.json.healthProfile.profile.notes).toBe(MARKER);
    expect((await c.req("DELETE", "/api/account", { password: "wrong-password-1", confirm: "DELETE" })).status).toBe(403);
    expect((await c.req("DELETE", "/api/account", { password: PW, confirm: "DELETE" })).status).toBe(200);
    expect((await c.req("GET", "/api/profile")).status).toBe(401);
    const again = new Client();
    expect((await again.req("POST", "/api/auth/login", { username: `del.${run}`, password: PW })).status).toBe(400);
  });
});

describe("product data", () => {
  it("serves catalogue products with provenance and searches locally", async () => {
    const c = new Client();
    const r = await c.req("GET", "/api/products/maggi-masala");
    expect(r.json.product.provenance).toBe("label-photo-checked");
    expect((await c.req("GET", "/api/products/search?q=maggi")).json.local[0].id).toBe("maggi-masala");
    expect((await c.req("GET", "/api/products/barcode/abc")).status).toBe(400);
  });
});

describe("logging", () => {
  it("server log never contains health data sent in requests", async () => {
    const log = path.resolve(__dirname, "../../.data/server.log");
    if (!fs.existsSync(log)) return; // only checkable when the server writes to .data/server.log
    expect(fs.readFileSync(log, "utf8")).not.toContain(MARKER);
  });
});
