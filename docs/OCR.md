# OCR architecture

## Pipeline

```
photo(s) ─► EXIF orientation ─► user: rotate / drag 4 corners (crop + perspective) ─► quality check
        ─► base preprocessing (grayscale, resize to OCR-friendly size, 1–99% contrast stretch)
        ─► variants, best-first, early exit:
              Tesseract (on-device): base → inverted (if light-on-dark) → median + adaptive threshold → unsharp
              RapidOCR (server):     colour original → base → inverted
        ─► parse each result ─► validate ─► score (fields read, validation errors/warnings, confidence)
        ─► keep best; if very poor, retry rotated 90/270/180°
        ─► merge several photos (field by field, best photo wins; nothing averaged)
        ─► REVIEW SCREEN: “We extracted the following information. Please verify it.”
        ─► user confirms ─► product (provenance: OCR-extracted, user-verified) ─► rules engine
```

Code: `src/lib/ocr/image.ts` (pure pixel functions — grayscale, bilinear/area resize, contrast stretch, invert, 3×3 median, unsharp mask, Bradley–Roth adaptive threshold via integral image, rotation, 4-point homography + perspective warp), `quality.ts`, `parser.ts`, `validate.ts`, `pipeline.ts`, `engines/`.

### Capture
Camera (getUserMedia, rear camera; BarcodeDetector where the browser supports it), the phone's camera app (`capture="environment"`), file upload (multiple), drag-and-drop, up to 4 photos (e.g. nutrition table + ingredients side), the bundled sample label, retake/remove, rotate, and a corner editor (drag or arrow keys) that does crop and perspective correction in one step.

### Quality warnings
Variance of the Laplacian (blur), share of near-white pixels (glare), mean brightness (dark), 2–98% spread (contrast), long side < 700 px (resolution). Warnings are shown before reading and on the review screen.

### Engines
| Engine | Where | Images leave the device? | Notes |
|---|---|---|---|
| Tesseract.js 5 (LSTM, English) | browser Web Worker; files served from `/ocr` | **No** | works offline after first use (service worker + IndexedDB cache) |
| RapidOCR 1.2.3 (PaddleOCR PP-OCR det/rec models on ONNX Runtime) | `services/ocr-server` (self-hosted, CPU) | Yes, to *your* server, after consent; processed in memory, not stored or logged | default “online” engine |
| Google Cloud Vision | adapter in `src/lib/server/ocr.ts` | Yes, to Google, after consent | **not exercised** (no key available); key would stay server-side |

PaddleOCR was investigated as the online path: the official PaddlePaddle runtime is heavy, so the service uses RapidOCR, which packages PaddleOCR's detection/recognition models for ONNX Runtime (pip-installable, CPU-only, ~70 MB).

The browser never receives service URLs or keys: it posts the image to `/api/ocr/server`, which checks the session and the `cloud_ocr` consent, then forwards it.

## Parser (`parser.ts`)
- Recognises nutrient names with OCR-tolerant patterns (“Proten”, “Segars”, “Carbodrate”, “nergy”, glued units like “Fatg”, “Sodiummg”) and ignores look-alikes (mono-/polyunsaturated fat, energy-from-fat, cholesterol, vitamins, %RDA, “sodium bicarbonate” in ingredient lists).
- Detects the column layout (per 100 g/ml, per serving, both, in which order) and reads both columns; skips %RDA values.
- Reads serving size, servings per pack, net quantity, ingredient list, allergen / “may contain” statements and INS codes.
- Conversions are made only when the label states the unit, and are always noted: kJ → kcal, sodium g → mg, salt mg → g, “Nil” → 0, letter O inside a number → 0, “<0.5” → 0.5 (upper bound).
- If two columns run together (“38426913%”) and the serving size is known, the only split consistent with per-serving ≈ per-100 × serving/100 is used — and flagged “please check”. Ambiguous splits are left to the user.
- Values whose label is on one line and numbers on the next are recovered and flagged.
- **Missing values stay empty.** Salt is never silently turned into sodium.

