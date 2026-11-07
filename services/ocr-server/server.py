"""
FoodDecode OCR service — self-hosted, open-source OCR for the "online" path.

Engine: RapidOCR (PaddleOCR PP-OCR detection + recognition models converted to ONNX), CPU only.
No image is written to disk or logged; each request is processed in memory and discarded.

  POST /ocr     body: raw image bytes (image/jpeg | image/png | image/webp), header X-OCR-Token if OCR_SERVICE_TOKEN is set
                -> {"engine": "rapidocr", "ms": 812, "lines": [{"text": "...", "conf": 93.1}, ...]}
  GET  /health  -> {"ok": true}

Run:  python server.py            (PORT, default 8765; HOST default 127.0.0.1)
"""
import json
import os
import statistics
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import cv2
import numpy as np
from rapidocr_onnxruntime import RapidOCR

MAX_BYTES = 8 * 1024 * 1024
TOKEN = os.environ.get("OCR_SERVICE_TOKEN", "")
ENGINE = RapidOCR()


def group_lines(result):
    """Group word boxes into text lines by vertical overlap, then order left to right."""
    boxes = []
    for box, text, conf in result or []:
        ys = [p[1] for p in box]
        xs = [p[0] for p in box]
        boxes.append({"cy": (min(ys) + max(ys)) / 2, "h": max(ys) - min(ys), "x": min(xs), "x2": max(xs), "text": text, "conf": float(conf)})
    if not boxes:
        return []
    med_h = statistics.median(b["h"] for b in boxes) or 10
    boxes.sort(key=lambda b: b["cy"])
    lines, cur = [], [boxes[0]]
    for b in boxes[1:]:
        line_cy = sum(x["cy"] for x in cur) / len(cur)
        if abs(b["cy"] - line_cy) <= 0.55 * med_h:
            cur.append(b)
        else:
            lines.append(cur)
            cur = [b]
    lines.append(cur)
    out = []
    for ln in lines:
        ln.sort(key=lambda b: b["x"])
        text = ""
        for i, b in enumerate(ln):
            if i:
                gap = b["x"] - ln[i - 1]["x2"]
                text += "  " if gap > 1.5 * med_h else " "
            text += b["text"]
        out.append({"text": text, "conf": round(100 * sum(b["conf"] for b in ln) / len(ln), 1)})
    return out


class Handler(BaseHTTPRequestHandler):
    server_version = "FoodDecodeOCR/1.0"

    def log_message(self, fmt, *args):  # never log request contents
        pass

    def _send(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, {"ok": True, "engine": "rapidocr"})
        self._send(404, {"error": "not_found"})

    def do_POST(self):
        if self.path != "/ocr":
            return self._send(404, {"error": "not_found"})
        if TOKEN and self.headers.get("X-OCR-Token") != TOKEN:
            return self._send(401, {"error": "unauthorized"})
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > MAX_BYTES:
            return self._send(413, {"error": "bad_size"})
        data = self.rfile.read(n)
        img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
        del data
        if img is None:
            return self._send(400, {"error": "bad_image"})
        t = time.time()
        result, _ = ENGINE(img)
        ms = int((time.time() - t) * 1000)
        self._send(200, {"engine": "rapidocr", "ms": ms, "lines": group_lines(result)})


if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8765"))
    print(f"FoodDecode OCR service on http://{host}:{port}")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
