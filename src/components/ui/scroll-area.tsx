import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { cn } from "~/lib/utils";

function ScrollArea({
  className,
  children,
  ...props
}: ScrollAreaPrimitive.Root.Props) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className="relative isolate"
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        tabIndex={-1}
        data-slot="scroll-area-viewport"
        className={cn(
          "size-full rounded-[inherit] outline-none",
          "before:pointer-events-none before:absolute before:-top-px before:left-0 before:z-10 before:w-full before:from-background before:to-transparent before:bg-linear-to-b before:transition-[height] before:duration-150 before:ease-out before:h-[min(var(--scrollmask-min-height),var(--scroll-area-overflow-y-start),var(--scrollmask-min-height))] before:[--scroll-area-overflow-y-start:inherit] before:[--scrollmask-min-height:32px]",
          "after:pointer-events-none after:absolute after:-bottom-px after:left-0 after:z-10 after:w-full after:from-background after:to-transparent after:bg-linear-to-t after:transition-[height] after:duration-150 after:ease-out after:h-[min(var(--scrollmask-min-height),var(--scroll-area-overflow-y-end),var(--scrollmask-min-height))] after:[--scroll-area-overflow-y-end:inherit] after:[--scrollmask-min-height:32px]",
          className
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export { ScrollArea, ScrollBar };
