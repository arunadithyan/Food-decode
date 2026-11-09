# Testing

## How to run

```bash
npm test                    # unit tests (no server needed)

# integration + end-to-end tests run against a real production build:
npm run build
FD_REGISTER_LIMIT=1000 FD_INSECURE_COOKIES=1 npm start > .data/server.log 2>&1 &   # raise the sign-up rate limit for the test run
npm run test:api            # HTTP API tests (also read .data/fooddecode.db and .data/server.log)
npx playwright install chromium   # once; or set PW_CHROMIUM=/path/to/chrome
npm run test:e2e            # the 8 demo scenarios in Chromium

npm run bench:ocr           # OCR benchmark (start services/ocr-server first to include the server engine)
```

## What is covered

| Suite | File | Covers |
|---|---|---|
| Unit (57) | `tests/unit/engine.test.ts` | allergen matching (confirmed / may-contain / unknown / ambiguous / false friends), diet rules (Jain, vegan, vegetarian, INS 471, coeliac), same food × different profiles, portion maths and 30 g→90 g verdict change, clinician vs self-set limits, kidney CAUTION, illustrative data never YES, unresolved OCR → CAUTION, explanation fields, alternatives (real products, none invented), sodium↔salt, Ask FoodDecode |
| | `tests/unit/ocr.test.ts` | parser: two columns, %RDA skipped, serving/pack/ingredients/allergen statement/INS, “sodium bicarbonate” not read as sodium, missing values stay empty, space-less OCR text, kJ and g-sodium conversions with notes, “Nil”, run-together columns, MUFA not read as saturated fat, multi-photo merge; validation: fat parts, sugars, sodium vs salt, salt never silently converted, gram-sodium, per-100/per-serving mismatch with the right decimal suggestion, impossible and missing values, serving size requirement, user-verified product creation; preprocessing: adaptive threshold, inversion detection, homography |
| | `tests/unit/diary.test.ts` | diary entries from products, validation, day totals with unknowns, target precedence (own > profile limit > reference), on-track rule, streaks |
| | `tests/unit/profile-crypto.test.ts` | profile validation (unknown values, bad limits, prefer-not-to-disclose, markup stripping), AES-GCM round-trip and owner binding, scrypt |
| API (17) | `tests/api/api.test.ts` | registration rules, login/logout, uniform errors, HttpOnly/SameSite cookie, 401 on protected endpoints, server-side redirect of private pages, cross-site Origin rejected, login rate limit, consent required before storing health data, profile CRUD + history + validation + deletion (withdraws consent), **plaintext absent from the database file**, **user isolation** (B cannot read/delete/list A's scans, profile or export), scan history on/off (off deletes), comparisons, corrections, language, online OCR needs consent, export, account deletion (wrong password refused; login impossible after), product endpoints, **server log contains no health data** |
| E2E (9) | `e2e/demo.spec.ts` | the eight demo scenarios below + the food diary |

## Results of the runs made for this delivery (7 Nov 2026)

Environment: Linux container, Node 22.23.4, Next.js 15.5.29 production build, Chromium 1243 (Playwright 1.56.1), RapidOCR service running locally.

- `vitest run tests/unit` — **57 passed / 57**
- `vitest run tests/api` against the production server — **17 passed / 17** (adds food diary consent, CRUD, isolation, deletion on switch-off, export)
- `playwright test` — **9 passed / 9**:
  1. personalisation — new user registers, consents, sets diet/allergy/goal; dashboard shows them ✅
  2. same food, different profiles — Maggi YES for `demo.general`, NO (onion/garlic) for `demo.jain` ✅
  3. improved OCR — on-device OCR reads the sample label (energy 500, sodium 600, added sugar 26.7), user corrects a value and confirms; result is not YES because the label is illustrative ✅
  4. allergen conflict — `demo.peanut` + Maggi → NO citing “groundnut”; “Why am I seeing this” shows the priority order ✅
  5. portion — `demo.bp`, Haldiram's Aloo Bhujia: 30 g YES → 90 g CAUTION (sodium) ✅
  6. alternatives — CAUTION at 90 g suggests Bingo (lower sodium); alternatives page compares sodium side by side ✅
  7. privacy — profile edited (history entry), exported, invisible to another user, deleted ✅
  9. food diary — “I ate this” on a product, a manual home-cooked entry, calories eaten/left update, streak shown, previous-day navigation ✅ (run 10 Nov 2026)
  8. offline — after one online use, with the network switched off: the scan page loads from the service worker, on-device OCR reads the sample label, and a lesson opens ✅
- `npm run bench:ocr` — see `bench/RESULTS.md` and `docs/OCR.md`.
- Manual checks: phone-width layout (Pixel 7 emulation: no horizontal scroll), Tamil UI on the product page, browser console free of errors on the main flow.

Not tested: the Google Vision adapter (no API key), the Dockerfile, the Postgres/Supabase migration, real-device camera capture (camera code paths were exercised only via file upload and the sample label), screen-reader behaviour beyond semantic markup.
