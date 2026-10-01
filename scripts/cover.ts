// Titelbild der Präsentation aus den echten Beispieldaten (npx tsx scripts/cover.ts).
// Jede Haarlinie ist eine Stunde aus 2020: Einspeisung nach oben, Bezug nach unten.
// Speichert public/praesentation/cover.png in 3840×2160.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { addFile, buildResult, createParsedFiles } from "../lib/import";
import type { DataPoint } from "../lib/types";

const ROOT = path.resolve(__dirname, "..");
const AUSGABE = path.join(ROOT, "public", "praesentation", "cover.png");
const W = 3840;
const H = 2160;
const VON = Date.UTC(2020, 0, 1) / 1000;
const BIS = Date.UTC(2021, 0, 1) / 1000;

// Band des Diagramms: Nulllinie und maximale Ausschläge nach oben und unten
const NULL_Y = H * 0.6;
const OBEN_H = H * 0.34;
const UNTEN_H = H * 0.22;

function einlesen() {
  const parsed = createParsedFiles();
  for (const dir of ["sdat", "esl"]) {
    const full = path.join(ROOT, "data", dir);
    for (const name of fs.readdirSync(full)) {
      addFile(parsed, name, fs.readFileSync(path.join(full, name), "utf8"));
    }
  }
  return buildResult(parsed);
}

const imJahr = (points: DataPoint[]) =>
  points.filter((p) => p.ts >= VON && p.ts < BIS);

function perzentil(werte: number[], anteil: number) {
  const sortiert = [...werte].sort((a, b) => a - b);
  return sortiert[Math.floor(anteil * (sortiert.length - 1))];
}

// Tagesspitzen, über 7 Tage geglättet, als Hüllkurve über den Haarlinien
function huelle(points: DataPoint[]) {
  const spitzen = new Map<number, number>();
  for (const p of points) {
    const tag = Math.floor((p.ts - VON) / 86400);
    spitzen.set(tag, Math.max(spitzen.get(tag) ?? 0, p.value));
  }
  const tage = [...spitzen.keys()].sort((a, b) => a - b);
  return tage.map((tag) => {
    const fenster = tage.filter((t) => Math.abs(t - tag) <= 3);
    const mittel =
      fenster.reduce((summe, t) => summe + spitzen.get(t)!, 0) / fenster.length;
    return { ts: VON + tag * 86400 + 43200, value: mittel };
  });
}

const xVon = (ts: number) => ((ts - VON) / (BIS - VON)) * W;

function linien(points: DataPoint[], max: number, richtung: 1 | -1) {
  const hoehe = richtung === 1 ? OBEN_H : UNTEN_H;
  return points
    .map((p) => {
      const x = xVon(p.ts).toFixed(1);
      const y = (
        NULL_Y -
        richtung * Math.min(p.value / max, 1) * hoehe
      ).toFixed(1);
      return `M${x} ${NULL_Y}V${y}`;
    })
    .join("");
}

function kurve(points: DataPoint[], max: number, richtung: 1 | -1) {
  const hoehe = richtung === 1 ? OBEN_H : UNTEN_H;
  return points
    .map((p, index) => {
      const x = xVon(p.ts).toFixed(1);
      const y = (
        NULL_Y -
        richtung * Math.min(p.value / max, 1) * hoehe
      ).toFixed(1);
      return `${index === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join("");
}

function svg() {
  const result = einlesen();
  const einspeisung = imJahr(result.feedIn.usage.hour);
  const bezug = imJahr(result.consumption.usage.hour);
  // ein gemeinsamer Massstab, einzelne Ausreisser werden gekappt
  const max = perzentil(
    [...einspeisung, ...bezug].map((p) => p.value),
    0.998,
  );
  const monate = "JFMAMJJASOND"
    .split("")
    .map((buchstabe, index) => {
      const x = xVon(Date.UTC(2020, index, 15) / 1000);
      return `<text x="${x}" y="${NULL_Y + UNTEN_H + 60}">${buchstabe}</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="glow" x="-10%" y="-50%" width="120%" height="200%">
      <feGaussianBlur stdDeviation="18" result="weich" />
      <feMerge><feMergeNode in="weich" /><feMergeNode in="weich" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    <radialGradient id="licht" cx="50%" cy="58%" r="60%">
      <stop offset="0" stop-color="#FDB51A" stop-opacity="0.16" />
      <stop offset="1" stop-color="#FDB51A" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0B0C0E" />
  <rect width="${W}" height="${H}" fill="url(#licht)" />
  <path d="${linien(einspeisung, max, 1)}" stroke="#FDB51A" stroke-width="1.6" stroke-opacity="0.32" />
  <path d="${linien(bezug, max, -1)}" stroke="#FFFFFF" stroke-width="1.2" stroke-opacity="0.05" />
  <line x1="0" x2="${W}" y1="${NULL_Y}" y2="${NULL_Y}" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="2" />
  <path d="${kurve(huelle(einspeisung), max, 1)}" fill="none" stroke="#FFD166" stroke-width="5" filter="url(#glow)" />
  <path d="${kurve(huelle(bezug), max, -1)}" fill="none" stroke="#FFFFFF" stroke-opacity="0.8" stroke-width="4" filter="url(#glow)" />
  <g fill="#FFFFFF" fill-opacity="0.32" font-family="Segoe UI" font-size="40" letter-spacing="4" text-anchor="middle">${monate}</g>
</svg>`;
}

async function main() {
  console.log("Daten einlesen");
  const inhalt = svg();
  console.log("Rendern");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.setContent(
    `<html><body style="margin:0;background:#0B0C0E">${inhalt}</body></html>`,
  );
  await page.screenshot({ path: AUSGABE });
  await browser.close();
  console.log(`gespeichert: ${path.relative(ROOT, AUSGABE)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
