"use client";

import { useMemo, useState } from "react";
import type { DayRange } from "@/components/export/export-data";
import { formatNumber } from "@/lib/format";
import type { Direction } from "@/lib/types";
import { useAnalysisData } from "./analysis-source";
import { hourProfile } from "./analysis-data";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WEEKDAY_NAMES = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const COLOR: Record<Direction, string> = {
  consumption: "var(--primary)",
  feedIn: "var(--brand)",
};

const hours = (hour: number) => `${hour}–${hour + 1} Uhr`;
const kwh = (value: number) => `Ø ${formatNumber(value, 2)} kWh`;

function cellColor(value: number | null, max: number, direction: Direction) {
  if (value === null) return "var(--surface)";
  const share = max > 0 ? value / max : 0;
  return `color-mix(in oklab, ${COLOR[direction]} ${Math.round(4 + share * 96)}%, var(--muted))`;
}

// average kWh per hour for every weekday, shows when the usage happens
export function HourHeatmap({
  range,
  direction,
}: {
  range: DayRange;
  direction: Direction;
}) {
  const data = useAnalysisData();
  const { cells, max } = useMemo(
    () => hourProfile(range, direction, data),
    [range, direction, data],
  );
  const [active, setActive] = useState<{ day: number; hour: number } | null>(
    null,
  );

  let top: { day: number; hour: number; value: number } | null = null;
  for (let day = 0; day < cells.length; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const value = cells[day][hour];
      if (value !== null && (!top || value > top.value)) {
        top = { day, hour, value };
      }
    }
  }
  const shown = active && cells[active.day][active.hour];

  return (
    <div className="flex flex-col gap-3">
      <p className="h-4 text-xs text-muted-foreground tabular-nums">
        {active
          ? `${WEEKDAY_NAMES[active.day]}, ${hours(active.hour)} · ${
              shown === null ? "keine SDAT-Daten" : kwh(shown)
            }`
          : top && top.value > 0
            ? `Am meisten: ${WEEKDAY_NAMES[top.day]}, ${hours(top.hour)} · ${kwh(top.value)}`
            : "Keine Werte im Zeitraum"}
      </p>
      <div
        role="img"
        aria-label={`Tagesprofil ${direction === "consumption" ? "Bezug" : "Einspeisung"}: durchschnittliche kWh pro Wochentag und Stunde${
          top ? `, am meisten ${WEEKDAY_NAMES[top.day]} ${hours(top.hour)}` : ""
        }`}
        className="grid grid-cols-[24px_repeat(24,minmax(0,1fr))] gap-[3px]"
        onPointerLeave={() => setActive(null)}
      >
        {cells.map((row, day) => (
          <div key={day} className="contents">
            <span aria-hidden className="self-center text-[11px] text-faint">
              {WEEKDAYS[day]}
            </span>
            {row.map((value, hour) => (
              <span
                key={hour}
                aria-hidden
                onPointerEnter={() => setActive({ day, hour })}
                className="h-[18px] rounded-[3px] transition-[background-color,box-shadow] duration-300 hover:shadow-[0_0_0_1.5px_var(--foreground)]"
                style={{ background: cellColor(value, max, direction) }}
              />
            ))}
          </div>
        ))}
        <span />
        {HOURS.map((hour) => (
          <span
            key={hour}
            aria-hidden
            className="text-center text-[11px] text-faint tabular-nums"
          >
            {hour % 3 === 0 ? hour : ""}
          </span>
        ))}
      </div>
      <div
        aria-hidden
        className="flex items-center gap-2 text-[11px] text-faint tabular-nums"
      >
        <span>0</span>
        <span
          className="h-1.5 w-28 rounded-full"
          style={{
            background: `linear-gradient(to right, ${cellColor(0, 1, direction)}, ${cellColor(1, 1, direction)})`,
          }}
        />
        <span>{formatNumber(max, 2)} kWh pro Stunde</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] border border-border bg-surface" />
          Lücke
        </span>
      </div>
    </div>
  );
}
