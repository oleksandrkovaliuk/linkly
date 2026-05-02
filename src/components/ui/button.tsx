import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cn } from "~/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { Loader } from "../icons/loader";
import { LoaderGridPingPong } from "../icons/loader-grid-ping-pong";
import { LoaderGridStars } from "../icons/loader-grid-stars";

const buttonVariants = cva(
  "focus-visible:border-ring focus-visible:ring-ring/20 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-xl text-sm font-medium transition-all duration-150 focus-visible:ring-[3px] aria-invalid:ring-[3px] [&_svg:not([class*='size-'])]:size-4 inline-flex items-center justify-center whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none group/button select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        outline:
          "border border-border/50 bg-transparent hover:bg-accent aria-expanded:bg-accent aria-expanded:text-foreground",
        secondary:
          "bg-secondary/70 text-secondary-foreground hover:bg-secondary aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-accent/60 aria-expanded:bg-accent aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 hover:bg-destructive/20 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/20 text-destructive focus-visible:border-destructive/40 dark:hover:bg-destructive/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  children,
  className,
  size = "default",
  loading = false,
  loaderVariant = "default",
  loadingPlaceholder = "Loading...",
  variant = "default",
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
    loadingPlaceholder?: string;
    loaderVariant?: "ping-pong" | "stars" | "default";
  }) {
  const countdownTimerId = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [shouldShowLoading, setShouldShowLoading] = React.useState(false);

  React.useEffect(() => {
    if (!loading) {
      if (countdownTimerId.current) {
        clearTimeout(countdownTimerId.current);
        countdownTimerId.current = null;
      }

      React.startTransition(() => {
        setShouldShowLoading(false);
      });
      return;
    }

    countdownTimerId.current = setTimeout(() => {
      setShouldShowLoading(true);
    }, 400);

    return () => {
      if (countdownTimerId.current) {
        clearTimeout(countdownTimerId.current);
        countdownTimerId.current = null;
        React.startTransition(() => {
          setShouldShowLoading(false);
        });
      }
    };
  }, [loading]);

  return (
    <ButtonPrimitive
      data-slot="button"
      disabled={loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {shouldShowLoading && loaderVariant === "default" && (
        <span className="animate-spin">
          <Loader />
        </span>
      )}
      {shouldShowLoading && loaderVariant === "ping-pong" && (
        <LoaderGridPingPong />
      )}
      {shouldShowLoading && loaderVariant === "stars" && <LoaderGridStars />}

      {shouldShowLoading ? loadingPlaceholder : children}
    </ButtonPrimitive>
  );
}

export { Button, buttonVariants };
