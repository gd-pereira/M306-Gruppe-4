"use client";

import { Lock } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { FluxLogo } from "@/components/brand/flux-logo";
import { EASE_OUT } from "@/components/motion-provider";
import { buttonVariants } from "@/components/ui/button";
import { clearOnboarded, markOnboarded, useOnboarded } from "./onboarding";
import { Sidebar } from "./sidebar";
import { useDataSummary } from "./use-data-summary";
import { useImportStore } from "@/components/import/import-store";

// when there are no data imported, the app runs in fullscreen on /import without a sidebar;
// once data is imported, the sidebar slides in
export function AppFrame({ children }: { children: ReactNode }) {
  const { restoring, status } = useImportStore();
  const hasData = useDataSummary() !== null;
  const onboarded = useOnboarded();
  const pathname = usePathname();

  // until hydration/restore finishes, css picks via boot script flag:
  const pending = (onboarded === null || restoring) && !hasData;

  // sidebar is only visible when there are data (or temporarily during initial restore if onboarded)
  const showSidebar = hasData || (restoring && onboarded === true);
  // the bar belongs to the empty import screen only, it collapses as soon as an import starts
  const showBar = !hasData && pathname === "/import" && status !== "importing";

  const router = useRouter();
  const reduceMotion = useReducedMotion();

  // always redirect to /import whenever there are no data
  const redirecting = !restoring && !hasData && pathname !== "/import";
  const guarded = pending && pathname !== "/import";

  // switching from the pending state after hydration must not animate
  const [ready, setReady] = useState(false);
  const play = ready && !reduceMotion;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (hasData && onboarded === false) {
      markOnboarded();
    } else if (!restoring && !hasData && onboarded === true) {
      clearOnboarded();
    }
  }, [hasData, onboarded, restoring]);

  useEffect(() => {
    if (redirecting) router.replace("/import");
  }, [redirecting, router]);

  return (
    <div className="flex min-h-dvh max-lg:hidden">
      <AnimatePresence initial={false}>
        {showSidebar && (
          <motion.div
            key="sidebar"
            data-frame-sidebar
            data-pending={pending || undefined}
            initial={{ width: 0 }}
            animate={{ width: "auto" }}
            exit={{ width: 0 }}
            transition={
              play ? { duration: 0.45, ease: EASE_OUT } : { duration: 0 }
            }
            className="sticky top-0 h-dvh shrink-0 overflow-hidden"
          >
            <Sidebar />
          </motion.div>
        )}
      </AnimatePresence>

      <main
        data-frame-guard={guarded || undefined}
        className="relative flex min-w-0 flex-1 flex-col gap-5 px-10 py-8"
      >
        <AnimatePresence initial={false}>
          {showBar && <FullscreenBar key="bar" play={play} pending={pending} />}
        </AnimatePresence>
        {!redirecting && children}
      </main>
    </div>
  );
}

function FullscreenBar({ play, pending }: { play: boolean; pending: boolean }) {
  return (
    <motion.header
      data-frame-bar
      data-pending={pending || undefined}
      initial={{ opacity: 0, y: -6, height: 72, marginBottom: 8 }}
      animate={{ opacity: 1, y: 0, height: 72, marginBottom: 8 }}
      exit={{
        opacity: 0,
        y: -8,
        height: 0,
        // with the -mt-8 and the 20px gap of main this ends exactly where the content sits without bar
        marginBottom: 12,
        transition: { duration: play ? 0.35 : 0, ease: EASE_OUT },
      }}
      transition={{ duration: 0.35, ease: EASE_OUT }}
      className="relative -mx-10 -mt-8 flex shrink-0 items-center justify-between overflow-hidden bg-card/60 px-10"
    >
      <motion.span
        aria-hidden
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: play ? 0.6 : 0, ease: EASE_OUT, delay: 0.1 }}
        className="absolute inset-x-0 bottom-0 h-px origin-left bg-border"
      />
      <Link
        href="/import"
        aria-label="Zum Import"
        className="rounded-md transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <FluxLogo className="h-9 w-auto text-foreground" />
      </Link>
      <Link
        href="/login"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <Lock />
        Sperren
      </Link>
    </motion.header>
  );
}
