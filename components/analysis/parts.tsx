"use client";

import { ChartLine, LoaderCircle, Upload, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { EASE_OUT } from "@/components/motion-provider";
import { AnimatedNumber } from "@/components/export/hooks";
import { useImportStore } from "@/components/import/import-store";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const rise = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};

export const stagger = {
  initial: "initial",
  animate: "animate",
  variants: { animate: { transition: { staggerChildren: 0.05 } } },
};

// the analysis pages need imported data, the sidebar links are locked until then
export function NoData({
  page,
  article = "Der",
}: {
  page: string;
  article?: "Der" | "Die";
}) {
  // after a reload the saved import is still loading, it is not «no data» yet
  const { restoring } = useImportStore();
  if (restoring) {
    return (
      <section
        role="status"
        className="flex flex-1 flex-col items-center justify-center gap-3 rounded-card bg-card px-6 py-16 text-center shadow-card"
      >
        <LoaderCircle
          className="size-5 animate-spin text-soft-foreground motion-reduce:animate-none"
          aria-hidden
        />
        <p className="text-sm text-muted-foreground">
          Gespeicherte Daten werden geladen …
        </p>
      </section>
    );
  }
  return (
    <motion.section
      {...rise}
      className="flex flex-1 flex-col items-center justify-center gap-4 rounded-card bg-card px-6 py-16 text-center shadow-card"
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-skeleton text-soft-foreground">
        <ChartLine className="size-5" aria-hidden />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <h2 className="text-[15px] font-semibold">Noch keine Daten</h2>
        <p className="text-sm text-muted-foreground">
          {article} {page} erscheint, sobald die SDAT- und ESL-Dateien
          importiert sind.
        </p>
      </div>
      <Link href="/import" className={buttonVariants({ size: "lg" })}>
        <Upload />
        Zum Import
      </Link>
    </motion.section>
  );
}

export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: number | null;
  sub: string;
}) {
  return (
    <motion.div
      variants={rise}
      className="flex min-w-0 flex-col gap-1.5 rounded-card bg-card px-5 py-3.5 shadow-card"
    >
      <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden />
        {label}
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tracking-[-0.6px] tabular-nums">
          {value === null ? "–" : <AnimatedNumber value={value} decimals={1} />}
        </span>
        <span className="text-[13px] font-medium text-muted-foreground">
          kWh
        </span>
      </span>
      <Swap value={sub} className="text-xs text-faint" />
    </motion.div>
  );
}

// text that fades up when it changes
export function Swap({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <span className={cn("relative block h-[1.3em] overflow-hidden", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          className="block truncate"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function LegendPill({
  swatch,
  label,
  pressed,
  disabled,
  onClick,
  bordered = true,
}: {
  swatch: ReactNode;
  label: string;
  // undefined: not a button, only a legend entry
  pressed?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  bordered?: boolean;
}) {
  const className = cn(
    "flex items-center gap-1.5 rounded-full py-1 text-xs whitespace-nowrap text-soft-foreground",
    bordered ? "border border-border bg-card px-2.5" : "px-1",
  );
  if (pressed === undefined) {
    return (
      <span className={className}>
        {swatch}
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-disabled={disabled || undefined}
      title={disabled ? "Mindestens eine Reihe bleibt sichtbar" : undefined}
      onClick={() => !disabled && onClick?.()}
      className={cn(
        className,
        "transition-[opacity,border-color,color] duration-150 outline-none hover:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px",
        !pressed && "text-faint opacity-60",
        disabled && "cursor-default active:translate-y-0",
      )}
    >
      {swatch}
      {label}
    </button>
  );
}

export function LineSwatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="h-[3px] w-2.5 rounded-[2px] transition-colors duration-150"
      style={{ background: color }}
    />
  );
}

export function DotSwatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="size-2 rounded-full border-[1.5px] bg-card"
      style={{ borderColor: color }}
    />
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-soft-foreground">
      {children}
    </span>
  );
}
