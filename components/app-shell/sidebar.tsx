"use client";

import { Lock, PanelLeft, Search } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { FluxLogo, FluxMark } from "@/components/brand/flux-logo";
import { EASE_OUT } from "@/components/motion-provider";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { setCommandPaletteOpen } from "./command-palette";
import {
  NAV_GROUPS,
  NEEDS_DATA_HINT,
  navItemFor,
  shortcutOf,
  type NavItem,
} from "./nav";
import { useRecentViews, type RecentView } from "./recent-views";
import { toggleSidebar, useSidebarPrefs } from "./sidebar-prefs";
import { useHydrated, useModKeyLabel } from "./shortcuts";
import { useDataSummary, type DataSummary } from "./use-data-summary";

// flush with the window edge, figma «Sidebar G · F in Zinc»
const OPEN_WIDTH = 244;
const COLLAPSED_WIDTH = 64;

const FOCUS_RING =
  "focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none";

// the old content fades out fast, the new one fades in once the width is on its way
const contentVariants: Variants = {
  hidden: { opacity: 0 },
  shown: (animate: boolean) => ({
    opacity: 1,
    transition: animate
      ? { duration: 0.25, delay: 0.12, ease: EASE_OUT }
      : { duration: 0 },
  }),
  gone: (animate: boolean) => ({
    opacity: 0,
    transition: { duration: animate ? 0.1 : 0 },
  }),
};

export function Sidebar() {
  const pathname = usePathname();
  const summary = useDataSummary();
  const { collapsed, animate } = useSidebarPrefs();
  const hydrated = useHydrated();
  const reduceMotion = useReducedMotion();
  const play = animate && !reduceMotion;

  return (
    <TooltipProvider>
      <motion.div
        data-sidebar-frame
        data-hydrated={hydrated}
        initial={false}
        animate={{ width: collapsed ? COLLAPSED_WIDTH : OPEN_WIDTH }}
        transition={play ? { duration: 0.4, ease: EASE_OUT } : { duration: 0 }}
        className="sticky top-0 flex h-dvh shrink-0"
      >
        <aside className="relative flex-1 overflow-hidden bg-sidebar text-sidebar-foreground">
          <AnimatePresence initial={false} mode="popLayout" custom={play}>
            <motion.div
              key={collapsed ? "collapsed" : "open"}
              data-sidebar-content
              custom={play}
              variants={contentVariants}
              initial="hidden"
              animate="shown"
              exit="gone"
              className="h-full"
            >
              {collapsed ? (
                <CollapsedSidebar pathname={pathname} summary={summary} />
              ) : (
                <OpenSidebar pathname={pathname} summary={summary} />
              )}
            </motion.div>
          </AnimatePresence>
        </aside>
      </motion.div>
    </TooltipProvider>
  );
}

function Divider() {
  return <div aria-hidden className="h-px shrink-0 bg-sidebar-subtle" />;
}

