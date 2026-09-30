// stand-in for the httpOnly cookie the server check will set: a session cookie without
// max-age, so it is gone once the browser closes and a fresh window always starts at the login
export const SESSION_COOKIE = "flux-session";

export function startSession(): void {
  document.cookie = `${SESSION_COOKIE}=1; path=/; SameSite=Lax`;
}

export function endSession(): void {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
