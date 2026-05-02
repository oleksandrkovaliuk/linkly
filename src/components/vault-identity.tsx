import { cn } from "~/lib/utils";

type VaultIdentityProps = {
  emoji?: string;
  size?: "sm" | "md";
  className?: string;
};

export function VaultIdentity({
  emoji,
  size = "sm",
  className,
}: VaultIdentityProps) {
  const resolvedEmoji = emoji?.trim() || "📁";

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-sans",
        size === "sm" ? "text-sm leading-none" : "text-base leading-none",
        className
      )}
    >
      {resolvedEmoji}
    </span>
  );
}
