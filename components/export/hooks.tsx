"use client";

import NumberFlow from "@number-flow/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { formatNumber } from "@/lib/format";

export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

const noop = () => () => {};

// the server renders the plain text, number-flow takes over after hydration because intl output differs between node and browsers
export function AnimatedNumber({
  value,
  decimals = 0,
}: {
  value: number;
  decimals?: number;
}) {
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  if (!hydrated) return formatNumber(value, decimals);
  return (
    <NumberFlow
      value={value}
      locales="de-CH"
      format={{
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }}
    />
  );
}
