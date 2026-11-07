# FoodDecode OCR service

Self-hosted online OCR for FoodDecode, using **RapidOCR** — PaddleOCR's PP-OCR text detection and recognition models running on ONNX Runtime (CPU). It is the “Online (more accurate)” option on the scan screen.

- `POST /ocr` — raw image bytes (`image/jpeg|png|webp`, ≤ 8 MB), header `X-OCR-Token` when `OCR_SERVICE_TOKEN` is set → `{ engine, ms, lines: [{ text, conf }] }`. Word boxes are grouped into lines by vertical overlap.
- `GET /health`

Images are decoded in memory and discarded; nothing is written to disk and request contents are never logged.

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python server.py            # HOST=127.0.0.1 PORT=8765 by default
```
Tested with Python 3.13, rapidocr-onnxruntime 1.2.3, onnxruntime 1.31. The Dockerfile is provided but was not exercised.
