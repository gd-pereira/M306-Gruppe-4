"use client";

import {
  CalendarDays,
  CalendarRange,
  CornerDownLeft,
  Download,
  Lock,
  PanelLeft,
  Send,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { EASE_OUT } from "@/components/motion-provider";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { DayRange } from "@/components/export/export-data";
import { NAV_ITEMS, NEEDS_DATA_HINT, navItemFor, shortcutOf } from "./nav";
import { MONTHS, useRecentViews } from "./recent-views";
import { toggleSidebar, useSidebarPrefs } from "./sidebar-prefs";
import { useModKeyLabel } from "./shortcuts";
import { useDataSummary } from "./use-data-summary";

let open = false;
const listeners = new Set<() => void>();

export function setCommandPaletteOpen(value: boolean): void {
  if (open === value) return;
  open = value;
  for (const listener of listeners) listener();
}

export function toggleCommandPalette(): void {
  setCommandPaletteOpen(!open);
}

export function isCommandPaletteOpen(): boolean {
  return open;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function CommandPalette() {
  const isOpen = useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );

  return (
    <Dialog open={isOpen} onOpenChange={setCommandPaletteOpen}>
      <DialogContent className="top-[14vh] w-[560px] max-w-[calc(100vw-4rem)] translate-y-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Suchen</DialogTitle>
        {/* the popup unmounts when closed, so every opening starts with an empty search */}
        <PaletteBody close={() => setCommandPaletteOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

interface Period {
  label: string;
  range: DayRange;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function clampRange(range: DayRange, bounds: DayRange): DayRange {
  return {
    from: range.from < bounds.from ? bounds.from : range.from,
    to: range.to > bounds.to ? bounds.to : range.to,
  };
}

// every calendar year and month that has data, cut to the data period
function periodsOf(bounds: DayRange): { years: Period[]; months: Period[] } {
  const firstYear = Number(bounds.from.slice(0, 4));
  const lastYear = Number(bounds.to.slice(0, 4));
  const years: Period[] = [];
  const months: Period[] = [];
  for (let year = lastYear; year >= firstYear; year--) {
    years.push({
      label: String(year),
      range: clampRange({ from: `${year}-01-01`, to: `${year}-12-31` }, bounds),
    });
    for (let month = 12; month >= 1; month--) {
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const range = {
        from: `${year}-${pad(month)}-01`,
        to: `${year}-${pad(month)}-${pad(lastDay)}`,
      };
      if (range.to < bounds.from || range.from > bounds.to) continue;
      months.push({
        label: `${MONTHS[month - 1]} ${year}`,
        range: clampRange(range, bounds),
      });
    }
  }
  return { years, months };
}

function consumptionHref(range: DayRange): string {
  return `/verbrauch?${new URLSearchParams({ von: range.from, bis: range.to })}`;
}

function PaletteBody({ close }: { close: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const summary = useDataSummary();
  const recent = useRecentViews();
  const { collapsed } = useSidebarPrefs();
  const mod = useModKeyLabel();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const hasData = summary !== null;
  const periods = summary?.sdatPeriod ? periodsOf(summary.sdatPeriod) : null;

  function go(href: string) {
    close();
    if (href !== pathname) router.push(href);
  }

  function run(action: () => void) {
    close();
    action();
  }

  const item = (props: Omit<PaletteItemProps, "selected">) => (
    <PaletteItem key={props.value} selected={selected} {...props} />
  );

  return (
    <Command
      value={selected}
      onValueChange={setSelected}
      loop
      label="Befehlspalette"
    >
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder="Seite, Zeitraum oder Aktion suchen …"
      >
        <CommandShortcut>Esc</CommandShortcut>
      </CommandInput>

      <CommandList>
        <CommandEmpty>Keine Treffer für «{search.trim()}»</CommandEmpty>

        <PaletteGroup heading="Seiten" index={0}>
          {NAV_ITEMS.map((nav) => {
            const disabled = nav.needsData && !hasData;
            return item({
              value: `Seite ${nav.label}`,
              icon: nav.icon,
              label: nav.label,
              hint: disabled ? NEEDS_DATA_HINT : undefined,
              shortcut: shortcutOf(nav),
              disabled,
              onSelect: () => go(nav.href),
            });
          })}
        </PaletteGroup>

        {hasData && recent.length > 0 && (
          <PaletteGroup heading="Zuletzt angesehen" index={1}>
            {recent.map((view) => {
              const nav = navItemFor(`/${view.page}`);
              return item({
                value: `Zuletzt ${view.label} ${nav?.label ?? ""}`,
                icon: nav?.icon ?? CalendarRange,
                label: view.label,
                hint: nav?.label,
                onSelect: () => go(view.href),
              });
            })}
          </PaletteGroup>
        )}

        {periods && (
          <PaletteGroup heading="Zeiträume" index={2}>
            {periods.years.map((period) =>
              item({
                value: `Zeitraum ${period.label}`,
                icon: CalendarRange,
                label: period.label,
                hint: "Verbrauch",
                onSelect: () => go(consumptionHref(period.range)),
              }),
            )}
            {/* 45 months would drown the list, they only show up while searching */}
            {search.trim() !== "" &&
              periods.months.map((period) =>
                item({
                  value: `Zeitraum ${period.label}`,
                  icon: CalendarDays,
                  label: period.label,
                  hint: "Verbrauch",
                  onSelect: () => go(consumptionHref(period.range)),
                }),
              )}
          </PaletteGroup>
        )}

        <PaletteGroup heading="Aktionen" index={3}>
          {item({
            value: "Aktion Dateien importieren",
            icon: Upload,
            label: hasData ? "Neu importieren" : "Dateien importieren",
            onSelect: () => go("/import"),
          })}
          {item({
            value: "Aktion Als Datei exportieren",
            icon: Download,
            label: "Als Datei exportieren",
            hint: hasData ? "CSV oder JSON" : NEEDS_DATA_HINT,
            disabled: !hasData,
            onSelect: () => go("/export"),
          })}
          {item({
            value: "Aktion An API senden",
            icon: Send,
            label: "An API senden",
            hint: hasData ? undefined : NEEDS_DATA_HINT,
            disabled: !hasData,
            onSelect: () => go("/export?modus=api"),
          })}
          {item({
            value: "Aktion Sidebar einklappen ausklappen",
            icon: PanelLeft,
            label: collapsed ? "Sidebar ausklappen" : "Sidebar einklappen",
            onSelect: () => run(toggleSidebar),
          })}
          {item({
            value: "Aktion App sperren",
            icon: Lock,
            label: "App sperren",
            onSelect: () => go("/login"),
          })}
        </PaletteGroup>
      </CommandList>

      <div className="flex h-10 shrink-0 items-center gap-4 border-t border-border bg-surface px-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CommandShortcut>↑↓</CommandShortcut>
          Auswählen
        </span>
        <span className="flex items-center gap-1.5">
          <CommandShortcut>
            <CornerDownLeft className="size-2.5" aria-label="Enter" />
          </CommandShortcut>
          Öffnen
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <CommandShortcut>{mod} K</CommandShortcut>
          Schliessen
        </span>
      </div>
    </Command>
  );
}

// groups rise in one after the other when the palette opens
function PaletteGroup({
  heading,
  index,
  children,
}: {
  heading: string;
  index: number;
  children: ReactNode;
}) {
  return (
    <CommandGroup
      heading={heading}
      className="animate-in duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] fade-in-0 fill-mode-both slide-in-from-bottom-1 motion-reduce:animate-none"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {children}
    </CommandGroup>
  );
}

interface PaletteItemProps {
  value: string;
  icon: LucideIcon;
  label: string;
  hint?: string;
  shortcut?: string;
  disabled?: boolean;
  selected: string;
  onSelect: () => void;
}

function PaletteItem({
  value,
  icon: Icon,
  label,
  hint,
  shortcut,
  disabled,
  selected,
  onSelect,
}: PaletteItemProps) {
  const active = selected === value && !disabled;
  return (
    <CommandItem value={value} disabled={disabled} onSelect={onSelect}>
      {/* one highlight that glides between the rows instead of hard cuts */}
      {active && (
        <motion.span
          layoutId="palette-highlight"
          aria-hidden
          className="absolute inset-0 rounded-lg bg-muted"
          transition={{ duration: 0.2, ease: EASE_OUT }}
        />
      )}
      <Icon
        aria-hidden
        className={cn(
          "relative size-4 shrink-0 transition-colors duration-150",
          disabled
            ? "text-faint"
            : active
              ? "text-foreground"
              : "text-muted-foreground",
        )}
      />
      <span className="relative min-w-0 flex-1 truncate">{label}</span>
      {hint && (
        <span className="relative shrink-0 text-xs font-normal text-muted-foreground">
          {hint}
        </span>
      )}
      {shortcut && (
        <CommandShortcut className="relative">{shortcut}</CommandShortcut>
      )}
    </CommandItem>
  );
}
