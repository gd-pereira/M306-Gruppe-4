import {
  addDays,
  dayKey,
  daysBetween,
  formatDay,
  formatDayRange,
  isDayKey,
  type DayKey,
  type DayRange,
} from "@/components/export/fake-export";

// the time period shown on the verbrauch and zählerstand pages, shared by pager, breadcrumb and chart

export const LEVELS = ["day", "week", "month", "year", "all"] as const;
export type Level = (typeof LEVELS)[number];
export type PeriodLevel = Level | "custom";

export interface Period {
  level: PeriodLevel;
  // whole calendar period (a month runs to its last day even when the data stops earlier)
  range: DayRange;
}

// data: days with values, all: what «Alles» shows
export interface Scope {
  data: DayRange;
  all: DayRange;
}

export type Resolution = "15min" | "hour" | "day" | "week" | "month";

export const LEVEL_LABELS: Record<Level, string> = {
  day: "Tag",
  week: "Woche",
  month: "Monat",
  year: "Jahr",
  all: "Alles",
};

export const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];
export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];
const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function parts(day: DayKey): [number, number, number] {
  const [y, m, d] = day.split("-").map(Number);
  return [y, m, d];
}

function utcDate(day: DayKey): Date {
  const [y, m, d] = parts(day);
  return new Date(Date.UTC(y, m - 1, d));
}

// 0 = monday
function weekdayIndex(day: DayKey): number {
  return (utcDate(day).getUTCDay() + 6) % 7;
}

export function weekday(day: DayKey): string {
  return WEEKDAYS[utcDate(day).getUTCDay()];
}

// iso 8601: weeks start on monday, week 1 contains the first thursday of the year
export function isoWeek(day: DayKey): { week: number; year: number } {
  const thursday = addDays(day, 3 - weekdayIndex(day));
  const year = Number(thursday.slice(0, 4));
  const week = Math.floor(daysBetween(`${year}-01-01`, thursday) / 7) + 1;
  return { week, year };
}

export function lastDayOfMonth(year: number, month: number): DayKey {
  return dayKey(year, month, 0);
}

const min = (a: DayKey, b: DayKey) => (a < b ? a : b);
const max = (a: DayKey, b: DayKey) => (a > b ? a : b);

export function clampDay(day: DayKey, range: DayRange): DayKey {
  return max(range.from, min(range.to, day));
}

export function intersect(a: DayRange, b: DayRange): DayRange | null {
  const from = max(a.from, b.from);
  const to = min(a.to, b.to);
  return from <= to ? { from, to } : null;
}

// the calendar period of the level that contains the day
export function periodOf(level: Level, day: DayKey, scope: Scope): Period {
  const [y, m] = parts(day);
  switch (level) {
    case "day":
      return { level, range: { from: day, to: day } };
    case "week": {
      const monday = addDays(day, -weekdayIndex(day));
      return { level, range: { from: monday, to: addDays(monday, 6) } };
    }
    case "month":
      return {
        level,
        range: { from: dayKey(y, m - 1, 1), to: lastDayOfMonth(y, m) },
      };
    case "year":
      return { level, range: { from: `${y}-01-01`, to: `${y}-12-31` } };
    case "all":
      return { level, range: scope.all };
  }
}

const sameRange = (a: DayRange, b: DayRange) =>
  a.from === b.from && a.to === b.to;

// a range from the url becomes the level it matches, «Januar 2021» or «2021» cut to the data count too
export function periodFromRange(range: DayRange, scope: Scope): Period {
  if (sameRange(range, scope.all) || sameRange(range, scope.data)) {
    return { level: "all", range: scope.all };
  }
  for (const level of ["day", "week", "month", "year"] as const) {
    const period = periodOf(level, range.from, scope);
    const covered = intersect(period.range, scope.data);
    if (
      range.to <= period.range.to &&
      covered &&
      range.from <= covered.from &&
      range.to >= covered.to
    ) {
      return period;
    }
  }
  const inside = intersect(range, scope.all);
  return inside
    ? { level: "custom", range: inside }
    : { level: "all", range: scope.all };
}

type SearchParams = Record<string, string | string[] | undefined>;

