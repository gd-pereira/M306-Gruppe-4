import { useSyncExternalStore } from "react";

// set after the first finished import, from then on the import is a normal page with sidebar
const ONBOARDED_KEY = "flux-onboarded";

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
  for (const listener of listeners) {
    listener();
  }
}

export function useOnboarded(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
