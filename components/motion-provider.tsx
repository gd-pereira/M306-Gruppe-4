"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

// all motion components skip their animations when the os asks for reduced motion
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: 0.35, ease: EASE_OUT }}
    >
      {children}
    </MotionConfig>
  );
}
