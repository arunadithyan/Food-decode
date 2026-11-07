"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { cleanProfile, ProfileEditor, summariseChange, type Section } from "@/components/ProfileEditor";
import { api, ApiError } from "@/lib/client/api";
import { emptyProfile, type HealthProfile } from "@/lib/profile";

const STEPS: { title: string; sections: Section[] }[] = [
  { title: "Diet", sections: ["diet"] },
  { title: "Allergies & intolerances", sections: ["allergies"] },
  { title: "Health conditions", sections: ["conditions"] },
  { title: "Goals & limits", sections: ["goals"] },
];

export default function Onboarding() {
  const { t, setProfile, refresh, profile: existing } = useApp();
  const router = useRouter();
  const [step, setStep] = useState(-1); // -1 = consent, STEPS.length = privacy choices
  const [consent, setConsent] = useState(false);
  const [withHealth, setWithHealth] = useState(true);
  const [p, setP] = useState<HealthProfile>(existing ?? emptyProfile());
  const [history, setHistory] = useState(false);
  const [cloud, setCloud] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function finish() {
    setBusy(true);
    setErr(null);
    try {
      await api("/api/settings", { method: "PUT", body: { consents: { scan_history: history, cloud_ocr: cloud } } });
      if (withHealth) {
        const clean = cleanProfile(p);
        const r = await api<{ profile: HealthProfile }>("/api/profile", { method: "PUT", body: { profile: clean, consent: true, summary: summariseChange(existing, clean) } });
        setProfile(r.profile);
      }
      await refresh();
      router.replace("/dashboard");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const progress = step < 0 ? 0 : Math.round(((step + 1) / (STEPS.length + 1)) * 100);

  return (
    <div className="page">
      <div className="stack" style={{ gap: 8 }}>
        <span className="eyebrow">Personalise FoodDecode</span>
        <div className="progress" aria-label={`Step progress ${progress}%`}><i style={{ width: `${progress}%` }} /></div>
      </div>

      {step === -1 && (
        <section className="card stack" style={{ gap: 16 }}>
          <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
            <Image src="/illustrations/head.webp" alt="" width={64} height={83} />
            <div className="stack" style={{ gap: 8 }}>
              <h1>Make the answers yours</h1>
              <p>{t("profileIntro")}</p>
            </div>
          </div>
          <div className="card soft stack" style={{ gap: 8 }}>
            <div className="row"><ShieldCheck aria-hidden style={{ color: "var(--teal-ink)" }} /><b>How your health information is handled</b></div>
            <ul className="small" style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>
              <li>Stored encrypted on the FoodDecode server, linked only to your account.</li>
              <li>Only you can read it. It is never shown publicly or written to analytics or logs.</li>
              <li>Used only to check labels for you. You can edit, download or delete it at any time.</li>
              <li>FoodDecode is not a medical service and does not diagnose or treat anything.</li>
            </ul>
          </div>
          <label className="check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />I agree to FoodDecode storing the health information I choose to enter, for checking food labels for me.</label>
          <div className="row">
            <button className="btn primary" disabled={!consent} onClick={() => { setWithHealth(true); setStep(0); }}>{t("continue")}</button>
            <button className="btn ghost" onClick={() => { setWithHealth(false); setStep(STEPS.length); }}>Skip — use FoodDecode without health info</button>
          </div>
        </section>
      )}

      {step >= 0 && step < STEPS.length && (
        <section className="card stack" style={{ gap: 18 }}>
          <h1>{STEPS[step].title}</h1>
          <ProfileEditor value={p} onChange={setP} sections={STEPS[step].sections} />
          <div className="spread">
            <button className="btn ghost" onClick={() => setStep(step - 1)}>{t("back")}</button>
            <button className="btn primary" onClick={() => setStep(step + 1)}>{t("continue")}</button>
          </div>
        </section>
      )}

      {step === STEPS.length && (
        <section className="card stack" style={{ gap: 16 }}>
          <h1>Privacy choices</h1>
          <p className="small muted">Both are off unless you switch them on. You can change them later in Privacy &amp; Settings.</p>
          <label className="check"><input type="checkbox" checked={history} onChange={(e) => setHistory(e.target.checked)} /><span><b>{t("scanHistoryToggle")}</b><br /><span className="small muted">Products you scan or open are saved (encrypted) so you can find them again. Turning this off later deletes the history.</span></span></label>
          <label className="check"><input type="checkbox" checked={cloud} onChange={(e) => setCloud(e.target.checked)} /><span><b>{t("cloudOcrToggle")}</b><br /><span className="small muted">When you pick “Online” on the scan screen, the label photo is sent to the FoodDecode OCR server, read, and discarded — it is not stored. On-device reading is always available and keeps photos on your phone.</span></span></label>
          {err && <p className="err" role="alert">{err}</p>}
          <div className="spread">
            <button className="btn ghost" onClick={() => setStep(withHealth ? STEPS.length - 1 : -1)}>{t("back")}</button>
            <button className="btn primary" onClick={finish} disabled={busy}>{busy ? t("saving") : "Finish"}</button>
          </div>
        </section>
      )}
    </div>
  );
}
