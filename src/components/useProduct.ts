"use client";
import { useEffect, useState } from "react";
import { getLocalProduct } from "@/lib/catalogue";
import { api, ApiError } from "@/lib/client/api";
import { sessionStore } from "@/lib/client/session-store";
import type { ScanRecord } from "@/lib/server/repo";
import type { Product } from "@/lib/types";

export type ProductState = { status: "loading" } | { status: "ok"; product: Product } | { status: "error"; message: string; code?: string };

/** Resolve a product id: bundled catalogue, Open Food Facts ("off-<barcode>"), or a scan ("scan-…", in memory or from saved history). */
export function useProduct(id: string, historyId?: string | null): [ProductState, () => void] {
  const [state, setState] = useState<ProductState>(() => {
    const local = getLocalProduct(id);
    return local ? { status: "ok", product: local } : { status: "loading" };
  });
  const [n, setN] = useState(0);
  useEffect(() => {
    const local = getLocalProduct(id);
    if (local) return setState({ status: "ok", product: local });
    const mem = sessionStore.getProduct(id);
    if (mem) return setState({ status: "ok", product: mem });
    let cancelled = false;
    setState({ status: "loading" });
    (async () => {
      try {
        if (id.startsWith("off-")) {
          const r = await api<{ product: Product }>(`/api/products/${encodeURIComponent(id)}`);
          sessionStore.putProduct(r.product);
          if (!cancelled) setState({ status: "ok", product: r.product });
        } else if (historyId) {
          const r = await api<{ scan: ScanRecord }>(`/api/scans/${encodeURIComponent(historyId)}`);
          if (!r.scan.product) throw new ApiError(404, "not_found", "This scan has no product data.");
          sessionStore.putProduct(r.scan.product);
          if (!cancelled) setState({ status: "ok", product: r.scan.product });
        } else {
          throw new ApiError(404, "not_found", id.startsWith("scan-") ? "This scan is no longer in memory. Scans are only kept after you close the tab if scan history is switched on." : "Product not found.");
        }
      } catch (e) {
        if (!cancelled) setState({ status: "error", message: e instanceof ApiError ? e.message : "Could not load this product.", code: e instanceof ApiError ? e.code : undefined });
      }
    })();
    return () => { cancelled = true; };
  }, [id, historyId, n]);
  return [state, () => setN((x) => x + 1)];
}
