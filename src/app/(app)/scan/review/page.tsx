import { Suspense } from "react";
import { ReviewView } from "./ReviewView";
import { PageSkeleton } from "@/components/ui";
export const metadata = { title: "Check the label values" };
export default function Page() {
  return <Suspense fallback={<PageSkeleton />}><ReviewView /></Suspense>;
}
