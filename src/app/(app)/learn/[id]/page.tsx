import { LESSONS } from "@/lib/i18n/lessons";
import { LessonView } from "./LessonView";
export function generateStaticParams() {
  return LESSONS.map((l) => ({ id: l.id }));
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LessonView id={id} />;
}
