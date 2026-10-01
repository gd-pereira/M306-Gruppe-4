"use client";

import { Select } from "@base-ui/react/select";
import { Check, ChevronDown, Sun, Zap } from "lucide-react";
import type { Direction, SensorId } from "@/lib/types";
import { SENSORS, sensorInfo } from "./export-data";

const ICONS = { consumption: Zap, feedIn: Sun } satisfies Record<
  Direction,
  unknown
>;

export function SensorSelect({
  value,
  onChange,
}: {
  value: SensorId;
  onChange: (sensor: SensorId) => void;
}) {
  const current = sensorInfo(value);
  const Icon = ICONS[current.direction];

  return (
    <Select.Root
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as SensorId);
      }}
      items={SENSORS.map((sensor) => ({
        value: sensor.id,
        label: sensor.label,
      }))}
    >
      <div className="flex flex-col gap-2">
        <Select.Label className="text-[13px] font-medium">Sensor</Select.Label>
        <Select.Trigger className="group flex h-[38px] w-full items-center gap-2 rounded-lg border border-border bg-card px-3 text-left shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-[border-color,box-shadow] duration-150 outline-none hover:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:border-primary">
          <Icon className="size-4 shrink-0 text-soft-foreground" aria-hidden />
          <span className="text-sm font-medium">{current.label}</span>
          <span className="flex-1 truncate text-[13px] text-faint">
            {current.id}
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-popup-open:rotate-180"
            aria-hidden
          />
        </Select.Trigger>
      </div>
      <Select.Portal>
        <Select.Positioner
          alignItemWithTrigger={false}
          sideOffset={6}
          className="z-50 outline-none"
        >
          <Select.Popup className="w-(--anchor-width) origin-(--transform-origin) rounded-xl border border-border bg-card p-1.5 shadow-[0_12px_16px_rgb(0_0_0/0.1),0_1px_1px_rgb(0_0_0/0.04)] transition-[opacity,scale] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] outline-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-[0.97] data-starting-style:opacity-0 motion-reduce:transition-none">
            <Select.List className="flex flex-col gap-0.5">
              {SENSORS.map((sensor) => {
                const ItemIcon = ICONS[sensor.direction];
                return (
                  <Select.Item
                    key={sensor.id}
                    value={sensor.id}
                    className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-150 outline-none select-none data-highlighted:bg-background"
                  >
                    <ItemIcon
                      className="size-4 shrink-0 text-soft-foreground"
                      aria-hidden
                    />
                    <span className="flex flex-1 flex-col gap-px">
                      <Select.ItemText className="text-[13px] font-medium">
                        {sensor.label}
                      </Select.ItemText>
                      <span className="text-xs text-muted-foreground">
                        {sensor.id} · {sensor.hint}
                      </span>
                    </span>
                    <Select.ItemIndicator className="animate-in duration-200 fade-in-0 zoom-in-75 motion-reduce:animate-none">
                      <Check className="size-4" aria-hidden />
                    </Select.ItemIndicator>
                  </Select.Item>
                );
              })}
            </Select.List>
            <p className="mt-0.5 border-t border-muted px-3 pt-2 pb-1.5 text-xs text-faint">
              Andere Sensoren (ID26256, ID26257, ID26263) werden beim Import
              ignoriert.
            </p>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
