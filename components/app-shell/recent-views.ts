import { useSyncExternalStore } from "react";
import {
  formatDay,
  fileName,
  formatDayRange,
  isDayKey,
  type DayRange,
} from "@/components/export/fake-export";
import { selectionFromParams } from "@/components/export/selection";

export type RecentPage = "verbrauch" | "zaehlerstand" | "export";

export interface RecentView {
  page: RecentPage;
  label: string;
  href: string;
}

export const RECENT_KEY = "flux.recent";
export const MAX_RECENT = 3;
// short stops while clicking through a drill-down are not worth remembering
export const RECORD_DELAY_MS = 800;

const PAGES: RecentPage[] = ["verbrauch", "zaehlerstand", "export"];

export const MONTHS = [
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

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// "März 2021", "2019", "2018 – 06.09.2021", otherwise the compact day range
export function periodLabel({ from, to }: DayRange): string {
  if (from === to) return formatDay(from);
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  if (fy === ty && fm === tm && fd === 1 && td === lastDayOfMonth(ty, tm)) {
    return `${MONTHS[fm - 1]} ${fy}`;
  }
  const startsYear = fm === 1 && fd === 1;
  const endsYear = tm === 12 && td === 31;
  if (startsYear && endsYear) return fy === ty ? `${fy}` : `${fy} – ${ty}`;
  if (startsYear && fy < ty) return `${fy} – ${formatDay(to)}`;
  return formatDayRange({ from, to });
}

export function viewFromLocation(
  pathname: string,
  search: string,
): RecentView | null {
  const page = PAGES.find((p) => pathname === `/${p}`);
  if (!page) return null;
  const params = new URLSearchParams(search);
  const href = search ? `${pathname}?${params}` : pathname;

  if (page === "export") {
    if (params.get("modus") === "api") {
      return { page, label: "An API senden", href };
    }
    // the name of the file, json has both sensors in zaehlerstaende.json
    const selection = selectionFromParams(Object.fromEntries(params));
    return { page, label: fileName(selection), href };
  }

  const from = params.get("von");
  const to = params.get("bis");
  const label =
    from && to && isDayKey(from) && isDayKey(to) && from <= to
      ? periodLabel({ from, to })
      : "Gesamter Zeitraum";
  return { page, label, href };
}

// newest first, one entry per page and label (a changed export range updates its entry)
export function addRecent(list: RecentView[], view: RecentView): RecentView[] {
  const first = list[0];
  if (
    first &&
    first.page === view.page &&
    first.label === view.label &&
    first.href === view.href
  ) {
    return list;
  }
  const rest = list.filter(
    (item) => item.page !== view.page || item.label !== view.label,
  );
  return [view, ...rest].slice(0, MAX_RECENT);
}

export function parseRecent(raw: string | null): RecentView[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item): item is RecentView =>
          typeof item === "object" &&
          item !== null &&
          PAGES.includes(item.page) &&
          typeof item.label === "string" &&
          typeof item.href === "string" &&
          item.href.startsWith(`/${item.page}`),
      )
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

const EMPTY: RecentView[] = [];
let recent: RecentView[] | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function read(): RecentView[] {
  if (recent === null) {
    try {
      recent = parseRecent(localStorage.getItem(RECENT_KEY));
    } catch {
      recent = EMPTY;
    }
  }
  return recent;
}

// other tabs write the same key
function onStorage(event: StorageEvent): void {
  if (event.key !== RECENT_KEY) return;
  recent = parseRecent(event.newValue);
  emit();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function useRecentViews(): RecentView[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function recordView(view: RecentView): void {
  const next = addRecent(read(), view);
  if (next === recent) return;
  recent = next;
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // kept in memory for this tab
  }
  emit();
}
