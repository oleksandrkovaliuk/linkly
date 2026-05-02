import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ChevronLeft, Lock, Palette } from "lucide-react";
import { cn } from "~/lib/utils";

export const Route = createFileRoute("/my-vaults_/$vaultId/settings")({
  component: SettingsLayout,
});

const NAV_ITEMS = [
  {
    label: "Appearance",
    to: "/my-vaults/$vaultId/settings/appearance" as const,
    icon: Palette,
  },
  {
    label: "Privacy",
    to: "/my-vaults/$vaultId/settings/privacy" as const,
    icon: Lock,
  },
] as const;

function SettingsLayout() {
  const { vaultId } = Route.useParams();

  return (
    <div className="flex h-full w-full flex-1">
      {/* Sub-nav */}
      <aside className="flex w-48 shrink-0 flex-col border-r border-border/50 p-4">
        <Link
          to="/my-vaults/$vaultId"
          params={{ vaultId }}
          preload="intent"
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to vault
        </Link>

        <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
          Settings
        </p>

        <nav className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              params={{ vaultId }}
              preload="intent"
              className="group"
            >
              {({ isActive }) => (
                <span
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 justify-center overflow-y-auto p-8">
        <div className="w-full max-w-xl">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
