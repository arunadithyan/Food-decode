"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Barcode, Camera, Check, CloudUpload, ImagePlus, RotateCw, Smartphone, Trash2, Undo2, X } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Banner } from "@/components/ui";
import { api, ApiError } from "@/lib/client/api";
import { sessionStore } from "@/lib/client/session-store";
import { loadImageFile, rotateRGBA, toCanvas } from "@/lib/ocr/engines/browser-image";
import { serverEngine } from "@/lib/ocr/engines/server-client";
import { tesseractEngine } from "@/lib/ocr/engines/tesseract-browser";
import { toGray, downscaleGray, warpPerspective, type Pt, type RGBA } from "@/lib/ocr/image";
import { mergeParsed, ocrImage, type OcrEngine } from "@/lib/ocr/pipeline";
import { assessQuality, type QualityReport } from "@/lib/ocr/quality";
import { draftFromParsed } from "@/lib/ocr/validate";
import type { Product } from "@/lib/types";

interface Photo { id: string; url: string; rgba: RGBA; rot: 0 | 90 | 180 | 270; corners: Pt[]; quality: QualityReport; name: string }
const FULL: Pt[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const isFull = (c: Pt[]) => c.every((p, i) => Math.abs(p.x - FULL[i].x) < 0.002 && Math.abs(p.y - FULL[i].y) < 0.002);

/** Corner editor: drag the four handles onto the corners of the nutrition table (crop + perspective correction). */
function CornerEditor({ photo, onChange }: { photo: Photo; onChange(c: Pt[]): void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<RGBA | null>(null);
  useEffect(() => {
    const r = rotateRGBA(photo.rgba, photo.rot);
    setView(r);
    const c = ref.current;
    if (!c) return;
    const src = toCanvas(r);
    const s = Math.min(1, 1200 / Math.max(r.width, r.height));
    c.width = Math.round(r.width * s);
    c.height = Math.round(r.height * s);
    c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  }, [photo.rgba, photo.rot]);
  const drag = (i: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const b = box.current!.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (ev.clientX - b.left) / b.width));
      const y = Math.min(1, Math.max(0, (ev.clientY - b.top) / b.height));
      onChange(photo.corners.map((p, j) => (j === i ? { x, y } : p)));
    };
    const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };
  const nudge = (i: number) => (e: React.KeyboardEvent) => {
    const d = e.shiftKey ? 0.05 : 0.01;
    const dx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0, dy = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    onChange(photo.corners.map((p, j) => (j === i ? { x: Math.min(1, Math.max(0, p.x + dx)), y: Math.min(1, Math.max(0, p.y + dy)) } : p)));
  };
  const names = ["top-left", "top-right", "bottom-right", "bottom-left"];
  return (
    <div className="editor" ref={box} data-testid="corner-editor">
      <canvas ref={ref} aria-label={`Photo ${photo.name}`} />
      {view && (
        <svg className="quad" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <polygon points={photo.corners.map((p) => `${p.x * 100},${p.y * 100}`).join(" ")} fill="rgba(255,213,138,.12)" stroke="#FFD58A" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {photo.corners.map((p, i) => (
        <button key={i} type="button" className="hnd" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} onPointerDown={drag(i)} onKeyDown={nudge(i)} aria-label={`Move ${names[i]} corner (arrow keys)`} />
      ))}
    </div>
  );
}

function CameraCapture({ onPhoto, onClose, onBarcode }: { onPhoto(b: Blob): void; onClose(): void; onBarcode(code: string): void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (video.current) { video.current.srcObject = stream; await video.current.play(); }
        // Barcode detection where the browser supports it (e.g. Chrome on Android)
        const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> } }).BarcodeDetector;
        if (BD) {
          const det = new BD({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
          timer = setInterval(async () => {
            if (!video.current || video.current.readyState < 2) return;
            try { const r = await det.detect(video.current); if (r[0]?.rawValue) onBarcode(r[0].rawValue); } catch { /* ignore */ }
          }, 700);
        }
      } catch {
        setErr("Camera not available. Allow camera access in your browser settings, or upload a photo instead.");
      }
    })();
    return () => { if (timer) clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, [onBarcode]);
  const snap = () => {
    const v = video.current;
    if (!v) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob((b) => b && onPhoto(b), "image/jpeg", 0.95);
  };
  return (
    <div className="card stack">
      {err ? <p className="err">{err}</p> : <video ref={video} playsInline muted aria-label="Camera preview" />}
      <p className="small muted">Fill the frame with the nutrition table, avoid glare, hold steady. Barcodes are detected automatically where supported.</p>
      <div className="row"><button className="btn primary" onClick={snap} disabled={!!err}><Camera /> Capture</button><button className="btn ghost" onClick={onClose}><X /> Close camera</button></div>
    </div>
  );
}