function param(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

// ?von=2021-04-01&bis=2021-04-30, without valid parameters the whole period
export function periodFromParams(params: SearchParams, scope: Scope): Period {
  const from = param(params, "von");
  const to = param(params, "bis");
  if (!from || !to || !isDayKey(from) || !isDayKey(to) || from > to) {
    return { level: "all", range: scope.all };
  }
  return periodFromRange({ from, to }, scope);
}

export function periodParams(period: Period): Record<string, string> {
  return { von: period.range.from, bis: period.range.to };
}

// the neighbouring period, null at the edge of the data
export function shiftPeriod(
  period: Period,
  direction: -1 | 1,
  scope: Scope,
): Period | null {
  const { level, range } = period;
  if (level === "all") return null;
  let next: Period;
  if (level === "custom") {
    const length = daysBetween(range.from, range.to) + 1;
    next = {
      level,
      range: {
        from: addDays(range.from, direction * length),
        to: addDays(range.to, direction * length),
      },
    };
  } else {
    const [y, m] = parts(range.from);
    const anchor =
      level === "day"
        ? addDays(range.from, direction)
        : level === "week"
          ? addDays(range.from, direction * 7)
          : level === "month"
            ? dayKey(y, m - 1 + direction, 1)
            : `${y + direction}-01-01`;
    next = periodOf(level, anchor, scope);
  }
  return intersect(next.range, scope.data) ? next : null;
}

// switching the toggle keeps the place: from april 2021 to «Tag» shows 01.04.2021,
// coming from «Alles» it starts at the newest data
export function switchLevel(
  period: Period,
  level: Level,
  scope: Scope,
): Period {
  const anchor =
    period.level === "all"
      ? scope.data.to
      : clampDay(period.range.from, scope.data);
  return periodOf(level, anchor, scope);
}

const DRILL_TARGET: Record<Resolution, Level | null> = {
  month: "year",
  week: "month",
  day: "day",
  hour: "day",
  "15min": null,
};

// the level a click on a bucket opens, null at the 15-min view
export function drillLevel(period: Period): Level | null {
  return DRILL_TARGET[resolutionOf(period)];
}

export function drillDown(
  period: Period,
  day: DayKey,
  scope: Scope,
): Period | null {
  const level = drillLevel(period);
  return level ? periodOf(level, clampDay(day, scope.data), scope) : null;
}

export function resolutionOf(period: Period): Resolution {
  switch (period.level) {
    case "day":
      return "15min";
    case "week":
      return "hour";
    case "month":
      return "day";
    case "year":
      return "week";
    case "all":
      return "month";
    case "custom": {
      const days = daysBetween(period.range.from, period.range.to) + 1;
      if (days <= 2) return "15min";
      if (days <= 14) return "hour";
      if (days <= 92) return "day";
      if (days <= 730) return "week";
      return "month";
    }
  }
}

export function monthLabel(day: DayKey): string {
  const [y, m] = parts(day);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

// «So, 11.04.2021»
export function formatWeekday(day: DayKey): string {
  return `${weekday(day)}, ${formatDay(day)}`;
}

// 01.2018 – 08.2021
export function formatMonthRange({ from, to }: DayRange): string {
  const [fy, fm] = from.split("-");
  const [ty, tm] = to.split("-");
  return `${fm}.${fy} – ${tm}.${ty}`;
}

// label in the pager button
export function pagerLabel(period: Period): string {
  const { level, range } = period;
  switch (level) {
    case "day":
      return formatWeekday(range.from);
    case "week": {
      const { week, year } = isoWeek(range.from);
      return `KW ${week} · ${year}`;
    }
    case "month":
      return monthLabel(range.from);
    case "year":
      return range.from.slice(0, 4);
    case "all":
      return `${range.from.slice(0, 4)} – ${range.to.slice(0, 4)}`;
    case "custom":
      return `${formatDay(range.from)} – ${formatDay(range.to)}`;
  }
}

// second half of the chart title, «April 2021», «05.–11.04.2021»
export function periodTitle(period: Period, scope: Scope): string {
  const { level, range } = period;
  switch (level) {
    case "day":
      return formatWeekday(range.from);
    case "week":
      return formatDayRange(range);
    case "month":
      return monthLabel(range.from);
    case "year":
      return range.from.slice(0, 4);
    case "all": {
      // monthly values stop at the last complete month
      const [y, m] = parts(scope.data.to);
      const to =
        scope.data.to === lastDayOfMonth(y, m)
          ? scope.data.to
          : lastDayOfMonth(y, m - 1);
      return formatMonthRange({ from: scope.data.from, to });
    }
    case "custom":
      return formatDayRange(range);
  }
}

export interface Crumb {
  label: string;
  // null for the current step
  period: Period | null;
}

// Alles › 2021 › April › KW 14
export function breadcrumb(period: Period, scope: Scope): Crumb[] {
  const all: Crumb = {
    label: "Alles",
    period: periodOf("all", scope.data.from, scope),
  };
  const { level, range } = period;
  if (level === "all") return [{ label: "Alles", period: null }];
  if (level === "custom") {
    return [all, { label: "Eigener Zeitraum", period: null }];
  }
  const [y, m, d] = parts(range.from);
  const year: Crumb = {
    label: String(y),
    period: level === "year" ? null : periodOf("year", range.from, scope),
  };
  if (level === "year") return [all, year];
  const month: Crumb = {
    label: MONTH_NAMES[m - 1],
    period: level === "month" ? null : periodOf("month", range.from, scope),
  };
  if (level === "month") return [all, year, month];
  const last: Crumb =
    level === "week"
      ? { label: `KW ${isoWeek(range.from).week}`, period: null }
      : { label: `${d}.`, period: null };
  return [all, year, month, last];
}