## Validation (`validate.ts`)
Deterministic checks, each with an optional suggestion button (never auto-applied): impossible values (>100 g per 100 g, >900 kcal, negative), protein+carbs+fat > 105 g, saturated+trans > total fat, sugars > carbohydrates, added > total sugars, Atwater energy check (±15%), per-100 vs per-serving ratio (with ÷10/×10 decimal-error suggestions), sodium vs salt (×2.5, ±15%), sodium that looks like grams, implausibly high sodium, serving size missing/out of range/larger than pack, servings-per-pack mismatch, missing critical nutrients, missing ingredient list.

Confidence on the review screen per field: *Read clearly* / *Check this* / *Low confidence* / *Not found* / *Entered by you*, from the engine's line confidence, parser notes and validation issues. The user must confirm; unresolved errors require an explicit tick and make the verdict CAUTION (priority 6).

## Benchmark
`npm run bench:ocr` (results in `bench/RESULTS.md`, raw in `bench/results.json`).

- **Set**: 21 real Indian label photos from Open Food Facts (crumpled foil, glare, light-on-dark, angled, low-resolution, misaligned rows, US-style panel) + 1 synthetic label. Ground truth transcribed by hand from each photo: `bench/ground-truth.json`.
- **Systems**: v1 = prototype preprocessing + prototype parser (kept verbatim in `bench/legacy/`) on Tesseract; v2 on-device = Tesseract + variant selection + v2 parser; v2 server = RapidOCR + v2 parser; plus each Tesseract variant alone (evidence for the variant order).
- **Metrics**: field accuracy (value for the label's main column within ±0.5%), share of read values that are wrong, unit/scale correctness (energy, sodium), serving-size accuracy, line-matched CER/WER, time per label.

Results from the run made for this delivery (CPU-only container; see `bench/RESULTS.md` for per-label detail):

| System | Field accuracy | Labels fully correct | Wrong when a value was read | Unit/scale correct (energy, sodium) | Serving size correct | CER | WER | Median time / label |
|---|---|---|---|---|---|---|---|---|
| v1 prototype (Tesseract, 2% stretch, v1 parser) | 23.5% (43/183) | 0/22 | 50.6% | 45.0% | 11.1% (18 labels) | 41.6% | 76.6% | 1.0 s |
| v2 on-device (Tesseract, variant selection, v2 parser) | 26.2% (48/183) | 1/22 | 50.0% | 57.9% | 16.7% (18 labels) | 39.1% | 75.9% | 4.6 s |
| v2 server (RapidOCR / PaddleOCR models, v2 parser) | 73.2% (134/183) | 4/22 | 15.2% | 89.2% | 44.4% (18 labels) | 22.4% | 64.0% | 2.2 s |
|   variant: base (gray + resize + stretch) | 24.0% (44/183) | 1/22 | 45.0% | 68.4% | 11.1% (18 labels) | 42.0% | 77.6% | 1.3 s |
|   variant: inverted | 31.8% (14/44) | 1/6 | 41.7% | 85.7% | 0.0% (4 labels) | 38.5% | 78.2% | 1.6 s |
|   variant: median + adaptive threshold | 21.9% (40/183) | 0/22 | 56.5% | 50.0% | 16.7% (18 labels) | 42.3% | 80.8% | 0.9 s |
|   variant: unsharp mask | 22.4% (41/183) | 0/22 | 48.1% | 66.7% | 16.7% (18 labels) | 44.6% | 79.9% | 1.3 s |

What this shows, honestly:
- On these hard real-world photos **Tesseract is weak** whatever the preprocessing; v2's changes give a modest gain on-device. That is why the review step and validation are mandatory and why on-device readings show many “check this” flags.
- The self-hosted **RapidOCR path roughly triples field accuracy** compared with the prototype, with far fewer wrong values. It is the recommended engine when the user consents to online OCR.
- No variant is best everywhere (inversion matters only for light-on-dark labels), which is why the pipeline tries several and scores them instead of using one fixed filter.
- These figures are for this 22-image set only; they are not a general accuracy claim.
