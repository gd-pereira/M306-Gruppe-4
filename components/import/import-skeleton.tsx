import { cn } from "@/lib/utils";

const ROW_CELLS = [40, 56, 70, 76, 72];

function Bar({ className }: { className: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-full motion-reduce:animate-none",
        className,
      )}
    />
  );
}

// stands in for the file table and the summary while an import runs
export function ImportSkeleton() {
  return (
    <div
      className="flex flex-1 flex-col items-stretch gap-5 overflow-hidden xl:flex-row"
      aria-hidden
    >
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-card bg-card shadow-card">
        <div className="p-5">
          <Bar className="h-3 w-[140px] bg-skeleton" />
        </div>
        {Array.from({ length: 10 }, (_, row) => (
          <div
            key={row}
            className="flex h-11 items-center gap-6 border-t border-background px-5"
          >
            {[220 + row * 3, ...ROW_CELLS].map((width, cell) => (
              <div key={cell} className="shrink-0" style={{ width }}>
                <Bar className="h-2.5 bg-skeleton-soft" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex shrink-0 flex-col overflow-hidden rounded-card bg-card shadow-card xl:w-[340px]">
        <div className="p-5">
          <Bar className="h-3 w-[120px] bg-skeleton" />
        </div>
        {[150, 187, 120, 160, 140, 170, 110].map((width) => (
          <div
            key={width}
            className="flex h-11 items-center justify-between border-t border-background px-5"
          >
            <div style={{ width }}>
              <Bar className="h-2.5 bg-skeleton-soft" />
            </div>
            <Bar className="h-2.5 w-[70px] bg-skeleton-soft" />
          </div>
        ))}
      </div>
    </div>
  );
}
