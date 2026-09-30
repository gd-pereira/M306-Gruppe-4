import { Suspense, type ReactNode } from "react";
import { MotionProvider } from "@/components/motion-provider";
import { Toaster } from "@/components/ui/toaster";
import { CommandPalette } from "./command-palette";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { RecentTracker } from "./recent-tracker";
import { Sidebar } from "./sidebar";
import { SmallScreenNotice } from "./small-screen-notice";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <MotionProvider>
      <SmallScreenNotice />
      <div className="flex min-h-dvh max-lg:hidden">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col gap-5 px-10 py-8">
          {children}
        </main>
      </div>
      <CommandPalette />
      <KeyboardShortcuts />
      <Suspense fallback={null}>
        <RecentTracker />
      </Suspense>
      <Toaster />
    </MotionProvider>
  );
}
