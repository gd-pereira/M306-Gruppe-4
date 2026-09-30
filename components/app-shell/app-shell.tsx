import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { SmallScreenNotice } from "./small-screen-notice";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SmallScreenNotice />
      <div className="flex min-h-dvh max-lg:hidden">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col gap-5 px-10 py-8">
          {children}
        </main>
      </div>
    </>
  );
}
