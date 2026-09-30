"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const PAGE_SIZES = [10, 25, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

// all pages up to 7, otherwise first, last and the neighbours of the current one
export function pageList(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  if (page <= 2) return [1, 2, 3, "…", pageCount];
  if (page >= pageCount - 1) {
    return [1, "…", pageCount - 2, pageCount - 1, pageCount];
  }
  const pages = [1, page - 1, page, page + 1, pageCount].filter(
    (p, i, all) => all.indexOf(p) === i,
  );
  const list: (number | "…")[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) list.push("…");
    list.push(p);
  });
  return list;
}

const control =
  "flex h-7 min-w-7 items-center justify-center rounded-md px-2 text-xs font-medium transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

function StepButton({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        control,
        "border border-border bg-card text-primary hover:bg-muted disabled:pointer-events-none disabled:opacity-40",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
    </button>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: PageSize;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: PageSize) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const [jump, setJump] = useState("");

  function submitJump() {
    const target = Number(jump);
    if (Number.isInteger(target) && target >= 1 && target <= pageCount) {
      onPage(target);
    }
    setJump("");
  }

  return (
    <div className="flex items-center justify-between gap-4 border-t border-muted px-5 py-2.5">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Pro Seite
          <span className="relative">
            <select
              value={pageSize}
              onChange={(event) =>
                onPageSize(Number(event.target.value) as PageSize)
              }
              className={cn(
                control,
                "appearance-none border border-border bg-card pr-6 pl-2 text-primary hover:bg-muted",
              )}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-2 size-3 -translate-y-1/2 text-primary"
              aria-hidden
            />
          </span>
        </label>
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatNumber(first)}–{formatNumber(last)} von {formatNumber(total)}{" "}
          Dateien
        </p>
      </div>

      <nav aria-label="Seiten" className="flex items-center gap-2.5">
        <div className="flex items-center gap-1">
          <StepButton
            icon={ChevronsLeft}
            label="Erste Seite"
            disabled={page <= 1}
            onClick={() => onPage(1)}
          />
          <StepButton
            icon={ChevronLeft}
            label="Vorherige Seite"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          />
          {pageList(page, pageCount).map((item, index) =>
            item === "…" ? (
              <span
                key={`gap-${index}`}
                className="px-0.5 text-xs text-faint"
                aria-hidden
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                aria-label={`Seite ${item}`}
                aria-current={item === page ? "page" : undefined}
                onClick={() => onPage(item)}
                className={cn(
                  control,
                  "tabular-nums",
                  item === page
                    ? "bg-primary text-primary-foreground"
                    : "text-soft-foreground hover:bg-muted",
                )}
              >
                {item}
              </button>
            ),
          )}
          <StepButton
            icon={ChevronRight}
            label="Nächste Seite"
            disabled={page >= pageCount}
            onClick={() => onPage(page + 1)}
          />
          <StepButton
            icon={ChevronsRight}
            label="Letzte Seite"
            disabled={page >= pageCount}
            onClick={() => onPage(pageCount)}
          />
        </div>
        <span className="h-5 w-px bg-border" aria-hidden />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Seite
          <input
            inputMode="numeric"
            value={jump}
            onChange={(event) => setJump(event.target.value.replace(/\D/g, ""))}
            onKeyDown={(event) => event.key === "Enter" && submitJump()}
            onBlur={() => jump && submitJump()}
            placeholder={`1–${formatNumber(pageCount)}`}
            className="h-7 w-16 rounded-md border border-border bg-card px-2 text-xs text-foreground tabular-nums transition-[border-color,box-shadow] outline-none placeholder:text-faint focus:border-ring focus:ring-3 focus:ring-ring/30"
          />
        </label>
      </nav>
    </div>
  );
}
