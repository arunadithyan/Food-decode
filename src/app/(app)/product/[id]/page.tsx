import { Suspense } from "react";
import { PRODUCTS } from "@/lib/catalogue";
import { ProductView } from "@/components/ProductView";
import { PageSkeleton } from "@/components/ui";

/** Catalogue products are pre-rendered (and cached for offline use); scans and Open Food Facts products render on demand. */
export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ id: p.id }));
}
export const dynamicParams = true;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<PageSkeleton />}><ProductView id={decodeURIComponent(id)} /></Suspense>;
}
