"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

// overlay fades, the panel fades and grows from 96 %
function DialogContent({
  className,
  children,
  ...props
}: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="dialog-overlay"
        className="fixed inset-0 z-50 bg-foreground/40 transition-opacity duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none"
      />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-4rem)] w-[calc(100vw-4rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[14px] border border-border bg-card p-6 text-card-foreground shadow-dialog outline-none",
          "transition-[opacity,scale] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] data-ending-style:scale-[0.96] data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-[0.96] data-starting-style:opacity-0 motion-reduce:transition-none",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg font-semibold text-foreground", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm leading-[21px] text-muted-foreground", className)}
      {...props}
    />
  );
}

function DialogClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogCloseIcon({ className }: { className?: string }) {
  return (
    <DialogPrimitive.Close
      aria-label="Schliessen"
      className={cn(
        "flex h-7 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
    >
      <XIcon className="size-4" />
    </DialogPrimitive.Close>
  );
}

export {
  Dialog,
  DialogClose,
  DialogCloseIcon,
  DialogContent,
  DialogDescription,
  DialogTitle,
};
