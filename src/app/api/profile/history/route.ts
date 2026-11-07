import { NextRequest } from "next/server";
import { handler, json, requireUser } from "@/lib/server/http";
import { profileHistory } from "@/lib/server/repo";

export const GET = handler(async (req: NextRequest) => {
  const user = requireUser(req);
  return json({ history: profileHistory(user.id) });
});
