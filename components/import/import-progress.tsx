"use client";

import NumberFlow from "@number-flow/react";
import { LoaderCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";

export function ImportProgress({
  processed,
  total,
  onCancel,
}: {
  processed: number;
  total: number;
  onCancel: () => void;
}) {
  // all files read, the worker is putting them together
  const merging = processed >= total;
  const share = total > 0 ? processed / total : 0;

  return (
    <Card
      role="status"
      aria-live="polite"
      className="flex flex-col gap-2.5 py-4"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <LoaderCircle
            className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={merging ? "merge" : "read"}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="font-medium"
            >
              {merging
                ? "Daten werden zusammengeführt …"
                : "Dateien werden gelesen …"}
            </motion.span>
          </AnimatePresence>
          <span className="text-muted-foreground tabular-nums">
            <NumberFlow value={processed} locales="de-CH" /> von{" "}
            {formatNumber(total)} Dateien{merging && " gelesen"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <NumberFlow
            value={Math.floor(share * 100)}
            suffix=" %"
            className="text-sm font-medium tabular-nums"
          />
          <Button
            variant="outline"
            onClick={onCancel}
            className="h-auto rounded-lg px-3 py-[5px] text-[13px]"
          >
            Abbrechen
          </Button>
        </div>
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Fortschritt"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={processed}
      >
        <motion.div
          className="h-full origin-left rounded-full bg-primary"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: share }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {merging
          ? "Duplikate entfernen, Lücken füllen, Zählerstände berechnen …"
          : "Die Verarbeitung läuft im Hintergrund, die Seite bleibt bedienbar."}
      </p>
    </Card>
  );
}
