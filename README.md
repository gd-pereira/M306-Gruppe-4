<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/flux-logo-dark.svg" />
    <img src="public/brand/flux-logo.svg" alt="Flux" width="320" />
  </picture>
</p>

Flux reads SDAT and ESL smart meter files and shows consumption, feed-in and meter readings. All data is processed locally in the browser, nothing is uploaded to a server.

Built by M306 Gruppe 4 during the BZZ project week (28.09. to 02.10.2026).

## Status

As of 29.09.2026 the complete data pipeline in `lib/` is implemented and tested, including a web worker for importing thousands of files. The data store in `lib/data-store.ts` is ready for the pages. The import page and the real charts are not built yet.

| Feature                                        | Status                                       |
| ---------------------------------------------- | -------------------------------------------- |
| Read SDAT files                                | Done, `lib/parse-sdat.ts`                    |
| Read ESL files                                 | Done, `lib/parse-esl.ts`                     |
| Remove duplicates across files                 | Done, `lib/timeseries.ts`                    |
| Find gaps                                      | Done, `lib/timeseries.ts`                    |
| Convert consumption to absolute meter readings | Done, `lib/meter.ts`                         |
| Cross-check SDAT against ESL                   | Done, `lib/meter.ts`                         |
| Aggregate to zoom levels (15 min to month)     | Done, `lib/aggregate.ts`                     |
| Import many files in a web worker              | Done, `lib/import.ts`, `lib/start-import.ts` |
| Data store for the pages                       | Done, `lib/data-store.ts`                    |
| Start page with branding                       | Done, `/`                                    |
| Import page (file picker, progress, errors)    | Open                                         |
| Consumption chart                              | Prototype with fake data at `/prototype`     |
| Meter reading chart                            | Open                                         |
| CSV export                                     | Open                                         |
| Save as JSON file (nice to have)               | Open                                         |
| HTTP POST of JSON to a server (nice to have)   | Open                                         |

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router), React 19, TypeScript
- Tailwind CSS 4, [shadcn/ui](https://ui.shadcn.com) (Base UI)
- Chart components from the [bklit](https://ui.bklit.com) registry (built on visx and Motion), copied into `components/charts/`
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) for the XML files
- [Vitest](https://vitest.dev) for tests
- ESLint and Prettier

## Getting started

Requirements: Node.js 20.11 or newer and npm.

```bash
git clone https://github.com/im24b-huengerlee/M306-Gruppe-4.git
```

```bash
npm install
```

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). The chart prototype is at [http://localhost:3000/prototype](http://localhost:3000/prototype).

### Scripts

| Command                | What it does                            |
| ---------------------- | --------------------------------------- |
| `npm run dev`          | Start the development server            |
| `npm run build`        | Production build                        |
| `npm start`            | Run the production build                |
| `npm test`             | Run all tests once with Vitest          |
| `npm run lint`         | Check the code with ESLint              |
| `npm run format`       | Format all files with Prettier          |
| `npm run format:check` | Check formatting without changing files |

## Project structure

```
app/
  page.tsx               start page
  prototype/page.tsx     chart prototype with fake data
  icon.svg, apple-icon.tsx, opengraph-image.tsx   app icons and share image
components/
  brand/flux-logo.tsx    FluxLogo and FluxMark components
  charts/                bklit chart components (line chart, axes, tooltip, ...)
  prototype/fake-data.ts generated demo data for the prototype
  ui/                    shadcn components
lib/
  types.ts               shared types and the sensor IDs
  xml.ts                 XML parsing and validation
  detect.ts              tells SDAT and ESL files apart
  parse-sdat.ts          SDAT file -> 15 min usage series
  parse-esl.ts           ESL file -> absolute meter reading series
  time.ts                Swiss local time -> Unix timestamp
  timeseries.ts          merge series, find gaps, binary search helpers
  meter.ts               meter reading calculation and SDAT vs ESL check
  aggregate.ts           sums and readings per hour, day, week, month
  math.ts                rounding of kWh values
  import.ts              reads a set of files and builds the result for the charts
  import.worker.ts       runs the import in a background thread
  start-import.ts        startImport(), starts the worker from a page
  data-store.ts          shared state for all pages: import, time range, data in range
public/brand/            logo files
tests/
  *.test.ts              Vitest tests
  fixtures/              small SDAT and ESL files used by the tests
data/
  sdat/                  5133 SDAT files (sample data from the client)
  esl/                   47 ESL files (sample data from the client)
docs/
  Projektbeschreibung.pdf, Bewertungskriterien.pdf, sdat-spec/
```

## Input data

### SDAT

- Root tag `ValidatedMeteredData_12` to `ValidatedMeteredData_15`, tags use the `rsm:` namespace prefix (the parser removes it).
- The sensor ID is taken from the end of `DocumentID` inside the file, e.g. `eslevu121963_BR2294_ID742` gives `ID742`. The file name is not used.
- Only **ID742** and **ID735** are relevant. Files from other sensors (ID26256, ID26257, ID26263) are listed as ignored, not as errors.
- The direction comes from the tag: `ConsumptionMeteringPoint` is consumption (from the grid), `ProductionMeteringPoint` is feed-in (into the grid).
- Only 15 minute resolution is accepted.
- Timestamp of a value = `StartDateTime` (UTC) + (`Sequence` - 1) × 15 min. `Volume` is the usage in kWh for the 15 minutes starting at that timestamp.
- Observations with `Condition` 21 are placeholders (value 0, the real value follows in a newer file). They are skipped and counted. Other conditions, e.g. 56 (substitute value), are real values.
- The number of values per file varies (96 on a normal day, 92 or 100 on DST days, more in monthly files), so nothing assumes 96.

### ESL

- Root tag `ESLBillingData`, the data is stored in attributes: `Meter/TimePeriod[@end]/ValueRow[@obis, @value]`.
- `end` and `Header/created` have no time zone. They are read as Swiss local time (Europe/Zurich) and converted to Unix UTC in `lib/time.ts`.
- High and low tariff are added up to get the effective meter reading:

| Sensor | Direction               | OBIS codes                |
| ------ | ----------------------- | ------------------------- |
| ID742  | Consumption (from grid) | `1-1:1.8.1` + `1-1:1.8.2` |
| ID735  | Feed-in (into grid)     | `1-1:2.8.1` + `1-1:2.8.2` |

- If one of the two tariffs is missing in a period, that period is skipped for that direction.
- Other meters in the same file, e.g. a water meter with OBIS `8-1:1.8.0`, are ignored.

## Processing pipeline

```
files chosen by the user
  -> startImport()          starts the web worker, reports progress every 50 files
  -> addFile()              ESL root tag? parseEsl() : parseSdat()
                            each file ends up as series, error or ignored
  -> buildResult()          per direction (consumption, feed-in):
       mergeSeries()          one sorted list per sensor, no duplicates
       fitMeterReadings()     SDAT usage fitted to the ESL readings -> reading every 15 min
       findGaps()             missing 15 min values
       compareWithEsl()       SDAT sum vs ESL difference per month
       aggregateAllLevels()   15 min, hour, day, week and month
  -> ImportResult           handed to the data store (lib/data-store.ts), the pages read from there
```

- **Parsers never throw.** Broken XML, the wrong file type or missing fields result in `{ ok: false, error: { file, message } }`, so one bad file does not stop the import.
- **Fast file type check.** The import recognises ESL files by a simple search for `<ESLBillingData` and sends everything else to the SDAT parser. Using `detectFileType()` would parse every file twice, which made the import about twice as slow.
- **Duplicates.** The files overlap, so the same timestamp can appear in many files. The value from the file with the newest creation date wins (`Creation` in SDAT, `created` in ESL). A missing creation date counts as oldest, on the same creation date the file read first wins. The number of dropped duplicate values is part of the import stats. A file is shown as **duplicate** in the file list if none of its values are used, because other files already cover all of them. With the sample data these are 306 SDAT and 3 ESL files.
- **Meter readings.** The SDAT sums are about 3 times the ESL differences, so just adding up SDAT from an ESL reading would make 2018 negative (down to about −28'000 kWh). Instead, between two ESL readings the SDAT values are scaled with the factor ESL difference ÷ SDAT sum, so every ESL reading is hit exactly and gaps in SDAT are made up for. Before the first and after the last fitted ESL reading the calculation uses SDAT ÷ the measured ratio (SDAT ÷ ESL over all ranges without gaps, exactly 3.00 in the sample data). The result always goes up and never gets negative: 2018 starts at 3'569.9 (consumption) and 6'435.3 kWh (feed-in). Besides the readings, `fitMeterReadings()` returns the `ratio` and the `sources`: `backcalc` (2018, calculated backwards), `measured` and `eslOnly` (after 06.09.2021). A reading belongs to the end of its interval (timestamp + 15 min). With only one ESL reading in reach the SDAT values are added as they are (ratio 1). Without any ESL reading no meter readings are calculated.
- **ESL after SDAT.** SDAT data ends on 06.09.2021, ESL continues until 09.2022. The merged ESL readings are kept in the result so the chart can show them after SDAT ends.
- **Cross-check.** `compareWithEsl()` compares the SDAT sum between two ESL readings with the difference of those readings and marks ranges where SDAT values are missing. No tolerance is applied: in the sample data the SDAT sum is always about 3 times the ESL difference (confirmed by the client), so a threshold would mark every month. Ranges without SDAT values and the range where SDAT ends are skipped.
- **Aggregation.** Usage is summed per bucket, meter readings use the last reading in the bucket. Days, weeks and months start at midnight Swiss time, so DST days have 92 or 100 values. Weeks start on Monday. A reading at exactly 00:00 counts to the day before. All zoom levels are calculated once during the import, so switching levels in the chart is instant.
- **Rounding.** kWh values are rounded to 4 decimals to avoid float errors like `19216.199999`.

## Data model

| Type            | Where               | Meaning                                                                                                                                                |
| --------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DataPoint`     | `lib/types.ts`      | `ts` (Unix seconds, UTC) and `value` (kWh)                                                                                                             |
| `Series`        | `lib/types.ts`      | Points of one file: `sensorId`, `direction`, `kind` (`usage` or `meterReading`), `createdAt`                                                           |
| `FileError`     | `lib/types.ts`      | A file that could not be read and why                                                                                                                  |
| `IgnoredFile`   | `lib/types.ts`      | A valid SDAT file from a sensor that is out of scope                                                                                                   |
| `DirectionData` | `lib/import.ts`     | Everything the charts need for one direction: usage and meter readings per zoom level, `meterRatio`, `meterSources`, ESL readings, gaps, comparisons   |
| `ImportedFile`  | `lib/import.ts`     | One row of the import file table: `file`, `type`, `sensorIds`, `directions`, `from`, `status` (`imported`, `duplicate`, `ignored`, `error`), `message` |
| `ImportResult`  | `lib/import.ts`     | `consumption`, `feedIn`, `errors`, `ignored`, `files` and `stats` (file counts, placeholders, duplicates)                                              |
| `DataState`     | `lib/data-store.ts` | What the pages read: `status`, `progress`, `result`, `bounds`, `range`, `lastImport`                                                                   |

The code uses English names, the user interface is in German. The project description uses the German terms:

| German (UI, docs) | Code           |
| ----------------- | -------------- |
| Bezug             | `consumption`  |
| Einspeisung       | `feedIn`       |
| Verbrauch         | `usage`        |
| Zählerstand       | `meterReading` |

## Data store (for the UI)

`lib/data-store.ts` is the interface between the data logic and the pages. Pages only talk to the store, never to the parsers or the worker directly. The data only lives in memory: client side navigation keeps it, a page reload starts empty again. Please ask the data logic team before changing the store.

All times are Unix seconds (UTC), ranges include `from` and exclude `to`. For display use `new Date(ts * 1000)`.

### State

```ts
const {
  status, // "empty" | "importing" | "ready" | "failed"
  progress, // { processed, total } while importing, else null
  failure, // message if the whole import crashed, else null (old data is kept)
  result, // ImportResult of the last import or null
  bounds, // { from, to } of all data, e.g. min and max of a date picker
  range, // { from, to } the charts show, the whole data after an import
  lastImport, // { at, fileCount } for the "Letzter Import" card
} = useDataStore();
```

`result` contains everything else: `result.files` (file table), `result.errors`, `result.ignored`, `result.stats`, and per direction `result.consumption` / `result.feedIn` with `gaps`, `comparisons`, `valueCount`, `meterRatio` (e.g. 3 for «SDAT ÷ 3.00») and `meterSources` (time ranges `backcalc`, `measured`, `eslOnly` for «Woher die Werte kommen»).

### Functions

| Function              | What it does                                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `useDataStore()`      | React hook, returns the state and re-renders on every change                                                                        |
| `importFiles(files)`  | Reads the files in the worker and replaces the old data. Resolves when done, never throws. A second call while importing is ignored |
| `setRange(from, to)`  | Sets the time range of the charts                                                                                                   |
| `useRangeData(level)` | React hook, data of the zoom level (`"15min"`, `"hour"`, `"day"`, `"week"`, `"month"`) in the range, or `null` without data         |
| `getRangeData(level)` | Same without React, e.g. for the export                                                                                             |
| `resetDataStore()`    | Throws away all data, a running import is dropped                                                                                   |

`useRangeData` returns `{ consumption, feedIn }`, each with `usage`, `meterReading` (both `DataPoint[]` in the chosen zoom level) and `esl` (the real ESL readings in the range). A bucket that is only partly inside the range is included, e.g. 15.03. to 15.05. on the month level gives March, April and May.

### Examples

Import page:

```tsx
"use client";

import { importFiles, useDataStore } from "@/lib/data-store";

export default function ImportPage() {
  const { status, progress, result } = useDataStore();

  return (
    <>
      <input
        type="file"
        multiple
        disabled={status === "importing"}
        onChange={(e) => importFiles([...(e.target.files ?? [])])}
      />
      {progress && <progress value={progress.processed} max={progress.total} />}
      {/* the same file name can come twice, so the index is the key */}
      {result?.files.map((f, i) => (
        <div key={i}>
          {f.file} {f.type} {f.sensorIds.join(", ")} {f.status}
        </div>
      ))}
    </>
  );
}
```

Chart:

```tsx
"use client";

import { Line, LineChart } from "@/components/charts/line-chart";
import { setRange, useDataStore, useRangeData } from "@/lib/data-store";

export function ConsumptionChart() {
  const { bounds } = useDataStore();
  const data = useRangeData("day");

  if (data === null || bounds === null) {
    return <p>Noch keine Daten importiert.</p>;
  }

  // the bklit charts want a Date
  const points = data.consumption.usage.map((p) => ({
    date: new Date(p.ts * 1000),
    consumption: p.value,
  }));

  return (
    <>
      <button onClick={() => setRange(bounds.from, bounds.to)}>
        Alles anzeigen
      </button>
      <LineChart data={points}>
        <Line dataKey="consumption" />
      </LineChart>
    </>
  );
}
```

## Export formats (planned)

**CSV**: one file per sensor named after the sensor ID, e.g. `ID742.csv`. Unix timestamp in UTC, absolute meter reading, 15 minute resolution.

```csv
timestamp, value
1503495302, 82.03
```

**JSON**: one entry per sensor, `ts` is a string (Unix UTC), `value` is the absolute meter reading.

```json
[
  {
    "sensorId": "ID742",
    "data": [{ "ts": "1503495302", "value": 82.03 }]
  }
]
```

## Tests

```bash
npm test
```

Vitest runs every `tests/**/*.test.ts` file in a Node environment. The tests cover:

- file type detection and broken or unknown XML
- SDAT parsing: timestamps, creation date, placeholders, ignored sensors, missing sensor ID, broken files
- ESL parsing: tariff sums, missing OBIS codes, water meter only files, broken files
- merging duplicates (newest file wins) and finding gaps
- meter reading calculation forward and backward, rounding, missing ESL data
- the SDAT vs ESL cross-check including the factor 3 in the sample data
- aggregation across DST changes, week starts and year boundaries
- the whole import: sorting files into SDAT, ESL, ignored and errors, duplicate count, file list with duplicate files, zoom levels
- the data store: import state, last import, range bounds, data in range, crashed import

## Brand

| File                              | Use                         |
| --------------------------------- | --------------------------- |
| `public/brand/flux-logo.svg`      | Logo on light background    |
| `public/brand/flux-logo-dark.svg` | Logo on dark background     |
| `public/brand/flux-mark.svg`      | Mark only, light background |
| `public/brand/flux-mark-dark.svg` | Mark only, dark background  |

In code, use `FluxLogo` or `FluxMark` from `components/brand/flux-logo.tsx`. Arrow and wordmark follow the text color (`currentColor`), the sun always stays amber. The app icon, Apple icon and share image are generated from the same paths.

- Amber `#FFB603` (Tailwind: `bg-brand`, `text-brand`), used for feed-in in charts (`--chart-line-secondary`)
- Ink `#171717`, or white on dark backgrounds, used for consumption in charts
- Red `#F04438` for incomplete months and errors
- Wordmark: Montserrat ExtraBold, already converted to paths in the SVGs

## Documentation

- `docs/Projektbeschreibung.pdf`: project description from the client
- `docs/Bewertungskriterien.pdf`: grading criteria
- `docs/sdat-spec/`: SDAT standard (Swiss standardised data exchange) with appendices and example files.
