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
    tint: true,
    recommended: false,
  },
  {
    icon: Gauge,
    title: "ESL-Dateien",
    tag: "monatlich",
    text: "Abgelesene Zählerstände. Daraus wird der Stand für jede Viertelstunde berechnet.",
    tint: false,
    recommended: false,
  },
  {
    icon: Folder,
    title: "Ganzer Ordner",
    tag: "empfohlen",
    text: "Alles auf einmal wählen. Doppelte und fremde Dateien werden automatisch aussortiert.",
    tint: true,
    recommended: true,
  },
];

// soft amber shapes behind the drop area, they only fade in once and brighten while dragging
function DropDecor({ dragging }: { dragging: boolean }) {
  const shapes = [
    "-top-24 -left-20 size-72 rotate-[28deg] rounded-[48px] bg-linear-to-br from-brand/25 to-brand/0",
    "top-6 -right-14 size-52 rotate-[24deg] rounded-[40px] bg-linear-to-bl from-brand/30 to-brand/0",
    "-bottom-28 -left-10 size-60 -rotate-12 rounded-[44px] bg-linear-to-tr from-brand/15 to-brand/0",
  ];
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      animate={{ opacity: dragging ? 1 : 0.8 }}
      transition={{ duration: 0.25 }}
    >
      {shapes.map((shape, index) => (
        <motion.span
          key={shape}
          className={cn("absolute", shape)}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.8,
            ease: EASE_OUT,
            delay: 0.1 + index * 0.06,
          }}
        />
      ))}
      <motion.svg
        viewBox="0 0 200 200"
        className="absolute -right-24 -bottom-36 size-[360px] text-brand"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.55 }}
        transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.3 }}
      >
        <circle
          cx="100"
          cy="100"
          r="96"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </motion.svg>
    </motion.div>
  );
}

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
}: {
  dragging: boolean;
  onPickFiles: () => void;
  onPickFolder: () => void;
}) {
  return (
    <>
      <motion.section
        aria-label="Dateien importieren"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE_OUT }}
        className="flex min-h-[340px] flex-1 flex-col rounded-2xl bg-card p-2 shadow-card"
      >
        <div
          className={cn(
            "relative isolate flex flex-1 flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border-[1.5px] border-dashed px-6 py-9 text-center transition-colors duration-200",
            dragging
              ? "border-brand bg-brand-soft"
              : "border-[#ece6d6] bg-[radial-gradient(ellipse_at_center,#fff8e6_0%,#fffcf4_55%,#fffdf8_100%)]",
          )}
        >
        <DropDecor dragging={dragging} />
        <motion.div
          animate={dragging ? { scale: 1.08, y: -4 } : { scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 22 }}
          className={cn(
            "mb-1 flex size-[60px] items-center justify-center rounded-full shadow-[0_0_0_10px_rgb(255_182_3/0.07),0_10px_36px_-4px_rgb(255_182_3/0.45)] transition-colors duration-200",
            dragging
              ? "bg-brand text-brand-foreground"
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
          <div className="flex items-center gap-2.5 pt-1">
            <Button
              variant="brand"
              size="lg"
              onClick={onPickFiles}
              className="shadow-[0_6px_18px_-6px_rgb(255_182_3/0.75)] active:translate-y-px"
            >
              <FileIcon />
              Dateien auswählen
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={onPickFolder}
              className="bg-card shadow-card active:translate-y-px"
            >
              <Folder />
              Ordner auswählen
            </Button>
          </div>
        </div>
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
          className="text-[15px] font-semibold tracking-[-0.2px]"
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
                className="flex gap-3.5 rounded-xl bg-card py-4 pr-[18px] pl-4 shadow-card"
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-[10px]",
                    kind.tint
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
