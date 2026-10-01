"use client";

import { Popover } from "@base-ui/react/popover";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { EASE_OUT } from "@/components/motion-provider";
import { Calendar } from "@/components/export/date-field";
import { SegmentedTabs } from "@/components/import/table-parts";
import { formatDay } from "@/components/export/export-data";
import { cn } from "@/lib/utils";
import { localParts } from "./chart-axes";
import { gapMonths, PARTIAL_MONTH } from "./analysis-data";
import { useAnalysisData } from "./analysis-source";
import {
  breadcrumb,
  clampDay,
  drillDown,
  drillLevel,
  intersect,
  LEVEL_LABELS,
  LEVELS,
  MONTH_SHORT,
  pagerLabel,
  periodOf,
  shiftPeriod,
  switchLevel,
  type Level,
  type Period,
  type PeriodLevel,
  type Scope,
} from "./period";

// the period plus the direction of the last step, so labels slide the right way
export function usePeriod(initial: Period) {
  const [state, setState] = useState({ period: initial, direction: 1 });
  function change(next: Period) {
    setState((current) => ({
      period: next,
      direction: next.range.from < current.period.range.from ? -1 : 1,
    }));
  }
  return { ...state, change };
}

const DRILL_HINT: Record<Level, string> = {
  day: "Klicken für die Tagesansicht",
  week: "Klicken für die Wochenansicht",
  month: "Klicken für die Monatsansicht",
  year: "Klicken für die Jahresansicht",
  all: "",
};

export interface Drill {
  onSelect?: (ts: number) => void;
  selectHint?: string;
}

// click in a chart opens the next level down at the clicked time
export function drillProps(
  period: Period,
  scope: Scope,
  onChange: (period: Period) => void,
): Drill {
  const level = drillLevel(period);
  if (!level) return {};
  return {
    selectHint: DRILL_HINT[level],
    onSelect: (ts) => {
      const next = drillDown(period, localParts(ts).day, scope);
      if (next) onChange(next);
    },
  };
}

