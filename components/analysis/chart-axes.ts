import {
  addDays,
  daysBetween,
  formatDayRange,
  type DayKey,
  type DayRange,
} from "@/components/export/fake-export";
import { zurichToUnix } from "@/lib/time";
import {
  formatWeekday,
  isoWeek,
  monthLabel,
  MONTH_SHORT,
  weekday,
  type Resolution,
} from "./period";

export interface XTick {
  ts: number;
  label: string;
}

const local = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Zurich",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// day and time of a moment in swiss local time
export function localParts(ts: number): { day: DayKey; time: string } {
  const parts = local.formatToParts(ts * 1000);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    day: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

function at(day: DayKey, time: string): number {
  return zurichToUnix(`${day}T${time}:00`);
}

function eachDay(range: DayRange): DayKey[] {
  const count = daysBetween(range.from, range.to) + 1;
  return Array.from({ length: count }, (_, i) => addDays(range.from, i));
}

function monthStarts(range: DayRange): DayKey[] {
  const starts: DayKey[] = [];
  let [year, month] = range.from.split("-").map(Number);
  if (!range.from.endsWith("-01")) month++;
  for (;;) {
    if (month > 12) {
      month = 1;
      year++;
    }
    const day = `${year}-${String(month).padStart(2, "0")}-01`;
    if (day > range.to) return starts;
    starts.push(day);
    month++;
  }
}

// labels under the chart: hours for a day, weekdays for a week, days for a month, months for a year
export function xTicksFor(range: DayRange, resolution: Resolution): XTick[] {
  const span = daysBetween(range.from, range.to) + 1;
  const days = eachDay(range);

  if (resolution === "15min") {
    if (span > 1) {
      return days.map((day) => ({
        ts: at(day, "00:00"),
        label: shortDay(day),
      }));
    }
    return [0, 4, 8, 12, 16, 20].map((hour) => {
      const time = `${String(hour).padStart(2, "0")}:00`;
      return { ts: at(range.from, time), label: time };
    });
  }

  if (resolution === "hour") {
    return days.map((day) => ({
      ts: at(day, "12:00"),
      label: `${weekday(day)} ${shortDay(day)}`,
    }));
  }

  if (resolution === "day") {
    const marks = span <= 31 ? [1, 5, 10, 15, 20, 25, 30] : [1, 15];
    return days
      .filter((day) => marks.includes(Number(day.slice(8))))
      .map((day) => ({
        ts: at(day, "12:00"),
        label: `${Number(day.slice(8))}. ${MONTH_SHORT[Number(day.slice(5, 7)) - 1]}`,
      }));
  }

  const starts = monthStarts(range);
  if (resolution === "week") {
    return starts
      .filter((day) => span <= 200 || Number(day.slice(5, 7)) % 2 === 1)
      .map((day) => {
        const month = Number(day.slice(5, 7));
        return {
          ts: at(day, "00:00"),
          label:
            month === 1 && span > 400
              ? day.slice(0, 4)
              : MONTH_SHORT[month - 1],
        };
      });
  }

  return starts
    .filter((day) => ["01", "07"].includes(day.slice(5, 7)))
    .map((day) => ({
      ts: at(day, "00:00"),
      label: day.slice(5, 7) === "01" ? day.slice(0, 4) : "Jul",
    }));
}

// «5.4.»
function shortDay(day: DayKey): string {
  return `${Number(day.slice(8))}.${Number(day.slice(5, 7))}.`;
}

// tooltip title of a bucket that starts at ts
export function bucketTitle(ts: number, resolution: Resolution): string {
  const { day, time } = localParts(ts);
  switch (resolution) {
    case "15min":
      return `${formatWeekday(day)}, ${time}`;
    case "hour": {
      const next = String((Number(time.slice(0, 2)) + 1) % 24).padStart(2, "0");
      return `${formatWeekday(day)}, ${time}–${next}:00`;
    }
    case "day":
      return formatWeekday(day);
    case "week":
      return `KW ${isoWeek(day).week} · ${formatDayRange({ from: day, to: addDays(day, 6) })}`;
    case "month":
      return monthLabel(day);
  }
}

// «18.–24.02.» without the year, for tight spots
export function shortRange(range: DayRange): string {
  return formatDayRange(range).replace(/\d{4}$/, "");
}
