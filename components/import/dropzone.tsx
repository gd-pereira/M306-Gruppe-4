"use client";

import {
  Activity,
  File as FileIcon,
  Folder,
  Gauge,
  Upload,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { EASE_OUT } from "@/components/motion-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FILE_KINDS = [
  {
    icon: Activity,
    title: "SDAT-Dateien",
    tag: "alle 15 Min.",
    text: "Verbrauch für Bezug (ID742) und Einspeisung (ID735), andere Sensoren fallen weg.",
    recommended: false,
  },
  {
    icon: Gauge,
    title: "ESL-Dateien",
    tag: "monatlich",
    text: "Abgelesene Zählerstände. Daraus wird der Stand für jede Viertelstunde berechnet.",
    recommended: false,
  },
  {
    icon: Folder,
    title: "Ganzer Ordner",
    tag: "empfohlen",
    text: "Alles auf einmal wählen. Doppelte und fremde Dateien werden automatisch aussortiert.",
    recommended: true,
  },
];

// swaps its text with a short slide, used for the drag-over copy
function SwapText({
  id,
  className,
  children,
}: {
  id: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.p
        key={id}
        className={className}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18 }}
      >
        {children}
      </motion.p>
    </AnimatePresence>
  );
}

export function Dropzone({
  dragging,
  onPickFiles,
  onPickFolder,
  onLoadDemo,
}: {
  dragging: boolean;
  onPickFiles: () => void;
  onPickFolder: () => void;
  onLoadDemo: () => void;
}) {
  return (
    <>
      <motion.section
        aria-label="Dateien importieren"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "flex min-h-[340px] flex-1 flex-col items-center justify-center gap-3 rounded-card border-[1.5px] border-dashed px-6 py-9 text-center transition-colors duration-200",
          dragging
            ? "border-primary bg-background"
            : "border-border-strong bg-surface",
        )}
      >
        <motion.div
          animate={dragging ? { scale: 1.08, y: -4 } : { scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 22 }}
          className={cn(
            "flex size-14 items-center justify-center rounded-full shadow-card transition-colors duration-200",
            dragging
              ? "bg-primary text-primary-foreground"
              : "bg-card text-foreground",
          )}
        >
          <motion.span
            animate={dragging ? { y: [0, -3, 0] } : { y: 0 }}
            transition={
              dragging
                ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.2 }
            }
          >
            <Upload className="size-[22px]" aria-hidden />
          </motion.span>
        </motion.div>

        <div className="flex flex-col items-center gap-1">
          <SwapText
            id={dragging ? "drop" : "idle"}
            className="text-lg font-semibold"
          >
            {dragging
              ? "Dateien hier loslassen"
              : "Dateien oder Ordner hierher ziehen"}
          </SwapText>
          <SwapText
            id={dragging ? "drop-hint" : "idle-hint"}
            className="text-sm text-muted-foreground"
          >
            {dragging
              ? "Nur .xml-Dateien werden eingelesen, alles andere wird übersprungen"
              : "SDAT- und ESL-Dateien (.xml) · mehrere Dateien oder ein ganzer Ordner"}
          </SwapText>
        </div>

        <div
          className={cn(
            "flex flex-col items-center gap-3 transition-opacity duration-200",
            dragging && "pointer-events-none opacity-0",
          )}
        >
          <div className="flex items-center gap-2 pt-1">
            <Button variant="brand" size="lg" onClick={onPickFiles}>
              <FileIcon />
              Dateien auswählen
            </Button>
            <Button variant="outline" size="lg" onClick={onPickFolder}>
              <Folder />
              Ordner auswählen
            </Button>
          </div>
          <p className="pt-2 text-[13px] text-muted-foreground">
            Keine Dateien zur Hand?{" "}
            <button
              type="button"
              onClick={onLoadDemo}
              className="rounded-sm font-medium text-primary underline underline-offset-2 transition-colors hover:text-foreground/70 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              Demo-Daten laden
            </button>
          </p>
        </div>
      </motion.section>

      <section
        aria-labelledby="file-kinds-title"
        className={cn(
          "flex flex-col gap-2.5 transition-opacity duration-200",
          dragging && "opacity-40",
        )}
      >
        <motion.h2
          id="file-kinds-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-[13px] font-medium text-muted-foreground"
        >
          Was du importieren kannst
        </motion.h2>
        <ul className="grid grid-cols-3 gap-4">
          {FILE_KINDS.map((kind, index) => {
            const Icon = kind.icon;
            return (
              <motion.li
                key={kind.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  ease: EASE_OUT,
                  delay: 0.12 + index * 0.06,
                }}
                className="flex gap-3.5 rounded-card bg-card py-4 pr-[18px] pl-4 shadow-card"
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-[10px]",
                    kind.recommended
                      ? "bg-brand-soft text-brand-strong"
                      : "bg-background text-foreground",
                  )}
                >
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">{kind.title}</h3>
                    <span
                      className={cn(
                        "rounded-full px-[7px] py-0.5 text-[11px] font-medium",
                        kind.recommended
                          ? "bg-brand-soft text-brand-strong"
                          : "bg-background text-soft-foreground",
                      )}
                    >
                      {kind.tag}
                    </span>
                  </div>
                  <p className="text-[13px] leading-[19px] text-muted-foreground">
                    {kind.text}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
