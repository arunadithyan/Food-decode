import { Suspense } from "react";
import { CompareView } from "./CompareView";
import { PageSkeleton } from "@/components/ui";
export const metadata = { title: "Compare" };
export default function Page() {
  return <Suspense fallback={<PageSkeleton />}><CompareView /></Suspense>;
}
