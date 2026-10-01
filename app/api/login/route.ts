import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionToken } from "@/lib/session";

const sha256 = (value: string) => createHash("sha256").update(value).digest();

export async function POST(request: Request) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "ADMIN_PASSWORD is not configured" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  // hashing first gives both sides equal length, so the comparison is constant time
  if (!timingSafeEqual(sha256(password), sha256(expected))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // no max-age: the session ends with the browser, a fresh window starts at the login
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await sessionToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
