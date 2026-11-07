import { NextRequest } from "next/server";
import { handler, HttpError, json, readJson, requireUser } from "@/lib/server/http";
import { addComparison, listComparisons } from "@/lib/server/repo";

export const GET = handler(async (req: NextRequest) => {
  const user = requireUser(req);
  return json({ comparisons: listComparisons(user.id) });
});

export const POST = handler(async (req: NextRequest) => {
  const user = requireUser(req);
  const b = await readJson<{ a?: unknown; b?: unknown; mode?: unknown; amount?: unknown }>(req);
  const id = (v: unknown) => typeof v === "string" && /^[a-z0-9-]{1,60}$/.test(v);
  if (!id(b.a) || !id(b.b) || !["100", "serving", "amount"].includes(String(b.mode))) throw new HttpError(400, "invalid", "Choose two products to compare.");
  const amount = typeof b.amount === "number" && b.amount > 0 && b.amount < 5000 ? b.amount : undefined;
  return json({ comparison: addComparison(user.id, { a: b.a as string, b: b.b as string, mode: b.mode as "100" | "serving" | "amount", amount }) }, 201);
});
