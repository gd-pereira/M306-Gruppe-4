<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/flux-logo-dark.svg" />
    <img src="public/brand/flux-logo.svg" alt="Flux" width="320" />
  </picture>
</p>

Flux liest SDAT- und ESL-Dateien ein und zeigt Verbrauch, Einspeisung und Zählerstand. Alle Daten werden lokal im Browser verarbeitet.

## Entwicklung

```bash
npm install
npm run dev
```

Danach [http://localhost:3000](http://localhost:3000) öffnen.

## Brand

| Datei                              | Verwendung                         |
| ---------------------------------- | ---------------------------------- |
| `public/brand/flux-logo.svg`       | Logo auf hellem Hintergrund        |
| `public/brand/flux-logo-dark.svg`  | Logo auf dunklem Hintergrund       |
| `public/brand/flux-mark.svg`       | Nur Bildmarke, heller Hintergrund  |
| `public/brand/flux-mark-dark.svg`  | Nur Bildmarke, dunkler Hintergrund |

Im Code `FluxLogo` bzw. `FluxMark` aus `components/brand/flux-logo.tsx` verwenden. Pfeil und Schriftzug übernehmen die Textfarbe (`currentColor`), die Sonne bleibt immer Amber.

- Amber `#FFB603` (Tailwind: `bg-brand`, `text-brand`), in Diagrammen für Einspeisung (`--chart-line-secondary`)
- Tinte `#171717` bzw. Weiss auf dunklem Hintergrund, in Diagrammen für Bezug
- Rot `#F04438` für unvollständige Monate und Fehler
- Schriftzug: Montserrat ExtraBold, in den SVGs bereits als Pfad
