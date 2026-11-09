# Known limitations and implementation checklist

## Checklist

✅ implemented and exercised by tests or a browser run · ◐ implemented, partly verified · ✗ not done

| Area | Item | Status |
|---|---|---|
| Pages | Landing, Login/Registration, Onboarding, My Health Profile, Dashboard, Scan Food, OCR Review & Correction, Personalised Analysis, Comparison, Alternatives, Scan History, Teach Me, Privacy & Settings (+ Search, Ask, About data, Offline) | ✅ |
| UX | skeleton loaders, error states, mobile layout (no horizontal scroll at 412 px), keyboard-operable corner editor, focus styles, labelled form controls | ✅ (no formal WCAG audit) |
| Profile | age range, diet (incl. Jain, custom), activity, language, conditions incl. “prefer not to disclose”, allergens (9 major + sulphite + custom), intolerances, goals, clinician vs self-set limits, notes, dated history | ✅ |
| Privacy | consent, scrypt auth, edit/delete, AES-256-GCM at rest, per-user scoping, no public exposure, no health data in logs, export, account deletion, privacy-first defaults, no localStorage | ✅ |
| Privacy | HTTPS | ◐ configured (HSTS, Secure cookies); depends on the host |
| Backend | Supabase + RLS | ◐ reference SQL only; shipped build uses SQLite + equivalent app-level controls |
| OCR | camera, upload, drag-drop, multiple photos, crop + perspective, rotation, retake, quality warnings, variant preprocessing, auto-rotate retry | ✅ |
| OCR | Tesseract offline fallback, RapidOCR (PaddleOCR models) online path | ✅ |
| OCR | Google Vision adapter | ◐ code only, never run (no key) |
| OCR | per-100 & per-serving extraction, validation, review screen with confidence, benchmark vs v1 | ✅ |
| OCR | Hindi/Tamil label text | ✗ English OCR model only |
| Engine | YES/NO/CAUTION with 6 priorities, explanations, “Why am I seeing this?”, portion presets, alternatives | ✅ |
| Data | 28 products kept with sources; OFF barcode lookup/search with cache and attribution; provenance shown everywhere; user corrections stored for review | ✅ |
| Data | review workflow for user corrections | ✗ reports are stored, no admin UI |
| i18n | EN/HI/TA for core UI and all lessons | ◐ translations drafted, not reviewed by native speakers; engine explanations, product data and Ask answers are English |
| PWA | manifest, service worker, offline OCR and lessons | ✅ (e2e scenario 8) |
| Tests | unit, API integration, 9 e2e scenarios | ✅ (see TESTING.md) |
| Food diary | log from products or manually, daily calories eaten/left vs target, nutrient totals, 14-day history, on-track and logging streaks, edit/delete | ✅ |

## Limitations

**OCR accuracy.** On the 21 real label photos in the benchmark, on-device Tesseract reads only about a quarter of values correctly even after preprocessing, and about half of the values it does read are wrong. The review screen and validation catch many errors, but users must check values. The online RapidOCR path is much better (~73% of values correct on the same set) but still not reliable enough to skip review. Two-panel layouts, glossy crumpled packs and rows printed out of alignment remain hard. Product name and brand are not extracted from the nutrition panel; the user types them (or the barcode supplies them). Results are for a 22-image set and are not a general accuracy claim.

**Ingredient and allergen matching is keyword-based.** It covers common English and Indian ingredient names and known ambiguous additives, but cannot know undeclared ingredients, regional spellings it hasn't seen, or ingredients hidden in “spices” or “flavour”. That is why unknown and ambiguous cases are CAUTION, not YES. People with severe allergies must read the physical pack.

**Rules, not medical advice.** Thresholds are published label reference values for an average adult. They are not personalised targets, and the app does not adjust for age, sex, weight, pregnancy, medication or kidney function. Conditions only change which facts are highlighted; kidney disease always yields CAUTION.

**Product data.** 28 bundled products (21 checked against label photos). Open Food Facts records are community data and can be wrong or stale (cached 7 days). Alternatives come only from the bundled catalogue, so some categories have none.

**Translations.** Hindi and Tamil were drafted for this project and need review by native-speaking nutrition educators. Only the scope listed above is translated; the app says so in Settings.

**Security/operations.** Rate limiting is in memory (one process). No account recovery without email (by design — usernames only), no 2FA, manual key rotation. SQLite suits a single instance; scale-out needs Postgres. CSP allows inline scripts (required by Next.js without nonces).

**Food diary.** Calorie targets default to the FSSAI 2,000 kcal label reference, which is a general value, not a personal requirement; users can set their own (800–6,000 kcal) or use a per-day limit from their profile. Totals are only as complete as what is logged, and home-cooked entries rely on the calories the user types. Manual entries are not translated. Days are the device's local date.

**Offline.** Works for pages already cached, the catalogue, lessons and on-device OCR after one online use. The health profile is fetched from the server, so personal verdicts offline only work if the profile was loaded earlier in the session. Saving scans needs a connection.

**Not carried over from the prototype.** The optional AI follow-up answer in Ask FoodDecode (it depended on the artifact host). The rule-based Ask FoodDecode was ported.
