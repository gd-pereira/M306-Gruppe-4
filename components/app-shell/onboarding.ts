import { useSyncExternalStore } from "react";
import { ONBOARDED_KEY } from "./sidebar-boot";

// set after the first finished import, from then on the import is a normal page with sidebar

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function read(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, "1");
  } catch {
    // storage blocked, the fullscreen import just shows again next time
  }
  document.documentElement.dataset.onboarded = "";
  for (const listener of listeners) {
    listener();
  }
}

// null while server rendering and hydrating, the boot script and css cover that moment
export function useOnboarded(): boolean | null {
  return useSyncExternalStore<boolean | null>(subscribe, read, () => null);
}
