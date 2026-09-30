"use client";

import { XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useSyncExternalStore, type ReactNode } from "react";
import { EASE_OUT } from "@/components/motion-provider";

interface ToastItem {
  id: number;
  icon?: ReactNode;
  title: string;
  description?: string;
}

const EMPTY: ToastItem[] = [];
let toasts: ToastItem[] = EMPTY;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function dismissToast(id: number) {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

// newest at the bottom, at most three at once
export function toast(item: Omit<ToastItem, "id">, duration = 3500) {
  const id = nextId++;
  toasts = [...toasts, { ...item, id }].slice(-3);
  emit();
  setTimeout(() => dismissToast(id), duration);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function Toaster() {
  const items = useSyncExternalStore(
    subscribe,
    () => toasts,
    () => EMPTY,
  );

  return (
    <div
      role="region"
      aria-label="Benachrichtigungen"
      className="pointer-events-none fixed right-6 bottom-6 z-50 flex w-[356px] flex-col items-end gap-2"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {items.map((item) => (
          <motion.div
            key={item.id}
            layout
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            className="pointer-events-auto flex w-full items-start gap-2.5 rounded-[10px] bg-primary py-3 pr-3 pl-3.5 text-primary-foreground shadow-[0_10px_14px_rgb(0_0_0/0.18)]"
          >
            {item.icon && (
              <span
                className="mt-px shrink-0 text-brand [&_svg]:size-4"
                aria-hidden
              >
                {item.icon}
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-[13px] font-medium">{item.title}</p>
              {item.description && (
                <p className="text-xs text-faint">{item.description}</p>
              )}
            </div>
            <button
              type="button"
              aria-label="Schliessen"
              onClick={() => dismissToast(item.id)}
              className="-m-1 flex size-6 shrink-0 items-center justify-center rounded-md text-faint transition-colors duration-150 hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
            >
              <XIcon className="size-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
