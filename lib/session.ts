// the session cookie is "nonce.expiry.signature": a random nonce, the end of the session in unix
// seconds and an HMAC over both keyed with ADMIN_PASSWORD. it can't be forged without the password,
// it runs out after SESSION_SECONDS and changing the password logs everyone out.
// Web Crypto only, so the proxy can use it too
export const SESSION_COOKIE = "flux-session";
export const SESSION_SECONDS = 12 * 60 * 60;

const encoder = new TextEncoder();

function hmacKey(password: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> | null {
  if (!/^(?:[0-9a-f]{2})+$/.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export async function createSession(
  password: string,
  now = Date.now(),
): Promise<string> {
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const payload = `${nonce}.${Math.floor(now / 1000) + SESSION_SECONDS}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(password),
    encoder.encode(payload),
  );
  return `${payload}.${toHex(new Uint8Array(signature))}`;
}

export async function isValidSession(
  cookie: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !cookie) return false;
  const [nonce, expiry, signature, ...rest] = cookie.split(".");
  if (rest.length > 0 || !nonce || !/^\d+$/.test(expiry ?? "")) return false;
  if (Number(expiry) <= now / 1000) return false;
  const bytes = fromHex(signature ?? "");
  if (!bytes) return false;
  // verify compares the signatures in constant time
  return crypto.subtle.verify(
    "HMAC",
    await hmacKey(password),
    bytes,
    encoder.encode(`${nonce}.${expiry}`),
  );
}
