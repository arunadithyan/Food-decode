import Link from "next/link";
import { DAILY_REFERENCE, PER100_BANDS, PER100_BAND_SOURCE, GOOD_THRESHOLDS, PORTION_HIGH_SHARE, PORTION_LOW_SHARE } from "@/lib/nutrition/reference";
import { PRODUCTS } from "@/lib/catalogue";
import { NUTRIENT_LABEL, type NutrientKey } from "@/lib/types";
import { Disclaimer } from "@/components/ui";

export const metadata = { title: "About the data" };

export default function About() {
  const checked = PRODUCTS.filter((p) => p.provenance === "label-photo-checked").length;
  return (
    <div className="page prose" style={{ maxWidth: 820 }}>
      <h1>How FoodDecode works</h1>
      <p className="lede">Where the numbers come from, the rules behind every answer, and how your data is handled.</p>

      <h2 id="sources">Product data</h2>
      <ul>
        <li><b>Label-photo checked</b> ({checked} products): Open Food Facts records that the FoodDecode team compared value by value against the photo of the printed label, correcting errors (each correction is noted on the product).</li>
        <li><b>Community data</b>: Open Food Facts records (ODbL) checked only for internal consistency, and any product fetched live by barcode or search. Never treated as medically verified.</li>
        <li><b>Your scan</b>: values read from your photo by OCR and confirmed by you.</li>
        <li><b>Illustrative</b>: the fictional sample label. FoodDecode never gives YES on illustrative data.</li>
      </ul>
      <p>Missing values are shown as “–” and treated as unknown, never as zero.</p>

      <h2 id="rules">How an answer is decided</h2>
      <ol>
        <li><b>Allergens</b> — an allergen you listed in the ingredients or a “contains” statement → NO. “May contain”, shared-facility warnings or unclear ingredients (e.g. “vegetable protein”) → CAUTION. No ingredient information → CAUTION (unknown is not allergen-free).</li>
        <li><b>Diet and intolerances</b> — a conflicting ingredient → NO; additives that can come from animal or plant sources → CAUTION.</li>
        <li><b>Limits your clinician gave you</b> — exceeded for the portion → NO. Some conditions (e.g. kidney disease) always get CAUTION because the label alone can&apos;t answer the question.</li>
        <li><b>Your goals</b> — a portion giving ≥{PORTION_HIGH_SHARE * 100}% of a daily reference for a nutrient you want to limit → CAUTION.</li>
        <li><b>Portion facts</b> and <b>6. missing information</b> — unverified OCR values or missing key nutrients → CAUTION.</li>
      </ol>
      <p>The most serious result wins: NO, then CAUTION, then YES. The rules are deterministic code (src/lib/rules) — the same input always gives the same answer, and every finding names its rule and source. No AI model writes or changes the verdict.</p>

      <h2 id="reference">Reference values</h2>
      <table className="rvt">
        <thead><tr><th>Nutrient</th><th>Daily reference</th><th>Source</th></tr></thead>
        <tbody>{(Object.keys(DAILY_REFERENCE) as NutrientKey[]).map((k) => <tr key={k}><td>{NUTRIENT_LABEL[k]}</td><td className="mono">{DAILY_REFERENCE[k]!.value} {DAILY_REFERENCE[k]!.unit}</td><td>{DAILY_REFERENCE[k]!.source}</td></tr>)}</tbody>
      </table>
      <p>Portion bands: ≥{PORTION_HIGH_SHARE * 100}% of a daily reference in one portion is “high”, ≤{PORTION_LOW_SHARE * 100}% is “low” (the US FDA 5/20 %DV convention applied to FSSAI reference values). These are label reference values for an average adult, <b>not</b> personal targets or medical thresholds.</p>
      <p>Per-100 bands (low / high): {PER100_BAND_SOURCE}. Solids: sugars {PER100_BANDS.g.sugarsG!.join(" / ")} g, fat {PER100_BANDS.g.totalFatG!.join(" / ")} g, saturated fat {PER100_BANDS.g.saturatedFatG!.join(" / ")} g, sodium {PER100_BANDS.g.sodiumMg!.join(" / ")} mg. Drinks: sugars {PER100_BANDS.ml.sugarsG!.join(" / ")} g, sodium {PER100_BANDS.ml.sodiumMg!.join(" / ")} mg.</p>
      <p>Protein and fibre “source of / high in”: {GOOD_THRESHOLDS.g.proteinG!.join(" / ")} g protein and {GOOD_THRESHOLDS.g.fibreG!.join(" / ")} g fibre per 100 g (Codex / FSSAI claim conditions). Salt = sodium × 2.5. Energy check: 4 kcal/g carbohydrate and protein, 9 kcal/g fat.</p>

      <h2 id="privacy">Privacy and security</h2>
      <ul>
        <li>Health information is stored only after you agree, encrypted with AES-256-GCM, and readable only through your own session. It is never public, never in analytics (there are none) and never written to logs.</li>
        <li>Passwords are hashed with scrypt. Sessions use an HttpOnly, SameSite cookie; the database stores only a hash of the session token.</li>
        <li>Health data is never kept in your browser&apos;s localStorage.</li>
        <li>Label photos are read on your device unless you choose online OCR. Online OCR sends the photo to FoodDecode&apos;s own OCR server, which reads it in memory and discards it.</li>
        <li>You can download everything (Privacy &amp; Settings → Download my data), delete your health profile, turn off and delete scan history, or delete your account.</li>
      </ul>
      <p><Link className="link" href="/settings">Privacy &amp; Settings →</Link></p>
      <Disclaimer />
    </div>
  );
}
