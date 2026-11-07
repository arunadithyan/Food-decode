import { NextResponse, type NextRequest } from "next/server";

/** Passes the requested path to server layouts (used for the post-login redirect). No auth logic here. */
export function middleware(req: NextRequest) {
  const h = new Headers(req.headers);
  h.set("x-fd-path", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers: h } });
}
export const config = { matcher: ["/((?!api|_next|ocr|illustrations|.*\\..*).*)"] };
