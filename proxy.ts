import { NextResponse, type NextRequest } from "next/server";
import { isValidSession, SESSION_COOKIE } from "@/lib/session";

// every app page needs an unlocked session, otherwise the login comes first
export async function proxy(request: NextRequest) {
  if (await isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) {
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
