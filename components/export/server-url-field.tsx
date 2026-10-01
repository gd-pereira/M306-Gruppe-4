"use client";

import { CircleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { PLACEHOLDER_URL } from "./api-request";

export function ServerUrlField({
  value,
  onChange,
  onBlur,
  onSubmit,
  invalid,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onSubmit: () => void;
  invalid: boolean;
  disabled: boolean;
}) {
  const id = useId();
  const noteId = `${id}-note`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[13px] font-medium">
          Server-URL
        </label>
        <button
          type="button"
          onClick={() => {
            const origin =
              typeof window !== "undefined"
                ? window.location.origin
                : "http://localhost:3000";
            onChange(`${origin}/api/zaehlerstaende`);
          }}
          className="text-xs font-medium text-brand underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Demo-Server verwenden
        </button>
      </div>
      <input
        id={id}
        type="url"
        inputMode="url"
        autoComplete="url"
        spellCheck={false}
        placeholder={PLACEHOLDER_URL}
        value={value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={noteId}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit();
        }}
        className={cn(
          "h-[38px] w-full rounded-lg border bg-card px-3 font-mono text-[13px] shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-[border-color,box-shadow,background-color,color] duration-150 outline-none placeholder:text-faint focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-surface disabled:text-muted-foreground",
          invalid
            ? "border-danger-border"
            : "border-border hover:border-border-strong focus-visible:border-primary",
        )}
      />
      <div
        id={noteId}
        className="relative h-4 overflow-hidden"
        aria-live="polite"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {invalid ? (
            <motion.p
              key="error"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-1.5 text-xs text-danger-strong"
            >
              <CircleAlert
                className="size-3.5 shrink-0 text-danger"
                aria-hidden
              />
              Bitte eine vollständige URL mit http:// oder https:// eingeben.
            </motion.p>
          ) : (
            <motion.p
              key="hint"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
              transition={{ duration: 0.2 }}
              className="truncate text-xs text-muted-foreground"
            >
              Sendet die Daten als JSON per HTTP-POST, im gleichen Format wie
              der JSON-Export (beide Sensoren).
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