export function ScanView() {
  const { t, user, consents, setConsentsLocal, online } = useApp();
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [over, setOver] = useState(false);
  const [engineMode, setEngineMode] = useState<"device" | "online">("device");
  const [engines, setEngines] = useState<{ id: string; label: string; available: boolean }[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [barcode, setBarcode] = useState("");
  const [bcMsg, setBcMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) api<{ engines: { id: string; label: string; available: boolean }[] }>("/api/ocr/server").then((r) => setEngines(r.engines)).catch(() => setEngines([]));
  }, [user]);
  const onlineAvailable = !!engines?.some((e) => e.available) && online;

  const addFiles = useCallback(async (files: Blob[], names?: string[]) => {
    setErr(null);
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!/^image\//.test(f.type)) { setErr("Only image files can be scanned."); continue; }
      if (f.size > 20 * 1024 * 1024) { setErr("That image is larger than 20 MB."); continue; }
      try {
        const rgba = await loadImageFile(f);
        const quality = assessQuality(downscaleGray(toGray(rgba), 1200));
        const p: Photo = { id: crypto.randomUUID(), url: URL.createObjectURL(f), rgba, rot: 0, corners: FULL, quality, name: names?.[i] || (f as File).name || `photo ${photos.length + i + 1}` };
        setPhotos((ps) => (ps.length >= 4 ? ps : [...ps, p]));
        setSel(p.id);
      } catch (e) {
        setErr((e as Error).message);
      }
    }
  }, [photos.length]);

  const lookupBarcode = useCallback(async (code: string) => {
    const c = code.replace(/\D/g, "");
    if (c.length < 6) { setBcMsg("Enter the 8–14 digit number under the barcode."); return; }
    setBcMsg(t("loading"));
    try {
      const r = await api<{ product: Product | null; offline?: boolean; message?: string }>(`/api/products/barcode/${c}`);
      if (r.product) {
        sessionStore.putProduct(r.product);
        setCamera(false);
        router.push(`/product/${r.product.id}`);
      } else setBcMsg(r.offline ? r.message! : "No record for this barcode in FoodDecode or Open Food Facts. Photograph the label instead.");
    } catch (e) {
      setBcMsg(e instanceof ApiError ? e.message : "Lookup failed.");
    }
  }, [router, t]);

  const useSample = async () => {
    const r = await fetch("/sample-label.png");
    const b = await r.blob();
    await addFiles([new File([b], "sample-label.png", { type: "image/png" })], ["Sample label (fictional)"]);
  };

  const current = photos.find((p) => p.id === sel) || null;
  const update = (id: string, patch: Partial<Photo>) => setPhotos((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const remove = (id: string) => {
    setPhotos((ps) => {
      const p = ps.find((x) => x.id === id);
      if (p) URL.revokeObjectURL(p.url);
      const rest = ps.filter((x) => x.id !== id);
      setSel(rest[0]?.id ?? null);
      return rest;
    });
  };

  async function enableCloud() {
    try {
      await api("/api/settings", { method: "PUT", body: { consents: { cloud_ocr: true } } });
      setConsentsLocal({ cloud_ocr: true });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not save your choice.");
    }
  }

  async function run() {
    setErr(null);
    setProgress(0);
    let engine: OcrEngine;
    if (engineMode === "online") engine = serverEngine(engines?.find((e) => e.available)?.id);
    else engine = tesseractEngine((m) => {
      if (m.status === "recognizing text") setProgress((p) => Math.max(p, m.progress));
      else setBusy(m.status === "loading language traineddata" ? "Loading the English OCR model (first time only)…" : m.status === "initializing tesseract" || m.status === "loading tesseract core" ? "Starting the on-device OCR engine…" : null);
    });
    try {
      const parsed = [];
      let text = "", variant = "", ms = 0;
      const warnings: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        setBusy(`Reading photo ${i + 1} of ${photos.length}…`);
        let img = rotateRGBA(p.rgba, p.rot);
        if (!isFull(p.corners)) img = warpPerspective(img, p.corners.map((c) => ({ x: c.x * (img.width - 1), y: c.y * (img.height - 1) })));
        const r = await ocrImage(img, engine, { onProgress: (s) => setBusy(`Photo ${i + 1}: ${s}…`) });
        parsed.push(r.parsed);
        text += (text ? "\n\n" : "") + r.text;
        variant += (variant ? ", " : "") + r.variant;
        ms += r.ms;
        warnings.push(...r.quality.warnings.map((w) => `Photo ${i + 1}: ${w.message}`));
      }
      const merged = mergeParsed(parsed);
      const illustrative = /made-up label|fictional product/i.test(text);
      const draft = draftFromParsed(merged, illustrative ? { name: "Crunchy Cream Biscuits (sample)", brand: "Sample label — fictional" } : {});
      sessionStore.setPending({ draft, parsed: merged, text, engine: engine.label, variant, ms, qualityWarnings: warnings, photoUrls: photos.map((p) => p.url), illustrative });
      router.push("/scan/review");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : engineMode === "device" ? "On-device OCR could not start. If you are offline, it needs to have been used once while online so its files are cached." : "Online OCR failed. Try on-device OCR instead.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page">
      <div className="spread">
        <div className="stack" style={{ gap: 6 }}>
          <span className="eyebrow">{t("navScan")}</span>
          <h1>{t("scanTitle")}</h1>
        </div>
        <Image src="/illustrations/scanner.webp" alt="" width={70} height={83} />
      </div>
      <div className="steps" aria-label="Steps"><span className="on">1 Photo</span><span>2 Read</span><span>3 Verify</span><span>4 Your answer</span></div>

      <section className="card stack" aria-labelledby="bc-h">
        <h2 id="bc-h" className="h3"><Barcode size={18} style={{ display: "inline", verticalAlign: "-3px" }} /> {t("barcode")}</h2>
        <form className="row" onSubmit={(e) => { e.preventDefault(); lookupBarcode(barcode); }}>
          <input className="input" style={{ flex: 1, minWidth: 180 }} inputMode="numeric" pattern="[0-9]*" maxLength={14} placeholder="e.g. 8901058023787" value={barcode} onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ""))} aria-label="Barcode number" />
          <button className="btn">{t("lookUp")}</button>
        </form>
        {bcMsg && <p className="small" role="status">{bcMsg}</p>}
      </section>

      {camera ? (
        <CameraCapture onPhoto={(b) => { addFiles([b], ["camera photo"]); setCamera(false); }} onClose={() => setCamera(false)} onBarcode={(c) => { setBarcode(c); lookupBarcode(c); }} />
      ) : (
        <div
          className={`drop ${over ? "over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); addFiles([...e.dataTransfer.files]); }}
          data-testid="dropzone"
        >
          <span className="big">Photograph the nutrition table</span>
          <p className="small muted">Add up to 4 photos — e.g. the nutrition table and the ingredients side. {t("dropHere")}.</p>
          <div className="row" style={{ justifyContent: "center" }}>
            <button className="btn primary" onClick={() => setCamera(true)}><Camera /> {t("takePhoto")}</button>
            <button className="btn" onClick={() => camFileRef.current?.click()}><Smartphone /> Phone camera app</button>
            <button className="btn" onClick={() => fileRef.current?.click()}><ImagePlus /> {t("uploadPhoto")}</button>
          </div>
          <button className="btn ghost sm" onClick={useSample}>{t("useSample")}</button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles([...(e.target.files || [])]); e.target.value = ""; }} data-testid="file-input" />
          <input ref={camFileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles([...(e.target.files || [])]); e.target.value = ""; }} />
        </div>
      )}
      {err && <p className="err" role="alert">{err}</p>}

      {photos.length > 0 && (
        <section className="card stack" aria-labelledby="ph-h">
          <div className="spread"><h2 id="ph-h" className="h3">Your photos</h2><span className="small muted">{photos.length}/4</span></div>
          <div className="thumbs">
            {photos.map((p) => (
              <button key={p.id} className="thumb" aria-pressed={p.id === sel} onClick={() => setSel(p.id)} aria-label={`Select ${p.name}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" style={{ transform: `rotate(${p.rot}deg)` }} />
              </button>
            ))}
          </div>
          {current && (
            <div className="stack">
              <p className="small muted">Drag the yellow corners onto the four corners of the table to crop and straighten it.</p>
              <CornerEditor photo={current} onChange={(c) => update(current.id, { corners: c })} />
              <div className="row">
                <button className="btn sm" onClick={() => update(current.id, { rot: (((current.rot + 90) % 360) as Photo["rot"]), corners: FULL })}><RotateCw /> {t("rotate")}</button>
                <button className="btn sm" onClick={() => update(current.id, { corners: FULL })} disabled={isFull(current.corners)}><Undo2 /> Reset corners</button>
                <button className="btn ghost sm" onClick={() => remove(current.id)}><Trash2 /> {t("retake")}</button>
              </div>
              {current.quality.warnings.length > 0 ? (
                <div className="stack" style={{ gap: 4 }} role="status">{current.quality.warnings.map((w) => <p key={w.code} className="qwarn">⚠ {w.message}</p>)}</div>
              ) : <p className="okmsg"><Check size={15} style={{ display: "inline", verticalAlign: "-2px" }} /> Photo looks sharp and evenly lit.</p>}
            </div>
          )}

          <fieldset className="stack" style={{ gap: 8 }}>
            <legend className="h3">How should the label be read?</legend>
            <label className="opt" style={{ alignItems: "flex-start" }}>
              <input type="radio" name="eng" checked={engineMode === "device"} onChange={() => setEngineMode("device")} />
              <span><b>{t("onDevice")}</b><br /><span className="small muted">{t("onDeviceSub")}</span></span>
            </label>
            <label className="opt" style={{ alignItems: "flex-start", opacity: onlineAvailable ? 1 : 0.6 }}>
              <input type="radio" name="eng" disabled={!onlineAvailable} checked={engineMode === "online"} onChange={() => setEngineMode("online")} />
              <span><b>{t("online")}</b><br /><span className="small muted">{t("onlineSub")}</span>
                {!user && <><br /><span className="small">Log in to use online OCR.</span></>}
                {user && engines && !engines.some((e) => e.available) && <><br /><span className="small">Not available on this server right now.</span></>}
                {!online && <><br /><span className="small">You are offline.</span></>}
              </span>
            </label>
            {engineMode === "online" && !consents.cloud_ocr && (
              <Banner kind="warn">
                <span><b>Your photo will leave this device.</b> It is sent over HTTPS to the FoodDecode OCR server, read, and discarded — not stored or logged. Health profile data is never sent with it.</span>
                <div className="row"><button className="btn sm primary" onClick={enableCloud}><CloudUpload /> I agree — allow online OCR</button><button className="btn sm ghost" onClick={() => setEngineMode("device")}>Use on-device instead</button></div>
              </Banner>
            )}
          </fieldset>

          {busy ? (
            <div className="stack" role="status" aria-live="polite">
              <p className="small"><b>{busy}</b></p>
              <div className="progress"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
              <p className="small muted">FoodDecode tries several image clean-ups (contrast, sharpening, adaptive threshold) and keeps the reading that is most complete and consistent.</p>
            </div>
          ) : (
            <button className="btn primary block" onClick={run} disabled={engineMode === "online" && !consents.cloud_ocr} data-testid="read-label">{t("readLabel")}</button>
          )}
        </section>
      )}
      <p className="small muted">Prefer typing? <Link className="link" href="/scan/review?manual=1">Enter label values by hand</Link>.</p>
    </div>
  );
}
