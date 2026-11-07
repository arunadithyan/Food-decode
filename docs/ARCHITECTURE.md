# Architecture, audit and migration

## 1. Audit of the uploaded prototype and deck

**FoodDecode-prototype.zip** contained a static, single-page app: `index.html` (all data, logic and UI, ~100 KB of JS), `products.json` (28 products), `sample-label.png`, and a bundled Tesseract.js 5 OCR engine with the English model. There was no backend, no accounts, and no persistence beyond the page session.

What worked and was **kept** (ported to TypeScript modules, behaviour preserved unless noted):

| Prototype feature | Where it lives now |
|---|---|
| 28 Indian products with source links, dates, verification status | `src/lib/data/products.json` (v1 kept as `products.v1.json`); each record now has `provenance`, label-photo URL and correction notes |
| Interpretation: FSSAI daily references, UK FSA per-100 bands, 5/20 portion rule, protein/fibre claim thresholds, salt = sodium × 2.5, Atwater energy check | `src/lib/nutrition/reference.ts`, `calc.ts` |
| Portion engine (presets + slider + custom) | `PortionControl` — presets now include 1/2 servings, half/full pack, custom |
| Ingredient explainer, ~70 INS codes, glossary | `src/lib/ingredients/parse.ts`, `src/lib/kb/ins.ts`, `glossary.ts` |
| Product comparison (per 100 / per serving / same amount) | `/compare`, now savable |
| Teach Me (8 lessons) | `src/lib/i18n/lessons.ts` — 8 kept + 2 new (carbs vs added sugar; allergens & “may contain”), all in EN/HI/TA |
| Ask FoodDecode (rule-based label Q&A) | `src/lib/kb/ask.ts`, `/ask` (the prototype's optional AI follow-up depended on the artifact host and was dropped) |
| OCR: upload, camera, crop, rotate, sample label, review screen, “never invent values” | rebuilt — see `docs/OCR.md` |
| Visual identity: mint paper, dark-teal ink, Bricolage Grotesque / Figtree / IBM Plex Mono, packet-style nutrition panel, deck illustrations | `src/app/globals.css` (prototype CSS carried over verbatim, then extended), `public/illustrations/*` taken from the deck |

**FoodDecode_GPEI_MidSem_1.pptx** (the deck) described the motivation (label literacy in India, FSSAI front-of-pack debate), the planned features and the illustrations used here (person with magnifier, scanner, calculator, chart, head, confused face). Those illustrations are reused in the landing page, dashboard, scan screen and lessons.

Problems found during the audit and fixed:

- Several Open Food Facts records disagreed with the label photos (e.g. YiPPee sodium, Coke Zero sodium, Bourbon, Amul Lassi, Corn Flakes). 21 products were re-checked value-by-value against the label photo; corrections are noted on each product (`source.notes`). 7 remain “community data”.
- OCR misread decimals (“1.5” → “15”) and silently took the first number. v2 validates every value and never auto-corrects.
- The prototype's verdict wording was general (“high in sodium”); it had no notion of a person. v2 adds a deterministic personal engine with explicit priorities.

## 2. Target architecture

```
Browser (Next.js client components)
  ├─ Rules engine (pure TS, same code as server tests)  ← profile held in memory only
  ├─ On-device OCR: Tesseract.js worker (+ preprocessing variants)
  └─ Service worker: caches static assets, OCR files, public pages; never caches /api
        │  HTTPS, HttpOnly session cookie, same-origin check
Next.js server (route handlers, Node runtime)
  ├─ auth.ts     scrypt passwords, opaque session tokens (SHA-256 stored)
  ├─ repo.ts     every query scoped to the session's user id (application-level RLS)
  ├─ crypto.ts   AES-256-GCM for profiles, history, scans, comparisons (AAD = owner + purpose)
  ├─ off.ts      Open Food Facts lookups + 7-day cache
  └─ ocr.ts      proxy to the OCR service (keys/URLs stay server-side)
SQLite (node:sqlite, WAL)          OCR service (Python, RapidOCR = PaddleOCR models on ONNX Runtime)
```

**Why SQLite + app-level scoping instead of Supabase?** The brief allows “Supabase with RLS, or an equivalent architecture”. The deliverable had to run from a ZIP with no hidden credentials, so a hosted Supabase project was not an option for the tested build. The equivalent here is: no API accepts a user id from the client; the user id always comes from the session; every SQL statement on personal tables has `WHERE user_id = ?`; and sensitive columns are encrypted with the owner bound into the ciphertext, so even a scoping bug could not decrypt another user's row. A Postgres/Supabase migration with RLS policies is provided in `db/postgres/` as a reference (not executed in tests).

**Why the rules run in the browser.** The engine is pure and deterministic; running it client-side lets the verdict update instantly when the portion changes, and lets cached products be assessed offline. The profile is fetched from the server after login and kept only in React state (not localStorage).

## 3. Modules (separation of rules from UI)

- `src/lib/rules/suitability.ts` — `assess(product, profile, amount) → Assessment` (status, headline, findings with evidence/rule/source/action, confidence, what was considered).
- `src/lib/rules/alternatives.ts` — `findAlternatives(...)`, real catalogue products only.
- `src/lib/ocr/*` — `image.ts` (pixel ops), `quality.ts`, `parser.ts`, `validate.ts`, `pipeline.ts`, `engines/*`.
- `src/lib/server/*` — everything with secrets or personal data; each file imports `server-only` so it cannot end up in a client bundle.
- UI components only call these functions; they contain no thresholds or rules.

## 4. Data model (SQLite, `db/migrations/001_init.sql`)

`users`, `sessions` (token hash), `profiles` (encrypted), `profile_history` (encrypted snapshots + change summary), `consents` (health_data, cloud_ocr, scan_history — all default off), `settings` (language), `scans` (encrypted), `comparisons` (encrypted), `corrections` (user reports about public product data), `product_cache` (Open Food Facts responses). All personal tables cascade on user deletion.
