import { Suspense } from "react";
import { AlternativesView } from "./AlternativesView";
import { PageSkeleton } from "@/components/ui";
export const metadata = { title: "Alternatives" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<PageSkeleton />}><AlternativesView id={decodeURIComponent(id)} /></Suspense>;
}
