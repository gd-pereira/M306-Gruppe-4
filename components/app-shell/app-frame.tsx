"use client";

import { Lock } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { FluxLogo } from "@/components/brand/flux-logo";
import { EASE_OUT } from "@/components/motion-provider";
import { buttonVariants } from "@/components/ui/button";
import { markOnboarded, useOnboarded } from "./onboarding";
import { Sidebar } from "./sidebar";
import { useDataSummary } from "./use-data-summary";

// before the first import the import is the only useful page: it runs fullscreen and the
// sidebar slides in once it is done, afterwards the app always has its sidebar
export function AppFrame({ children }: { children: ReactNode }) {
  const hasData = useDataSummary() !== null;
  const onboarded = useOnboarded();
  // until hydration both sidebar and bar are rendered, css picks one via the boot script flag
  const pending = onboarded === null && !hasData;
  const showSidebar = hasData || onboarded !== false;
  const showBar = !hasData && onboarded !== true;
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const redirecting = !hasData && onboarded === false && pathname !== "/import";
  const guarded = pending && pathname !== "/import";
  // switching from the pending state after hydration must not animate
  const [ready, setReady] = useState(false);
  const play = ready && !reduceMotion;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (hasData && onboarded === false) markOnboarded();
  }, [hasData, onboarded]);

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
      className="flex items-center justify-between pb-3"
    >
      <FluxLogo className="h-7 w-auto text-foreground" />
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
