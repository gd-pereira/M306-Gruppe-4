import { useSyncExternalStore } from "react";
import { NAV_ITEMS, type NavItem } from "./nav";

// how long after "G" the second key still counts
const SEQUENCE_MS = 1000;

interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

export function isPaletteShortcut(event: KeyLike): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    event.key.toLowerCase() === "k"
  );
}

// duck-typed so it also works outside the browser in the tests
export function isTypingTarget(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const element = target as { tagName?: string; isContentEditable?: boolean };
  if (element.isContentEditable) return true;
  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT"
  );
}

// feed it every key press, it returns the nav item once "G" and a letter came in time
export function createGoSequence(timeout = SEQUENCE_MS) {
  let armedAt: number | null = null;
  return (key: string, now: number): NavItem | null => {
    const letter = key.toLowerCase();
    const armed = armedAt !== null && now - armedAt <= timeout;
    armedAt = null;
    if (armed) {
      const item = NAV_ITEMS.find((nav) => nav.key.toLowerCase() === letter);
      if (item) return item;
    }
    if (letter === "g") armedAt = now;
    return null;
  };
}

function isMac(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.platform);
}

const noSubscribe = () => () => {};

// "Ctrl" on the server and on windows/linux, "⌘" on apple devices
export function useModKeyLabel(): string {
  return useSyncExternalStore(
    noSubscribe,
    () => (isMac() ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );
}

// false while hydrating, true afterwards
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}
