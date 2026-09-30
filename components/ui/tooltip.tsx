"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type { ReactElement } from "react";
import { cn } from "@/lib/utils";

// neighbouring tooltips open instantly once one is visible
function TooltipProvider(props: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider delay={500} {...props} />;
}

// dark label with an optional shortcut, fades and slides 4 px away from the trigger
function Tooltip({
  label,
  hint,
  shortcut,
  children,
  side = "right",
  sideOffset = 8,
  delay,
  disabled,
}: {
  label: string;
  hint?: string;
  shortcut?: string;
  children: ReactElement;
  side?: TooltipPrimitive.Positioner.Props["side"];
  sideOffset?: number;
  delay?: number;
  disabled?: boolean;
}) {
  return (
    <TooltipPrimitive.Root disabled={disabled}>
      <TooltipPrimitive.Trigger delay={delay} render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner
          side={side}
          sideOffset={sideOffset}
          className="z-50"
        >
          <TooltipPrimitive.Popup
            className={cn(
              "flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent py-1.5 pl-2.5 text-xs font-medium whitespace-nowrap text-sidebar-accent-foreground shadow-[0_8px_20px_rgb(0_0_0/0.2)]",
              shortcut ? "pr-1.5" : "pr-2.5",
              "origin-(--transform-origin) transition-[opacity,translate] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] data-ending-style:opacity-0 data-ending-style:duration-100 data-instant:transition-none data-starting-style:opacity-0 motion-reduce:transition-none",
              "data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=left]:data-starting-style:translate-x-1 data-[side=right]:data-starting-style:-translate-x-1 data-[side=top]:data-starting-style:translate-y-1",
            )}
          >
            {label}
            {hint && (
              <span className="font-normal text-sidebar-foreground">
                {hint}
              </span>
            )}
            {shortcut && (
              <kbd className="rounded-[5px] bg-sidebar-kbd px-[5px] py-px font-mono text-[10px] font-medium text-sidebar-icon">
                {shortcut}
              </kbd>
            )}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export { Tooltip, TooltipProvider };
