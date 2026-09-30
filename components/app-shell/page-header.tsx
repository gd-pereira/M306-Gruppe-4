import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex animate-in items-end justify-between gap-4 duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-[-0.5px]">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2.5">{actions}</div>
      )}
    </header>
  );
}
