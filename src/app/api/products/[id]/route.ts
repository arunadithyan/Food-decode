import { NextRequest } from "next/server";
import { getLocalProduct } from "@/lib/catalogue";
import { handler, HttpError, json } from "@/lib/server/http";
import { lookupBarcode, OffUnavailable } from "@/lib/server/off";

export const GET = handler<{ params: Promise<{ id: string }> }>(async (_req: NextRequest, { params }) => {
  const { id } = await params;
  const local = getLocalProduct(id);
  if (local) return json({ product: local, source: "catalogue" });
  const m = id.match(/^off-(\d{6,14})$/);
  if (!m) throw new HttpError(404, "not_found", "Product not found.");
  try {
    const r = await lookupBarcode(m[1]);
    if (!r.product) throw new HttpError(404, "not_found", "Open Food Facts has no record for this barcode.");
    return json({ product: r.product, source: "openfoodfacts", cached: r.cached, fetchedAt: r.fetchedAt });
  } catch (e) {
    if (e instanceof OffUnavailable) throw new HttpError(503, "off_unavailable", "Open Food Facts can't be reached right now.");
    throw e;
  }
});
