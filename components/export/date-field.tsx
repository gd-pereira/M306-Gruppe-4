"use client";

import { Popover } from "@base-ui/react/popover";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { dayKey, formatDay, type DayKey } from "./fake-export";

const MONTHS = [
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
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function DateField({
  label,
  value,
  min,
  max,
  invalid,
  onChange,
}: {
  label: string;
  value: DayKey;
  min: DayKey;
  max: DayKey;
  invalid?: boolean;
  onChange: (day: DayKey) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`${label}: ${formatDay(value)}`}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex h-[38px] min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-lg border bg-card px-3 text-left text-sm shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-[border-color,box-shadow] duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:border-primary",
          invalid
            ? "border-danger-border"
            : "border-border hover:border-border-strong",
        )}
      >
        <CalendarDays
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="tabular-nums"
          >
            {formatDay(value)}
          </motion.span>
        </AnimatePresence>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="start"
          sideOffset={6}
          className="z-50"
        >
          <Popover.Popup className="w-[292px] origin-(--transform-origin) rounded-[10px] border border-border bg-card p-3 shadow-[0_12px_16px_rgb(0_0_0/0.1),0_1px_1px_rgb(0_0_0/0.04)] transition-[opacity,scale] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] outline-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-[0.97] data-starting-style:opacity-0 motion-reduce:transition-none">
            <Calendar
              label={label}
              value={value}
              min={min}
              max={max}
              onSelect={(day) => {
                onChange(day);
                setOpen(false);
              }}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function monthIndex(day: DayKey): number {
  const [year, month] = day.split("-").map(Number);
  return year * 12 + month - 1;
}

// whole weeks from monday to sunday, days of the neighbouring months included
function monthGrid(year: number, month: number) {
  const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = Math.ceil((offset + length) / 7) * 7;
  return Array.from({ length: cells }, (_, index) => {
    const day = index - offset + 1;
    return {
      key: dayKey(year, month, day),
      inMonth: day >= 1 && day <= length,
    };
  });
}

const slide = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 14 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -14,
    transition: { duration: 0.15 },
  }),
};

export function Calendar({
  label,
  value,
  min,
  max,
  onSelect,
}: {
  label: string;
  value: DayKey;
  min: DayKey;
  max: DayKey;
  onSelect: (day: DayKey) => void;
}) {
  const minIndex = monthIndex(min);
  const maxIndex = monthIndex(max);
  const [view, setView] = useState(() => monthIndex(value));
  const [direction, setDirection] = useState(0);
  const year = Math.floor(view / 12);
  const month = view % 12;
  const [minYear] = min.split("-").map(Number);
  const [maxYear] = max.split("-").map(Number);

  function show(next: number) {
    const clamped = Math.min(maxIndex, Math.max(minIndex, next));
    setDirection(Math.sign(clamped - view));
    setView(clamped);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5">
        <NavButton
          label="Vorheriger Monat"
          disabled={view <= minIndex}
          onClick={() => show(view - 1)}
        >
          <ChevronLeft className="size-4" />
        </NavButton>
        <NativeSelect
          label={`${label}: Monat`}
          value={month}
          onChange={(next) => show(year * 12 + next)}
          className="flex-1"
        >
          {MONTHS.map((name, index) => {
            const option = year * 12 + index;
            return (
              <option
                key={name}
                value={index}
                disabled={option < minIndex || option > maxIndex}
              >
                {name}
              </option>
            );
          })}
        </NativeSelect>
        <NativeSelect
          label={`${label}: Jahr`}
          value={year}
          onChange={(next) => show(next * 12 + month)}
          className="w-[76px]"
        >
          {Array.from(
            { length: maxYear - minYear + 1 },
            (_, i) => minYear + i,
          ).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </NativeSelect>
        <NavButton
          label="Nächster Monat"
          disabled={view >= maxIndex}
          onClick={() => show(view + 1)}
        >
          <ChevronRight className="size-4" />
        </NavButton>
      </div>

      <div className="grid grid-cols-7" aria-hidden>
        {WEEKDAYS.map((weekday) => (
          <span
            key={weekday}
            className="flex h-6 items-center justify-center text-[11px] font-medium text-faint"
          >
            {weekday}
          </span>
        ))}
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={view}
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="grid grid-cols-7 gap-y-0.5"
          >
            {monthGrid(year, month).map(({ key, inMonth }) => {
              const selected = key === value;
              const disabled = !inMonth || key < min || key > max;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  aria-label={formatDay(key)}
                  onClick={() => onSelect(key)}
                  className={cn(
                    "flex h-8 items-center justify-center rounded-md text-[13px] tabular-nums transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:translate-y-px",
                    selected
                      ? "bg-primary font-medium text-primary-foreground"
                      : disabled
                        ? "text-border-strong"
                        : "text-foreground hover:bg-muted",
                  )}
                >
                  {Number(key.slice(8))}
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="flex items-center gap-1.5 border-t border-muted pt-2 text-[11px] text-muted-foreground">
        <Info className="size-3 shrink-0" aria-hidden />
        Daten vorhanden: {formatDay(min)} – {formatDay(max)}
      </p>
    </div>
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
      className="flex size-7 shrink-0 items-center justify-center rounded-md text-soft-foreground transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60 disabled:text-border-strong disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function NativeSelect({
  label,
  value,
  onChange,
  className,
  children,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cn("relative flex", className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-7 w-full appearance-none rounded-md border border-border bg-card pr-7 pl-2.5 text-[13px] font-medium transition-[border-color,box-shadow] duration-150 outline-none hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </span>
  );
}
