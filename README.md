# FoodDecode 2.0

Personalised, explainable food-label intelligence for Indian packaged foods. You scan a label (or look up a product), check the values the app read, and get a **YES / NO / CAUTION** answer for *your* allergies, diet, clinician-advised limits and goals, at the portion you actually eat. Every answer shows the rule and the numbers behind it.

This is the full-stack upgrade of the FoodDecode prototype (a single static HTML page). It keeps the prototype's 28 products, label interpretation, portion engine, ingredient/INS explainer, comparison, Teach Me lessons, Ask FoodDecode and visual identity, and adds accounts, an encrypted health profile, a deterministic suitability engine, a much stronger OCR pipeline, Open Food Facts lookups, offline support and EN/HI/TA.

> FoodDecode explains labels. It does not diagnose, treat, or replace a doctor or dietitian.

## Quick start (local)

Requirements: **Node.js 22.13+** (uses the built-in `node:sqlite`; no native builds). Python 3.10+ only if you want the optional online OCR service.

```bash
npm install
npm run setup        # creates .env.local with a fresh encryption key, the SQLite DB and the demo accounts
npm run dev          # http://localhost:3000
```

Production build: `npm run build && npm start`. Over plain `http://localhost`, add `FD_INSECURE_COOKIES=1` (production cookies are `Secure` by default).

Optional online OCR (more accurate on real phone photos — see `bench/RESULTS.md`):

```bash
python3 -m venv .venv && .venv/bin/pip install -r services/ocr-server/requirements.txt
.venv/bin/python services/ocr-server/server.py           # http://127.0.0.1:8765
# then set OCR_SERVICE_URL=http://127.0.0.1:8765 in .env.local and restart the app
```

Without it the app works fully with on-device OCR; the "Online" option is shown as unavailable.

### Demo accounts (synthetic people, no real health data)

Password for all: **`FoodDecode-demo-2026`**

| Username | Profile | Try |
|---|---|---|
| `demo.general` | no restrictions | Maggi → YES |
| `demo.peanut` | peanut + tree-nut allergy | Maggi → **NO** (lists hydrolysed groundnut protein) |
| `demo.diabetes` | vegetarian, diabetes, monitors carbs, reduce sugar | Coca-Cola → CAUTION, alternative Coke Zero |
| `demo.bp` | high blood pressure, reduce sodium, clinician-advised 1,500 mg/day sodium | Haldiram's Aloo Bhujia: 30 g YES → 90 g CAUTION, alternative Bingo |
| `demo.jain` | Jain diet, lactose intolerance (scan history off) | Maggi → NO (onion, garlic) |

## Scripts

| Command | What it does |
|---|---|
| `npm run setup` | `.env.local` + database + demo accounts (idempotent) |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run seed` | re-create/refresh demo accounts |
| `npm test` | unit tests (engine, OCR parser/validation, preprocessing, profile validation, crypto) |
| `npm run test:api` | HTTP integration tests against a running server |
| `npm run test:e2e` | Playwright: the 8 demo scenarios in a real browser |
| `npm run bench:ocr` | OCR benchmark (v1 vs v2) → `bench/RESULTS.md` |
| `npm run ocr-server` | start the optional RapidOCR service |
| `npm run typecheck` | TypeScript |

## Folder structure

```
src/
  app/                    Next.js App Router
    page.tsx              landing
    (auth)/               login, register
    (app)/                pages inside the app shell
      (private)/          dashboard, onboarding, profile, history, settings (server-side session check)
      scan/, scan/review/ scan food, OCR review & correction
      product/[id]/       personalised food analysis
      alternatives/[id]/  recommended alternatives
      compare/, search/, learn/, ask/, about/, offline/
    api/                  route handlers (auth, profile, scans, comparisons, corrections, settings,
                          account, products, ocr/server)
  components/             UI (AppShell, ProfileEditor, analysis: VerdictCard/PortionControl/NutritionPanel…)
  lib/
    rules/                suitability engine + alternatives (deterministic, no UI)
    ingredients/          allergen, diet and ingredient-list parsing
    nutrition/            reference values, portion maths
    ocr/                  preprocessing, quality checks, parser, validation, pipeline, engine adapters
    server/               db (SQLite), crypto (AES-256-GCM, scrypt), auth, per-user repo, OFF client, OCR proxy
    i18n/                 EN/HI/TA strings and lessons
    kb/                   INS additives, glossary, Ask FoodDecode rules
    data/products.json    28 products with provenance and source links
db/migrations/            SQLite schema;  db/postgres/ Supabase + RLS reference (untested)
services/ocr-server/      self-hosted RapidOCR (PaddleOCR models) service
bench/                    OCR benchmark: 22 labelled photos, ground truth, runner, results
tests/unit, tests/api, e2e/   tests
docs/                     architecture, OCR, engine, privacy, testing, limitations, deployment
public/                   OCR engine files (Tesseract), illustrations from the deck, PWA files
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — audit of the prototype, what was kept, what changed and why
- [docs/OCR.md](docs/OCR.md) — OCR pipeline, engines, validation, benchmark method and results
- [docs/RECOMMENDATION-ENGINE.md](docs/RECOMMENDATION-ENGINE.md) — rules, priorities, reference values, alternatives
- [docs/PRIVACY-SECURITY.md](docs/PRIVACY-SECURITY.md) — consent, encryption, access control, logging, export/deletion
- [docs/TESTING.md](docs/TESTING.md) — how to run tests, and the results of the runs made for this delivery
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — deploying the app and the OCR service
- [docs/LIMITATIONS.md](docs/LIMITATIONS.md) — known limitations and the implementation checklist

## External services

| Service | Used for | Without it |
|---|---|---|
| Open Food Facts (public API, no key) | barcode lookup and search beyond the bundled 28 products | bundled catalogue, label scanning |
| FoodDecode OCR service (self-hosted, optional) | online OCR | on-device OCR |
| Google Cloud Vision (optional, key server-side) | alternative online OCR adapter — not exercised in tests | as above |

No hidden credentials are needed. Product data: Open Food Facts contributors (ODbL); label photos CC BY-SA.
