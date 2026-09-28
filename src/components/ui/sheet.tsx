import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;

export function SheetContent({
  className,
  children,
  side = "left",
  ...props
}: DialogPrimitive.DialogContentProps & { side?: "left" | "right" | "bottom" }) {
  const pos =
    side === "left"
      ? "inset-y-0 left-0 w-[min(20rem,90vw)] data-[state=open]:slide-in-from-left"
      : side === "right"
        ? "inset-y-0 right-0 w-[min(22rem,90vw)] data-[state=open]:slide-in-from-right"
        : "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl data-[state=open]:slide-in-from-bottom";
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/55 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 bg-card p-4 text-card-foreground shadow-border outline-none data-[state=open]:animate-in",
          pos,
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute top-3 right-3 grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
