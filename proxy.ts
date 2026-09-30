import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// every app page needs an unlocked session, otherwise the login comes first
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/verbrauch/:path*",
    "/zaehlerstand/:path*",
    "/import/:path*",
    "/export/:path*",
  ],
};
