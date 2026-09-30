"use client";

import { Lock } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "@/components/ui/toaster";
import { isCommandPaletteOpen, toggleCommandPalette } from "./command-palette";
import { NEEDS_DATA_HINT } from "./nav";
import {
  createGoSequence,
  isPaletteShortcut,
  isTypingTarget,
} from "./shortcuts";
import { useDataSummary } from "./use-data-summary";

function insideDialog(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[role=dialog]") !== null;
}

// Ctrl/Cmd+K anywhere, "G + letter" whenever no field has focus and no dialog is open
export function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const hasData = useDataSummary() !== null;

  useEffect(() => {
    const next = createGoSequence();

    function onKeyDown(event: KeyboardEvent) {
      if (isPaletteShortcut(event)) {
        if (insideDialog(event.target) && !isCommandPaletteOpen()) return;
        event.preventDefault();
        toggleCommandPalette();
        return;
      }
      if (event.defaultPrevented || event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target) || insideDialog(event.target)) return;

      const item = next(event.key, event.timeStamp);
      if (!item) return;
      event.preventDefault();
      if (item.needsData && !hasData) {
        toast({
          icon: <Lock />,
          title: `${item.label}: ${NEEDS_DATA_HINT}`,
          description: "Zuerst die SDAT- und ESL-Dateien importieren.",
        });
        return;
      }
      if (item.href !== pathname) router.push(item.href);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, pathname, hasData]);

  return null;
}
