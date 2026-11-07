import { NextRequest } from "next/server";
import { getByBarcode } from "@/lib/catalogue";
import { handler, HttpError, json } from "@/lib/server/http";
import { lookupBarcode, OffUnavailable } from "@/lib/server/off";

/** Barcode lookup: bundled catalogue first (checked data), then Open Food Facts (community data, cached). */
export const GET = handler<{ params: Promise<{ code: string }> }>(async (_req: NextRequest, { params }) => {
  const { code } = await params;
  if (!/^\d{6,14}$/.test(code)) throw new HttpError(400, "bad_barcode", "Barcodes are 6–14 digits.");
  const local = getByBarcode(code);
  if (local) return json({ product: local, source: "catalogue" });
  try {
    const r = await lookupBarcode(code);
    return json({ product: r.product, source: r.product ? "openfoodfacts" : null, cached: r.cached, fetchedAt: r.fetchedAt });
  } catch (e) {
    if (e instanceof OffUnavailable) return json({ product: null, source: null, offline: true, message: "Open Food Facts can't be reached right now. You can scan the label instead." });
    throw e;
  }
});
