// stand-in until the server check exists: the real password must never ship in the
// browser bundle, it gets compared on the server and answered with an httpOnly cookie
export const DEMO_PASSWORD = "flux";

const CHECK_DELAY_MS = 700;

export function checkPassword(password: string): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(password === DEMO_PASSWORD), CHECK_DELAY_MS);
  });
}
