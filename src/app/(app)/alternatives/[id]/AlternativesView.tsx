"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { AltList } from "@/components/ProductView";
import { ErrorState, PageSkeleton } from "@/components/ui";
import { useProduct } from "@/components/useProduct";
import { PRODUCTS } from "@/lib/catalogue";
import { defaultAmount, fmt, forPortion, unitOf } from "@/lib/nutrition/calc";
import { emptyProfile } from "@/lib/profile";
import { findAlternatives, triggeringNutrients } from "@/lib/rules/alternatives";
import { assess } from "@/lib/rules/suitability";
import { ALLERGEN_LABEL } from "@/lib/ingredients/allergens";
import { checkAllergen } from "@/lib/ingredients/allergens";
import { NUTRIENT_LABEL, NUTRIENT_UNIT, type NutrientKey } from "@/lib/types";

const COMPARE: NutrientKey[] = ["energyKcal", "addedSugarG", "sugarsG", "sodiumMg", "saturatedFatG", "proteinG", "fibreG"];

export function AlternativesView({ id }: { id: string }) {
  const sp = useSearchParams();
  const [state] = useProduct(id, sp.get("h"));
  const { profile, profileLoaded, t } = useApp();
  const prof = profile ?? emptyProfile();
  const product = state.status === "ok" ? state.product : null;
  const amount = product ? parseFloat(sp.get("amount") || "") || defaultAmount(product) : 0;
  const a = useMemo(() => (product ? assess(product, prof, amount) : null), [product, prof, amount]);
  const alts = useMemo(() => (product ? findAlternatives(product, prof, amount, PRODUCTS) : []), [product, prof, amount]);
  if (state.status === "loading" || !profileLoaded) return <PageSkeleton />;
  if (state.status === "error" || !product || !a) return <div className="page"><ErrorState message={state.status === "error" ? state.message : "Not found"} /></div>;
  const u = unitOf(product);
  const triggers = triggeringNutrients(a);
  const cols = [product, ...alts.map((x) => x.product)];
  return (
    <div className="page">
      <Link className="back" href={`/product/${id}?amount=${amount}`}><ArrowLeft size={16} /> {product.name}</Link>
      <h1>{t("recommendedAlternatives")}</h1>
      <p className="lede">Real products from the same category ({product.category}) that fit your allergies and diet first, then improve on {triggers.length ? triggers.map((k) => NUTRIENT_LABEL[k].toLowerCase()).join(", ") : "the flagged items"} — compared at the same portion, {fmt(amount)} {u}.</p>
      {a.status === "YES" ? <p className="empty">This product already appears compatible with your profile at this portion.</p>
        : alts.length === 0 ? <p className="empty" data-testid="no-alternatives">{t("noAlternatives")} FoodDecode only suggests products it has data for; it never invents one.</p>
        : (
          <>
            <AltList alts={alts} amount={amount} unit={u} />
            <div style={{ overflowX: "auto" }}>
              <table className="rvt" style={{ minWidth: 520 }}>
                <caption className="sr">Side-by-side nutrients per portion</caption>
                <thead><tr><th>Per {fmt(amount)} {u}</th>{cols.map((c) => <th key={c.id} scope="col">{c.name}</th>)}</tr></thead>
                <tbody>
                  {COMPARE.map((k) => (
                    <tr key={k}><td>{NUTRIENT_LABEL[k]} ({NUTRIENT_UNIT[k]})</td>{cols.map((c) => { const v = forPortion(c.nutrition, amount)[k]; return <td key={c.id} className="mono">{v == null ? "–" : fmt(v)}</td>; })}</tr>
                  ))}
                  {prof.allergies.items.map((al) => (
                    <tr key={al}><td>{ALLERGEN_LABEL[al]}</td>{cols.map((c) => <td key={c.id}>{checkAllergen(al, c.ingredientsText, c.allergenStatement).kind}</td>)}</tr>
                  ))}
                  <tr><td>Serving size</td>{cols.map((c) => <td key={c.id} className="mono">{c.servingSize ? `${fmt(c.servingSize)} ${u}` : "–"}</td>)}</tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      <p className="disclaimer">Alternatives are ranked by deterministic rules: allergy/diet compatibility, then at least 15% improvement on the nutrients that caused the CAUTION or NO, at the same portion. Different products have different serving sizes — check the portion you would really eat.</p>
    </div>
  );
}
