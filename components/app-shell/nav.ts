import {
  Download,
  Gauge,
  LayoutDashboard,
  Upload,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  needsData: boolean;
  // second key of the "G + letter" shortcut
  key: string;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Übersicht",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        needsData: true,
        key: "D",
      },
    ],
  },
  {
    label: "Analyse",
    items: [
      {
        href: "/verbrauch",
        label: "Verbrauch",
        icon: Zap,
        needsData: true,
        key: "V",
      },
      {
        href: "/zaehlerstand",
        label: "Zählerstand",
        icon: Gauge,
        needsData: true,
        key: "Z",
      },
    ],
  },
  {
    label: "Daten",
    items: [
      {
        href: "/import",
        label: "Import",
        icon: Upload,
        needsData: false,
        key: "I",
      },
      {
        href: "/export",
        label: "Export",
        icon: Download,
        needsData: true,
        key: "E",
      },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export const NEEDS_DATA_HINT = "Erst nach dem Import verfügbar";

export function shortcutOf(item: NavItem): string {
  return `G ${item.key}`;
}

export function navItemFor(href: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.href === href);
}
