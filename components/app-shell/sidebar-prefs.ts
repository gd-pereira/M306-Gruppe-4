import { useSyncExternalStore } from "react";
import { SIDEBAR_KEY } from "./sidebar-boot";

export interface SidebarPrefs {
  collapsed: boolean;
  // false for the value restored from localStorage, so a reload does not play the animation
  animate: boolean;
}

const SERVER_PREFS: SidebarPrefs = { collapsed: false, animate: false };

let prefs: SidebarPrefs | null = null;
const listeners = new Set<() => void>();

function read(): SidebarPrefs {
  if (prefs === null) {
    let collapsed = false;
    try {
      collapsed = localStorage.getItem(SIDEBAR_KEY) === "collapsed";
    } catch {
      // storage blocked, the sidebar just starts open
    }
    prefs = { collapsed, animate: false };
  }
  return prefs;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSidebarPrefs(): SidebarPrefs {
  return useSyncExternalStore(subscribe, read, () => SERVER_PREFS);
}

export function toggleSidebar(): void {
  const collapsed = !read().collapsed;
  prefs = { collapsed, animate: true };
  try {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "collapsed" : "open");
  } catch {
    // only this tab remembers it then
  }
  if (collapsed) {
    document.documentElement.dataset.sidebar = "collapsed";
  } else {
    delete document.documentElement.dataset.sidebar;
  }
  for (const listener of listeners) listener();
}
