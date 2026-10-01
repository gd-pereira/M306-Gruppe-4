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
  const { restoring } = useImportStore();
  const hasData = useDataSummary() !== null;
  const onboarded = useOnboarded();

  // until hydration/restore finishes, css picks via boot script flag:
  const pending = (onboarded === null || restoring) && !hasData;

  // sidebar is only visible when there are data (or temporarily during initial restore if onboarded)
  const showSidebar = hasData || (restoring && onboarded === true);
  const showBar = !hasData;

  const pathname = usePathname();
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
        <AnimatePresence initial={false} mode="popLayout">
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
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: play ? 0.15 : 0 } }}
      transition={{ duration: 0.35, ease: EASE_OUT }}
      className="relative -mx-10 -mt-8 mb-2 flex h-[72px] items-center justify-between bg-card/60 px-10"
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
        className="rounded-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
