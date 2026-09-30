import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-card bg-card px-5 py-4 text-card-foreground shadow-card",
        className,
      )}
      {...props}
    />
  );
}

export { Card };
