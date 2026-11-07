import { NextRequest } from "next/server";
import { searchLocal } from "@/lib/catalogue";
import { handler, json } from "@/lib/server/http";
import { offEnabled, OffUnavailable, searchOff } from "@/lib/server/off";

/** Search the bundled catalogue, and optionally Open Food Facts (community data). Public product data only. */
export const GET = handler(async (req: NextRequest) => {
  const q = (req.nextUrl.searchParams.get("q") || "").slice(0, 80);
  const cat = (req.nextUrl.searchParams.get("cat") || "").slice(0, 60);
  const wantOff = req.nextUrl.searchParams.get("off") === "1";
  const local = searchLocal(q, cat).map((p) => ({ id: p.id, name: p.name, brand: p.brand, category: p.category, provenance: p.provenance }));
  let off: unknown[] = [];
  let offStatus: "ok" | "disabled" | "unavailable" | "skipped" = "skipped";
  if (wantOff && q.trim().length >= 2) {
    if (!offEnabled()) offStatus = "disabled";
    else {
      try {
        off = await searchOff(q);
        offStatus = "ok";
      } catch (e) {
        if (e instanceof OffUnavailable) offStatus = "unavailable";
        else throw e;
      }
    }
  }
  return json({ local, off, offStatus });
});