export function Breadcrumb({
  period,
  scope,
  onSelect,
}: {
  period: Period;
  scope: Scope;
  onSelect: (period: Period) => void;
}) {
  const crumbs = breadcrumb(period, scope);
  return (
    <nav aria-label="Zeitraum-Pfad">
      <ol className="flex items-center gap-1.5 text-sm">
        <AnimatePresence mode="popLayout" initial={false}>
          {crumbs.map((crumb, index) => (
            <motion.li
              key={`${index}-${crumb.label}`}
              layout="position"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
              className="flex items-center gap-1.5 whitespace-nowrap"
            >
              {index > 0 && (
                <ChevronRight className="size-3.5 text-faint" aria-hidden />
              )}
              {crumb.period ? (
                <button
                  type="button"
                  onClick={() => onSelect(crumb.period!)}
                  className="rounded-sm text-muted-foreground underline decoration-border-strong underline-offset-[3px] transition-colors duration-150 outline-none hover:text-foreground hover:decoration-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {crumb.label}
                </button>
              ) : (
                <span aria-current="page" className="font-medium">
                  {crumb.label}
                </span>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </nav>
  );
}

export function LevelToggle({
  period,
  scope,
  onChange,
}: {
  period: Period;
  scope: Scope;
  onChange: (period: Period) => void;
}) {
  return (
    <SegmentedTabs<PeriodLevel>
      label="Zeitraum"
      size="md"
      value={period.level}
      onChange={(level) => {
        if (level === period.level || level === "custom") return;
        onChange(switchLevel(period, level, scope));
      }}
      options={LEVELS.map((level) => ({
        value: level,
        label: LEVEL_LABELS[level],
      }))}
    />
  );
}

export function Pager({
  period,
  scope,
  direction,
  markPartial,
  onChange,
}: {
  period: Period;
  scope: Scope;
  direction: number;
  // grey dot on the month where sdat ends (only matters for the verbrauch)
  markPartial: boolean;
  onChange: (period: Period) => void;
}) {
  const previous = shiftPeriod(period, -1, scope);
  const next = shiftPeriod(period, 1, scope);
  return (
    <div className="flex items-center gap-2">
      <StepButton
        label="Vorheriger Zeitraum"
        target={previous}
        onChange={onChange}
      >
        <ChevronLeft className="size-4" />
      </StepButton>
      <PeriodPicker
        period={period}
        scope={scope}
        direction={direction}
        markPartial={markPartial}
        onChange={onChange}
      />
      <StepButton label="Nächster Zeitraum" target={next} onChange={onChange}>
        <ChevronRight className="size-4" />
      </StepButton>
    </div>
  );
}

function StepButton({
  label,
  target,
  onChange,
  children,
}: {
  label: string;
  target: Period | null;
  onChange: (period: Period) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={!target}
      onClick={() => target && onChange(target)}
      className="flex size-[34px] items-center justify-center rounded-lg border border-border bg-card text-foreground transition-[opacity,background-color,border-color] duration-150 outline-none hover:border-border-strong hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-45"
    >
      {children}
    </button>
  );
}

const slide = {
  enter: (direction: number) => ({ opacity: 0, y: direction * 8 }),
  center: { opacity: 1, y: 0 },
  exit: (direction: number) => ({
    opacity: 0,
    y: direction * -8,
    transition: { duration: 0.12 },
  }),
};

function PeriodPicker({
  period,
  scope,
  direction,
  markPartial,
  onChange,
}: {
  period: Period;
  scope: Scope;
  direction: number;
  markPartial: boolean;
  onChange: (period: Period) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = pagerLabel(period);
  const mode =
    period.level === "month"
      ? "month"
      : period.level === "day" || period.level === "week"
        ? "day"
        : "year";

  function select(next: Period) {
    onChange(next);
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`Zeitraum wählen: ${label}`}
        className="group flex h-[34px] items-center gap-1.5 overflow-hidden rounded-lg border border-border bg-card pr-2.5 pl-3 text-sm font-medium whitespace-nowrap transition-[border-color,background-color] duration-150 outline-none hover:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:border-primary"
      >
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.span
            key={label}
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="tabular-nums"
          >
            {label}
          </motion.span>
        </AnimatePresence>
        <ChevronDown
          className="size-3.5 text-muted-foreground transition-transform duration-200 group-data-popup-open:rotate-180"
          aria-hidden
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="center"
          sideOffset={6}
          className="z-50"
        >
          <Popover.Popup className="origin-(--transform-origin) rounded-[10px] border border-border bg-card p-3 shadow-[0_12px_16px_rgb(0_0_0/0.1),0_1px_1px_rgb(0_0_0/0.04)] transition-[opacity,scale] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] outline-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-[0.97] data-starting-style:opacity-0 motion-reduce:transition-none">
            {mode === "month" && (
              <MonthGrid
                period={period}
                scope={scope}
                markPartial={markPartial}
                onSelect={select}
              />
            )}
            {mode === "year" && (
              <YearGrid period={period} scope={scope} onSelect={select} />
            )}
            {mode === "day" && (
              <div className="w-[268px]">
                <Calendar
                  label={period.level === "week" ? "Woche" : "Tag"}
                  value={clampDay(period.range.from, scope.data)}
                  min={scope.data.from}
                  max={scope.data.to}
                  onSelect={(day) =>
                    select(periodOf(period.level as Level, day, scope))
                  }
                />
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

const yearSlide = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 14 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -14,
    transition: { duration: 0.15 },
  }),
};

function MonthGrid({
  period,
  scope,
  markPartial,
  onSelect,
}: {
  period: Period;
  scope: Scope;
  markPartial: boolean;
  onSelect: (period: Period) => void;
}) {
  const firstYear = Number(scope.data.from.slice(0, 4));
  const lastYear = Number(scope.data.to.slice(0, 4));
  const [year, setYear] = useState(Number(period.range.from.slice(0, 4)));
  const [direction, setDirection] = useState(0);
  const current = period.range.from.slice(0, 7);
  const gaps = gapMonths(useAnalysisData());

  function show(next: number) {
    setDirection(Math.sign(next - year));
    setYear(next);
  }

  return (
    <div className="flex w-[212px] flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <NavButton
          label="Vorheriges Jahr"
          disabled={year <= firstYear}
          onClick={() => show(year - 1)}
        >
          <ChevronLeft className="size-4" />
        </NavButton>
        <span className="text-[13px] font-semibold tabular-nums">{year}</span>
        <NavButton
          label="Nächstes Jahr"
          disabled={year >= lastYear}
          onClick={() => show(year + 1)}
        >
          <ChevronRight className="size-4" />
        </NavButton>
      </div>
      <div className="relative overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={year}
            custom={direction}
            variants={yearSlide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="grid grid-cols-3 gap-1"
          >
            {MONTH_SHORT.map((name, index) => {
              const key = `${year}-${String(index + 1).padStart(2, "0")}`;
              const month = periodOf("month", `${key}-01`, scope);
              const disabled = !intersect(month.range, scope.data);
              const selected = key === current;
              const mark = gaps.has(key)
                ? "gap"
                : markPartial && key === PARTIAL_MONTH
                  ? "partial"
                  : null;
              return (
                <GridButton
                  key={key}
                  label={name}
                  title={`${name} ${year}`}
                  selected={selected}
                  disabled={disabled}
                  mark={mark}
                  onClick={() => onSelect(month)}
                />
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex flex-col gap-1 border-t border-muted pt-2 text-[11px] text-muted-foreground">
        <Legend mark="gap">Unvollständiger Monat (SDAT-Lücken)</Legend>
        {markPartial && (
          <Legend mark="partial">
            Teilweise: SDAT endet am {formatDay(scope.data.to)}
          </Legend>
        )}
      </div>
    </div>
  );
}

function YearGrid({
  period,
  scope,
  onSelect,
}: {
  period: Period;
  scope: Scope;
  onSelect: (period: Period) => void;
}) {
  const firstYear = Number(scope.data.from.slice(0, 4));
  const lastYear = Number(scope.data.to.slice(0, 4));
  const gaps = gapMonths(useAnalysisData());
  const years = Array.from(
    { length: lastYear - firstYear + 1 },
    (_, i) => firstYear + i,
  );
  return (
    <div className="flex w-[212px] flex-col gap-2.5">
      <span className="text-center text-[13px] font-semibold">Jahr</span>
      <div className="grid grid-cols-3 gap-1">
        {years.map((year) => {
          const hasGap = [...gaps].some((month) =>
            month.startsWith(String(year)),
          );
          return (
            <GridButton
              key={year}
              label={String(year)}
              title={String(year)}
              selected={
                period.level === "year" &&
                period.range.from.startsWith(String(year))
              }
              disabled={false}
              mark={hasGap ? "gap" : null}
              onClick={() => onSelect(periodOf("year", `${year}-01-01`, scope))}
            />
          );
        })}
      </div>
      <div className="border-t border-muted pt-2 text-[11px] text-muted-foreground">
        <Legend mark="gap">Jahr mit SDAT-Lücken</Legend>
      </div>
    </div>
  );
}

function GridButton({
  label,
  title,
  selected,
  disabled,
  mark,
  onClick,
}: {
  label: string;
  title: string;
  selected: boolean;
  disabled: boolean;
  mark: "gap" | "partial" | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={title}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative flex h-9 flex-col items-center justify-center rounded-md text-[13px] font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:translate-y-px",
        selected
          ? "bg-primary text-primary-foreground"
          : disabled
            ? "text-border-strong"
            : "text-foreground hover:bg-muted",
      )}
    >
      {label}
      {mark && !disabled && (
        <span
          aria-hidden
          className={cn(
            "absolute bottom-1 size-1 rounded-full",
            mark === "gap" ? "bg-danger" : "bg-faint",
          )}
        />
      )}
    </button>
  );
}

function Legend({
  mark,
  children,
}: {
  mark: "gap" | "partial";
  children: ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          mark === "gap" ? "bg-danger" : "bg-faint",
        )}
      />
      {children}
    </span>
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-md text-soft-foreground transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60 disabled:text-border-strong disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
