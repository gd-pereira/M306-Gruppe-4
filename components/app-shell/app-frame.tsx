"use client";

import { Lock } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { FluxLogo } from "@/components/brand/flux-logo";
import { EASE_OUT } from "@/components/motion-provider";
import { buttonVariants } from "@/components/ui/button";
import { Sidebar } from "./sidebar";
import { useDataSummary } from "./use-data-summary";

// without data the import is the only useful page: it runs fullscreen and the sidebar
// slides in once the first import is done
export function AppFrame({ children }: { children: ReactNode }) {
  const fullscreen = useDataSummary() === null;
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const redirecting = fullscreen && pathname !== "/import";

  useEffect(() => {
    if (redirecting) router.replace("/import");
  }, [redirecting, router]);

  return (
    <div className="flex min-h-dvh max-lg:hidden">
      <AnimatePresence initial={false}>
        {!fullscreen && (
          <motion.div
            key="sidebar"
            initial={{ width: 0 }}
            animate={{ width: "auto" }}
            exit={{ width: 0 }}
            transition={
              reduceMotion ? { duration: 0 } : { duration: 0.45, ease: EASE_OUT }
            }
            className="sticky top-0 h-dvh shrink-0 overflow-hidden"
          >
            <Sidebar />
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative flex min-w-0 flex-1 flex-col gap-5 px-10 py-8">
        <AnimatePresence initial={false} mode="popLayout">
          {fullscreen && <FullscreenBar key="bar" />}
        </AnimatePresence>
        {!redirecting && children}
      </main>
    </div>
  );
}

function FullscreenBar() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
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
