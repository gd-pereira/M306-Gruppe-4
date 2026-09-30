"use client";

import { Download, Send, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { PRESETS, presetFor, type DayRange } from "./fake-export";
import type { ExportMode } from "./selection";

const MODES = [
  {
    id: "file",
    icon: Download,
    title: "Als Datei speichern",
    hint: "CSV pro Sensor oder JSON mit beiden Sensoren herunterladen",
  },
  {
    id: "api",
    icon: Send,
    title: "An API senden",
    hint: "Dieselben Daten als JSON per HTTP-POST an einen Server schicken",
  },
] as const satisfies readonly {
  id: ExportMode;
  icon: LucideIcon;
  title: string;
  hint: string;
}[];

export function ModeTiles({
  value,
  onChange,
}: {
  value: ExportMode;
  onChange: (mode: ExportMode) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // radio group: arrow keys move the selection
  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
      event.key
    ];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + MODES.length) % MODES.length;
    onChange(MODES[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Exportart"
      className="grid grid-cols-2 gap-3"
    >
      {MODES.map((mode, index) => {
        const selected = mode.id === value;
        const Icon = mode.icon;
        return (
          <button
            key={mode.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(mode.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "flex items-center gap-3.5 rounded-card border-[1.5px] py-3.5 pr-[18px] pl-3.5 text-left transition-[border-color,background-color,box-shadow] duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px",
              selected
                ? "border-primary bg-card shadow-card"
                : "border-border hover:border-border-strong hover:bg-card/60",
            )}
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-[9px] transition-colors duration-200",
                selected
                  ? "bg-brand text-brand-foreground"
                  : "bg-skeleton text-soft-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span
                className={cn(
                  "text-sm font-semibold transition-colors duration-200",
                  selected ? "text-foreground" : "text-soft-foreground",
                )}
              >
                {mode.title}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {mode.hint}
              </span>
            </span>
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors duration-200",
                selected ? "border-primary" : "border-border-strong",
              )}
              aria-hidden
            >
              <AnimatePresence initial={false}>
                {selected && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0, transition: { duration: 0.12 } }}
                    transition={{ duration: 0.2 }}
                    className="size-2 rounded-full bg-primary"
                  />
                )}
              </AnimatePresence>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function RangePresets({
  range,
  onSelect,
}: {
  range: DayRange;
  onSelect: (range: DayRange) => void;
}) {
  const active = presetFor(range)?.id;
  const pillId = useId();
  return (
    <div
      role="group"
      aria-label="Schnellwahl Zeitraum"
      className="flex flex-wrap gap-1.5"
    >
      {PRESETS.map((preset) => {
        const selected = preset.id === active;
        return (
          <button
            key={preset.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(preset.range)}
            className={cn(
              "relative rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px",
              selected
                ? "border-transparent text-primary-foreground"
                : "border-border bg-card text-soft-foreground hover:border-border-strong hover:text-foreground",
            )}
          >
            {selected && (
              <motion.span
                layoutId={pillId}
                className="absolute -inset-px rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{preset.label}</span>
          </button>
        );
      })}
    </div>
  );
}
