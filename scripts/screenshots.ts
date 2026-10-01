// Screenshots der App für die Präsentation (npx tsx scripts/screenshots.ts).
// Erwartet einen laufenden Dev-Server (npm run dev) auf BASE_URL.
// Importiert die Beispieldaten aus data/ und speichert 1920×1080-PNGs in public/praesentation/.
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public", "praesentation");

// das Passwort kommt aus der Projekt-Konfiguration und landet nirgends im Output
function devPassword(): string {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  for (const name of [".env.local", ".env"]) {
    const file = path.join(ROOT, name);
    if (!fs.existsSync(file)) continue;
    const match = fs
      .readFileSync(file, "utf8")
      .match(/^ADMIN_PASSWORD=["']?([^"'\r\n]+)/m);
    if (match) return match[1];
  }
  throw new Error("ADMIN_PASSWORD nicht gesetzt (.env.local oder .env)");
}

function dataFiles(): string[] {
  return ["sdat", "esl"].flatMap((dir) => {
    const full = path.join(ROOT, "data", dir);
    return fs.readdirSync(full).map((name) => path.join(full, name));
  });
}

async function settle(page: Page, ms = 1800) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
}

async function shot(page: Page, name: string) {
  await page.mouse.move(1919, 1079);
  await settle(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log("  gespeichert:", `${name}.png`);
}

// client-seitig navigieren, ein Neuladen würde die importierten Daten verwerfen
async function push(page: Page, url: string) {
  await page.evaluate((target) => {
    const next = (
      window as unknown as { next: { router: { push: (u: string) => void } } }
    ).next;
    next.router.push(target);
  }, url);
  await page.waitForURL(
    (current) => `${current.pathname}${current.search}` === url,
  );
}

async function openNav(page: Page, href: string) {
  await page.locator(`a[href="${href}"]`).first().click();
  await page.waitForURL((url) => url.pathname === href);
}

async function logo(page: Page, svg: string, out: string, width: number) {
  const markup = fs.readFileSync(
    path.join(ROOT, "public", "brand", svg),
    "utf8",
  );
  await page.setContent(
    `<html><body style="margin:0;background:transparent">
      <div id="l" style="display:inline-block;width:${width}px">${markup.replace(
        "<svg",
        '<svg style="width:100%;height:auto;display:block"',
      )}</div></body></html>`,
  );
  await page
    .locator("#l")
    .screenshot({ path: path.join(OUT, out), omitBackground: true });
  console.log("  gespeichert:", out);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    colorScheme: "light",
    locale: "de-CH",
    timezoneId: "Europe/Zurich",
  });
  // Dev-Indikator von Next.js ausblenden, er verdeckt sonst die Sidebar
  await context.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal{display:none!important}";
      document.head.appendChild(style);
    });
  });
  const page = await context.newPage();

  console.log("Logo rastern");
  await logo(page, "flux-logo.svg", "flux-logo.png", 1200);
  await logo(page, "flux-mark.svg", "flux-mark.png", 600);

  console.log("Login");
  await page.goto(`${BASE_URL}/login`);
  await page.locator('input[type="password"]').fill(devPassword());
  await page.getByRole("button", { name: "Entsperren" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 30_000,
  });

  console.log("Import vorher");
  await openNav(page, "/import");
  await shot(page, "import-vorher");

  const files = dataFiles();
  console.log(`Import von ${files.length} Dateien`);
  const started = Date.now();
  await page
    .locator('input[type="file"][multiple]')
    .first()
    .setInputFiles(files);
  await page
    .getByText("Import abgeschlossen")
    .first()
    .waitFor({ timeout: 300_000 });
  console.log(
    `  Import fertig nach ${((Date.now() - started) / 1000).toFixed(1)} s (inkl. Dateiübergabe)`,
  );
  await shot(page, "import-nachher");

  console.log("Dashboard");
  await openNav(page, "/dashboard");
  await shot(page, "dashboard");

  console.log("Verbrauch");
  await openNav(page, "/verbrauch");
  await push(page, "/verbrauch?von=2020-01-01&bis=2020-12-31");
  await shot(page, "verbrauch-jahr");
  await push(page, "/verbrauch?von=2020-07-15&bis=2020-07-15");
  await shot(page, "verbrauch-tag");

  console.log("Zählerstand");
  await openNav(page, "/zaehlerstand");
  await shot(page, "zaehlerstand");

  console.log("Export");
  await openNav(page, "/export");
  await shot(page, "export");

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
