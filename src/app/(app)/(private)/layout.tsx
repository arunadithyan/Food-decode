import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { currentUser } from "@/lib/server/auth";

/** Pages that show or change personal data require a session, checked on the server. */
export const dynamic = "force-dynamic";
export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) {
    const path = (await headers()).get("x-fd-path") || "/dashboard";
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  return <>{children}</>;
}
