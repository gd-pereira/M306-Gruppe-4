// the session cookie holds an HMAC keyed with ADMIN_PASSWORD: it can't be forged without the
// password and changing the password logs everyone out. Web Crypto only, so the proxy can use it too
export const SESSION_COOKIE = "flux-session";

export async function sessionToken(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(SESSION_COOKIE),
  );
  return Array.from(new Uint8Array(signature), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export async function isValidSession(
  cookie: string | undefined,
): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !cookie) return false;
  return cookie === (await sessionToken(password));
}
