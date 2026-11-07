import { NextRequest } from "next/server";
import { handler, requireUser } from "@/lib/server/http";
import { exportAll } from "@/lib/server/repo";

/** Download everything FoodDecode stores about the signed-in user, decrypted, as JSON. */
export const GET = handler(async (req: NextRequest) => {
  const user = requireUser(req);
  const body = JSON.stringify(exportAll(user.id), null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="fooddecode-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