function OpenSidebar({
  pathname,
  summary,
}: {
  pathname: string;
  summary: DataSummary | null;
}) {
  const recent = useRecentViews();
  const mod = useModKeyLabel();

  return (
    <div className="flex h-full w-61 flex-col px-3.5 pt-4 pb-3.5">
      <div className="flex items-center justify-between pr-0.5 pb-[18px] pl-1.5">
        <FluxLogo className="h-7 w-auto text-sidebar-accent-foreground" />
        <Tooltip label="Sidebar einklappen" sideOffset={24}>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Sidebar einklappen"
            className={cn(
              "flex size-7 items-center justify-center rounded-lg text-sidebar-icon transition-colors duration-150 hover:bg-sidebar-hover hover:text-sidebar-accent-foreground active:translate-y-px",
              FOCUS_RING,
            )}
          >
            <PanelLeft className="size-4" />
          </button>
        </Tooltip>
      </div>

      <button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        aria-keyshortcuts="Control+K Meta+K"
        className={cn(
          "flex h-9 shrink-0 items-center gap-2 rounded-[10px] border border-sidebar-card-border bg-sidebar-card pr-1.5 pl-2.5 text-left text-sidebar-placeholder transition-colors duration-150 hover:border-sidebar-border hover:text-sidebar-foreground active:translate-y-px",
          FOCUS_RING,
        )}
      >
        <Search className="size-[15px]" aria-hidden />
        <span className="flex-1 text-[13px]">Suchen …</span>
        <kbd className="rounded-[5px] bg-sidebar-accent px-[5px] py-px font-mono text-[10px] font-medium text-sidebar-placeholder">
          {mod} K
        </kbd>
      </button>

      {/* scrolls on short windows, the negative margin keeps the focus rings visible */}
      <nav
        aria-label="Hauptnavigation"
        className="-mx-1 mt-[22px] flex min-h-0 [scrollbar-width:none] flex-col gap-3 overflow-y-auto px-1 py-0.5"
      >
        {NAV_GROUPS.map((group, index) => (
          <Fragment key={group.label}>
            {index > 0 && <Divider />}
            <div
              role="group"
              aria-label={group.label}
              className="flex flex-col gap-0.5"
            >
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
          </Fragment>
        ))}

        <RecentGroup views={summary ? recent : []} />
      </nav>

      <div className="min-h-3 flex-1" />

      <Divider />
      <EnergyBalance summary={summary} />
      <div className="h-3 shrink-0" />
      <Divider />

      <div className="flex shrink-0 items-center justify-between pt-3 pl-1.5">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-success" />
            <span className="text-xs font-medium text-sidebar-accent-foreground">
              Lokal gespeichert
            </span>
          </div>
          <span className="text-[11px] text-sidebar-muted">
            Nichts verlässt den Browser
          </span>
        </div>
        <Tooltip label="App sperren" sideOffset={22}>
          <Link
            href="/login"
            aria-label="App sperren"
            className={cn(
              "flex size-8 items-center justify-center rounded-[10px] bg-sidebar-accent text-sidebar-placeholder transition-colors duration-150 hover:text-sidebar-accent-foreground active:translate-y-px",
              FOCUS_RING,
            )}
          >
            <Lock className="size-[15px]" />
          </Link>
        </Tooltip>
      </div>
    </div>
  );
}

