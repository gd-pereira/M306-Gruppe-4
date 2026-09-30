"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Download,
  Gauge,
  LayoutDashboard,
  Lock,
  PanelLeft,
  Search,
  Upload,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { FluxLogo } from "@/components/brand/flux-logo";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useDataSummary, type DataSummary } from "./use-data-summary";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  needsData: boolean;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Übersicht",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        needsData: true,
      },
    ],
  },
  {
    label: "Analyse",
    items: [
      { href: "/verbrauch", label: "Verbrauch", icon: Zap, needsData: true },
      {
        href: "/zaehlerstand",
        label: "Zählerstand",
        icon: Gauge,
        needsData: true,
      },
    ],
  },
  {
    label: "Daten",
    items: [
      { href: "/import", label: "Import", icon: Upload, needsData: false },
      { href: "/export", label: "Export", icon: Download, needsData: true },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const summary = useDataSummary();

  return (
    <div className="sticky top-0 flex h-dvh shrink-0 py-3 pl-3">
      <aside className="relative flex w-60 flex-col rounded-[18px] bg-sidebar p-3.5 text-sidebar-foreground shadow-sidebar">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        >
          <div className="absolute -top-[70px] -left-[60px] h-40 w-[220px] rounded-full bg-brand/16 blur-[30px]" />
        </div>

        <div className="relative flex items-center justify-between py-1 pr-0.5 pl-1.5">
          <FluxLogo className="h-7 w-auto text-sidebar-accent-foreground" />
          {/* collapsing comes with T4-10 */}
          <button
            type="button"
            disabled
            aria-label="Sidebar einklappen"
            className="flex size-7 items-center justify-center rounded-lg text-sidebar-icon"
          >
            <PanelLeft className="size-4" />
          </button>
        </div>

        {/* search comes with T4-10 */}
        <div className="relative mt-[18px] flex h-9 items-center gap-2 rounded-[10px] border border-sidebar-card-border bg-sidebar-card pr-2 pl-2.5 text-sidebar-placeholder">
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-[13px]">Suchen …</span>
          <kbd className="rounded-[5px] border border-sidebar-border bg-sidebar-accent px-[5px] py-px font-mono text-[10px] font-medium text-sidebar-icon">
            Ctrl K
          </kbd>
        </div>

        <nav
          aria-label="Hauptnavigation"
          className="relative mt-[22px] flex flex-col gap-5"
        >
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-0.5">
              <p className="pb-1.5 pl-2.5 text-[10.5px] font-medium tracking-[0.08em] text-sidebar-muted uppercase">
                {group.label}
              </p>
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={pathname === item.href}
                  disabled={item.needsData && !summary}
                  badge={
                    item.href === "/import" && summary
                      ? formatNumber(summary.fileCount)
                      : undefined
                  }
                />
              ))}
            </div>
          ))}
        </nav>

        <div className="min-h-3 flex-1" />

        <EnergyBalance summary={summary} />

        <div className="my-3 h-px bg-sidebar-subtle" />

        <div className="flex items-center justify-between pl-1">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="flex size-2.5 items-center justify-center rounded-full bg-success/22">
                <span className="size-1.5 rounded-full bg-success" />
              </span>
              <span className="text-xs font-medium text-sidebar-accent-foreground">
                Lokal gespeichert
              </span>
            </div>
            <span className="pl-[18px] text-[11px] text-sidebar-muted">
              Nichts verlässt den Browser
            </span>
          </div>
          <Link
            href="/login"
            aria-label="App sperren"
            title="App sperren"
            className="flex size-8 items-center justify-center rounded-[10px] border border-sidebar-border bg-sidebar-accent text-sidebar-icon transition-colors hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
          >
            <Lock className="size-4" />
          </Link>
        </div>
      </aside>
    </div>
  );
}

function NavLink({
  item,
  active,
  disabled,
  badge,
}: {
  item: NavItem;
  active: boolean;
  disabled: boolean;
  badge?: string;
}) {
  const Icon = item.icon;
  const className = cn(
    "relative flex h-9 items-center gap-2.5 rounded-[10px] border border-transparent pr-2 pl-2.5 text-sm font-medium",
    active &&
      "border-sidebar-border bg-sidebar-accent font-semibold text-sidebar-accent-foreground drop-shadow-[0_1px_1px_rgb(0_0_0/0.3)]",
    !active && disabled && "text-sidebar-disabled",
    !active &&
      !disabled &&
      "transition-colors hover:bg-sidebar-hover focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
  );
  const content = (
    <>
      <Icon
        aria-hidden
        className={cn(
          "size-[18px]",
          active
            ? "text-sidebar-primary"
            : disabled
              ? "text-sidebar-disabled"
              : "text-sidebar-icon",
        )}
      />
      <span className="flex-1">{item.label}</span>
      {badge && (
        <span className="rounded-full bg-sidebar-subtle px-[7px] py-px text-[11px] font-medium">
          {badge}
        </span>
      )}
      {active && (
        <span className="absolute top-1/2 -left-4 h-4 w-[3px] -translate-y-1/2 rounded-r-[3px] bg-sidebar-primary" />
      )}
    </>
  );

  if (disabled && !active) {
    return (
      <span
        aria-disabled
        title="Erst nach dem Import verfügbar"
        className={className}
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={className}
    >
      {content}
    </Link>
  );
}

function EnergyBalance({ summary }: { summary: DataSummary | null }) {
  const max = summary ? Math.max(summary.consumptionKwh, summary.feedInKwh) : 0;
  const rows = [
    {
      label: "Bezug",
      dot: "bg-sidebar-accent-foreground",
      fill: "bg-sidebar-accent-foreground",
      kwh: summary?.consumptionKwh,
    },
    {
      label: "Einspeisung",
      dot: "bg-brand",
      fill: "bg-brand",
      kwh: summary?.feedInKwh,
    },
  ];

  return (
    <section
      aria-label="Energiebilanz"
      className="flex flex-col gap-3 rounded-[14px] border border-sidebar-card-border bg-sidebar-card p-3.5"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-sidebar-accent-foreground">
          Energiebilanz
        </span>
        <span className="text-[11px] text-sidebar-muted">
          {summary
            ? `${summary.firstYear} – ${summary.lastYear}`
            : "keine Daten"}
        </span>
      </div>

      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs">
              <span className={cn("size-1.5 rounded-full", row.dot)} />
              {row.label}
            </span>
            <span
              className={cn(
                "font-mono text-xs font-medium",
                row.kwh === undefined
                  ? "text-sidebar-muted"
                  : "text-sidebar-accent-foreground",
              )}
            >
              {row.kwh === undefined ? "–" : `${formatNumber(row.kwh)} kWh`}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-[3px] bg-sidebar-track">
            {row.kwh !== undefined && max > 0 && (
              <div
                className={cn("h-full rounded-[3px]", row.fill)}
                style={{ width: `${(row.kwh / max) * 100}%` }}
              />
            )}
          </div>
        </div>
      ))}

      <p className="text-[11px] text-sidebar-muted">
        {summary && summary.consumptionKwh > 0
          ? `Einspeisung deckt ${Math.round((summary.feedInKwh / summary.consumptionKwh) * 100)} % des Bezugs`
          : "Erscheint nach dem ersten Import"}
      </p>
    </section>
  );
}
