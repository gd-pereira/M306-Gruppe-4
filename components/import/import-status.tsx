"use client";

import Link from "next/link";
import { ArrowRight, Check, CircleAlert, TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ImportStatus({
  total,
  errors,
}: {
  total: number;
  errors: number;
}) {
  const read = total - errors;
  const Icon = errors > 0 ? TriangleAlert : Check;

  return (
    <Card className="flex items-center gap-3.5 py-4 pr-4 pl-5">
      <motion.span
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 420,
          damping: 18,
          delay: 0.1,
        }}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          errors > 0
            ? "bg-warning-soft text-warning"
            : "bg-success-soft text-success",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </motion.span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5" role="status">
        <p className="text-[15px] font-semibold">
          {errors > 0
            ? `Import abgeschlossen, ${formatNumber(errors)} ${errors === 1 ? "Datei" : "Dateien"} fehlerhaft`
            : "Import abgeschlossen"}
        </p>
        <p className="truncate text-[13px] text-muted-foreground">
          {errors > 0
            ? `${formatNumber(read)} von ${formatNumber(total)} Dateien gelesen. Die fehlerhaften Dateien sind unten aufgelistet, der Rest ist bereit.`
            : `${formatNumber(read)} von ${formatNumber(total)} Dateien gelesen, die Daten sind bereit.`}
        </p>
      </div>
      <Link
        href="/dashboard"
        className={cn(
          buttonVariants({ variant: "brand", size: "lg" }),
          "group/cta",
        )}
      >
        Zum Dashboard
        <ArrowRight className="transition-transform duration-200 group-hover/cta:translate-x-0.5" />
      </Link>
    </Card>
  );
}

export function ImportFailedAlert({ message }: { message: string }) {
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
      className="flex items-start gap-3 rounded-card border border-danger-border bg-danger-soft px-4 py-3.5"
    >
      <CircleAlert
        className="mt-px size-4 shrink-0 text-danger-strong"
        aria-hidden
      />
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-danger-deep">
          Import fehlgeschlagen
        </p>
        <p className="text-[13px] text-danger-strong">{message}</p>
      </div>
    </motion.div>
  );
}