// amber tint that glides to the new page instead of jumping, one id per sidebar state
function ActiveTint({ state }: { state: "open" | "collapsed" }) {
  return (
    <motion.span
      aria-hidden
      layoutId={`nav-active-${state}`}
      transition={{ duration: 0.35, ease: EASE_OUT }}
      className="absolute inset-0 -z-10 rounded-lg bg-sidebar-primary/12"
    />
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
    "relative isolate flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px]",
    active && "font-medium text-sidebar-primary",
    !active && disabled && "cursor-default text-sidebar-disabled",
    !active &&
      !disabled &&
      cn(
        "transition-colors duration-150 hover:bg-sidebar-hover hover:text-sidebar-accent-foreground",
        FOCUS_RING,
      ),
  );
  const content = (
    <>
      {active && <ActiveTint state="open" />}
      <Icon
        aria-hidden
        className={cn(
          "size-4 shrink-0",
          active
            ? "text-sidebar-primary"
            : disabled
              ? "text-sidebar-disabled"
              : "text-sidebar-icon",
        )}
      />
      <span className="flex-1">{item.label}</span>
      {badge && (
        <span className="rounded-md bg-sidebar-accent px-1.5 py-px text-[11px] font-medium text-sidebar-placeholder">
          {badge}
        </span>
      )}
    </>
  );

  // the keys remount the tooltip when span and link swap, Base UI binds hover to the first element only
  if (disabled && !active) {
    return (
      <Tooltip key="locked" label={NEEDS_DATA_HINT} delay={400} sideOffset={22}>
        <span aria-disabled className={className}>
          {content}
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      key="link"
      label={item.label}
      shortcut={shortcutOf(item)}
      delay={700}
      sideOffset={22}
    >
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        aria-keyshortcuts={`g ${item.key.toLowerCase()}`}
        className={className}
      >
        {content}
      </Link>
    </Tooltip>
  );
}

// the last three periods and exports, only while data is loaded (figma «Daten=nein» has no group)
function RecentGroup({ views }: { views: RecentView[] }) {
  return (
    <AnimatePresence initial={false}>
      {views.length > 0 && (
        <motion.div
          key="recent"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
          className="flex flex-col gap-3"
        >
          <Divider />
          <div
            role="group"
            aria-labelledby="recent-views-label"
            className="flex flex-col gap-0.5"
          >
            <p
              id="recent-views-label"
              className="pb-1 pl-2.5 text-[11px] font-medium text-sidebar-muted"
            >
              Zuletzt angesehen
            </p>
            <AnimatePresence initial={false} mode="popLayout">
              {views.map((view, index) => (
                <motion.div
                  key={`${view.page}|${view.label}`}
                  layout="position"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  transition={{
                    duration: 0.35,
                    ease: EASE_OUT,
                    delay: index * 0.04,
                  }}
                >
                  <RecentLink view={view} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RecentLink({ view }: { view: RecentView }) {
  const nav = navItemFor(`/${view.page}`);
  const Icon = nav?.icon ?? Search;
  return (
    <Link
      href={view.href}
      className={cn(
        "flex h-[30px] items-center gap-2.5 rounded-lg px-2.5 transition-colors duration-150 hover:bg-sidebar-hover hover:text-sidebar-accent-foreground",
        FOCUS_RING,
      )}
    >
      <Icon aria-hidden className="size-3.5 shrink-0 text-sidebar-icon" />
      <span className="min-w-0 flex-1 truncate text-[12.5px]">
        {view.label}
      </span>
      <span className="shrink-0 text-[11px] text-sidebar-muted">
        {nav?.label}
      </span>
    </Link>
  );
}

function EnergyBalance({ summary }: { summary: DataSummary | null }) {
  const total = summary ? summary.consumptionKwh + summary.feedInKwh : 0;
  const rows = [
    {
      label: "Bezug",
      fill: "bg-sidebar-accent-foreground",
      kwh: summary?.consumptionKwh,
    },
    {
      label: "Einspeisung",
      fill: "bg-brand",
      kwh: summary?.feedInKwh,
    },
  ];

  return (
    <section
      aria-label="Energiebilanz"
      className="flex shrink-0 flex-col gap-2.5 px-1.5 pt-3.5"
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

      {total > 0 ? (
        <motion.div
          aria-hidden
          className="flex h-1.5 origin-left gap-0.5"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.15 }}
        >
          {rows.map((row) => (
            <div
              key={row.label}
              className={cn("h-full basis-0 rounded-[3px]", row.fill)}
              style={{ flexGrow: row.kwh }}
            />
          ))}
        </motion.div>
      ) : (
        <div aria-hidden className="h-1.5 rounded-[3px] bg-sidebar-track" />
      )}

      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-1.5">
          <span className={cn("size-[5px] rounded-full", row.fill)} />
          <span className="flex-1 text-[11.5px]">{row.label}</span>
          <span
            className={cn(
              "text-[11px] font-medium tabular-nums",
              row.kwh === undefined
                ? "text-sidebar-muted"
                : "text-sidebar-accent-foreground",
            )}
          >
            {row.kwh === undefined ? "–" : `${formatNumber(row.kwh)} kWh`}
          </span>
        </div>
      ))}

      <p className="text-[11px] text-sidebar-muted">
        {summary && summary.consumptionKwh > 0
          ? `Einspeisung deckt ${coverage(summary)} % des Bezugs`
          : "Erscheint nach dem ersten Import"}
      </p>
    </section>
  );
}

function coverage(summary: DataSummary): number {
  return Math.round((summary.feedInKwh / summary.consumptionKwh) * 100);
}

// figma «Sidebar – Eingeklappt»: icons only, names and shortcuts in tooltips
function CollapsedSidebar({
  pathname,
  summary,
}: {
  pathname: string;
  summary: DataSummary | null;
}) {
  const mod = useModKeyLabel();

  return (
    <div className="flex h-full w-16 flex-col items-center px-2.5 pt-4 pb-3.5">
      <FluxMark className="h-7 w-[30.4px] shrink-0 text-sidebar-accent-foreground" />

      <Tooltip label="Suchen" shortcut={`${mod} K`} delay={250} sideOffset={18}>
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Suchen"
          aria-keyshortcuts="Control+K Meta+K"
          className={cn(
            "mt-5 flex h-10 w-11 shrink-0 items-center justify-center rounded-[10px] border border-sidebar-card-border bg-sidebar-card text-sidebar-placeholder transition-colors duration-150 hover:border-sidebar-border hover:text-sidebar-accent-foreground active:translate-y-px",
            FOCUS_RING,
          )}
        >
          <Search className="size-[18px]" />
        </button>
      </Tooltip>

      <nav
        aria-label="Hauptnavigation"
        className="mt-[18px] flex min-h-0 flex-col items-center"
      >
        {NAV_GROUPS.map((group, index) => (
          <Fragment key={group.label}>
            {index > 0 && (
              <div aria-hidden className="my-2.5 h-px w-6 bg-sidebar-subtle" />
            )}
            <div
              role="group"
              aria-label={group.label}
              className="flex flex-col gap-1"
            >
              {group.items.map((item) => (
                <CollapsedNavLink
                  key={item.href}
                  item={item}
                  active={pathname === item.href}
                  disabled={item.needsData && !summary}
                  dot={item.href === "/import" && summary !== null}
                />
              ))}
            </div>
          </Fragment>
        ))}
      </nav>

      <div className="min-h-3 flex-1" />

      <MiniBalance summary={summary} />

      <Tooltip label="Sidebar ausklappen" delay={250} sideOffset={20}>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Sidebar ausklappen"
          className={cn(
            "mt-3 flex h-9 w-10 shrink-0 items-center justify-center rounded-[10px] text-sidebar-icon transition-colors duration-150 hover:bg-sidebar-hover hover:text-sidebar-accent-foreground active:translate-y-px",
            FOCUS_RING,
          )}
        >
          <PanelLeft className="size-[18px]" />
        </button>
      </Tooltip>

      <Tooltip
        label="App sperren"
        hint="Lokal gespeichert"
        delay={250}
        sideOffset={20}
      >
        <Link
          href="/login"
          aria-label="App sperren"
          className={cn(
            "relative mt-1 flex h-9 w-10 shrink-0 items-center justify-center rounded-[10px] bg-sidebar-accent text-sidebar-placeholder transition-colors duration-150 hover:text-sidebar-accent-foreground active:translate-y-px",
            FOCUS_RING,
          )}
        >
          <Lock className="size-[15px]" />
          <span
            aria-hidden
            className="absolute -top-0.5 right-0.5 size-2 rounded-full bg-success"
          />
        </Link>
      </Tooltip>
    </div>
  );
}

function CollapsedNavLink({
  item,
  active,
  disabled,
  dot,
}: {
  item: NavItem;
  active: boolean;
  disabled: boolean;
  dot: boolean;
}) {
  const Icon = item.icon;
  const className = cn(
    "relative isolate flex h-10 w-11 items-center justify-center rounded-lg",
    !active && disabled && "cursor-default",
    !active &&
      !disabled &&
      cn("transition-colors duration-150 hover:bg-sidebar-hover", FOCUS_RING),
  );
  const content = (
    <>
      {active && <ActiveTint state="collapsed" />}
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
      {dot && (
        <span
          aria-hidden
          className="absolute top-[7px] left-[31px] size-[7px] rounded-full bg-sidebar-primary"
        />
      )}
    </>
  );

  if (disabled && !active) {
    return (
      <Tooltip
        key="locked"
        label={item.label}
        hint={NEEDS_DATA_HINT}
        delay={250}
        sideOffset={18}
      >
        <span aria-disabled aria-label={item.label} className={className}>
          {content}
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      key="link"
      label={item.label}
      shortcut={shortcutOf(item)}
      delay={250}
      sideOffset={18}
    >
      <Link
        href={item.href}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        aria-keyshortcuts={`g ${item.key.toLowerCase()}`}
        className={className}
      >
        {content}
      </Link>
    </Tooltip>
  );
}

function MiniBalance({ summary }: { summary: DataSummary | null }) {
  const max = summary ? Math.max(summary.consumptionKwh, summary.feedInKwh) : 0;
  const share =
    summary && summary.consumptionKwh > 0 ? coverage(summary) : null;
  const bars = [
    {
      key: "consumption",
      fill: "bg-sidebar-accent-foreground",
      kwh: summary?.consumptionKwh,
    },
    { key: "feedIn", fill: "bg-brand", kwh: summary?.feedInKwh },
  ];
  const description =
    share === null
      ? "Energiebilanz erscheint nach dem ersten Import"
      : `Einspeisung deckt ${share} % des Bezugs`;

  return (
    <Tooltip label={description} delay={250} sideOffset={18}>
      <div
        role="img"
        tabIndex={0}
        aria-label={description}
        className={cn(
          "flex w-11 shrink-0 flex-col items-center gap-1.5 rounded-xl border border-sidebar-card-border bg-sidebar-card pt-2.5 pb-2",
          FOCUS_RING,
        )}
      >
        <div className="flex h-[30px] items-end gap-1">
          {bars.map((bar) => (
            <div
              key={bar.key}
              className={cn(
                "relative h-full w-1.5 rounded-[2px]",
                share === null && "bg-sidebar-track",
              )}
            >
              {bar.kwh !== undefined && max > 0 && (
                <motion.div
                  className={cn(
                    "absolute inset-0 origin-bottom rounded-[2px]",
                    bar.fill,
                  )}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: bar.kwh / max }}
                  transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.15 }}
                />
              )}
            </div>
          ))}
        </div>
        <span className="font-mono text-[10px] font-medium text-sidebar-foreground">
          {share === null ? "–" : `${share} %`}
        </span>
      </div>
    </Tooltip>
  );
}
