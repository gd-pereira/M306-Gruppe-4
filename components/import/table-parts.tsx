"use client";

import { Search } from "lucide-react";
import { motion } from "motion/react";
import { useId } from "react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FileStatus } from "./import-view";

const STATUS = {
  imported: {
    label: "Eingelesen",
    className: "bg-success-soft text-success-strong",
    dot: "bg-success",
  },
  // every value of the file is already in a newer file
  duplicate: {
    label: "Doppelt",
    className: "bg-muted text-soft-foreground",
    dot: "bg-success",
  },
  ignored: {
    label: "Ignoriert",
    className: "bg-muted text-soft-foreground",
    dot: "bg-faint",
  },
  error: {
    label: "Fehler",
    className: "bg-danger-soft text-danger-strong",
    dot: "bg-danger",
  },
} satisfies Record<FileStatus, object>;

export function StatusBadge({ status }: { status: FileStatus }) {
  const { label, className, dot } = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
      {label}
    </span>
  );
}

// long names lose their middle, the end with the date or id stays readable
export function FileName({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const tail = name.length > 24 ? name.slice(-20) : "";
  const head = tail ? name.slice(0, -20) : name;
  return (
    <span
      title={name}
      className={cn(
        "flex min-w-0 font-mono text-xs text-foreground",
        className,
      )}
    >
      <span className="truncate">{head}</span>
      {tail && <span className="shrink-0">{tail}</span>}
    </span>
  );
}

export interface TabOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

// segmented control, the white pill slides to the selected tab
export function SegmentedTabs<T extends string>({
  label,
  options,
  value,
  onChange,
  size = "sm",
}: {
  label: string;
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
}) {
  const pillId = useId();
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "flex w-fit items-center rounded-lg bg-background p-[3px]",
        size === "sm" ? "gap-1" : "gap-0.5 rounded-[9px]",
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative rounded-md font-medium whitespace-nowrap transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              size === "sm"
                ? "px-2.5 py-[3px] text-xs"
                : "px-4 py-[5px] text-[13px]",
              selected
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {selected && (
              <motion.span
                layoutId={pillId}
                className="absolute inset-0 rounded-md bg-card shadow-[0_1px_2px_rgb(0_0_0/0.08)]"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">
              {option.label}
              {option.count !== undefined && (
                <span className="ml-1 text-faint tabular-nums">
                  {formatNumber(option.count)}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs transition-[border-color,box-shadow] duration-150 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
        className,
      )}
    >
      <Search className="size-3.5 shrink-0 text-faint" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
      />
    </label>
  );
}

export function CountChip({ count }: { count: number }) {
  return (
    <span className="rounded-full bg-muted px-2 py-px text-xs font-medium text-soft-foreground tabular-nums">
      {formatNumber(count)}
    </span>
  );
}
