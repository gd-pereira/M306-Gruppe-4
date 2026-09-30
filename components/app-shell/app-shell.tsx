import { Suspense, type ReactNode } from "react";
import { MotionProvider } from "@/components/motion-provider";
import { Toaster } from "@/components/ui/toaster";
import { AppFrame } from "./app-frame";
import { CommandPalette } from "./command-palette";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { RecentTracker } from "./recent-tracker";
import { SmallScreenNotice } from "./small-screen-notice";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <MotionProvider>
      <SmallScreenNotice />
      <AppFrame>{children}</AppFrame>
      <CommandPalette />
      <KeyboardShortcuts />
      <Suspense fallback={null}>
        <RecentTracker />
      </Suspense>
      <Toaster />
    </MotionProvider>
  );
}
