import {
  createRootRouteWithContext,
  Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { AppShellSkeleton } from "~/components/app-shell-skeleton";
import { AppSidebar } from "~/components/app-sidebar";
import { CommandPalette } from "~/components/command-palette";
import { SidebarProvider } from "~/components/ui/sidebar";
import { Toaster } from "~/components/ui/sonner";
import { useAuth } from "~/hooks/use-auth";
import type { RouterContext } from "~/router";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import { ErrorBoundary } from "react-error-boundary";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  errorComponent: ErrorComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  const auth = useAuth();

  const isAuthenticated = auth?.authenticated ?? false;
  const canQueryProtected = auth?.canQueryProtected ?? false;
  const isLoading = auth?.isLoading ?? true;

  const showMainSkeleton =
    isLoading || (isAuthenticated && !canQueryProtected);

  return (
    <SidebarProvider>
      <NuqsAdapter>
        <div className="relative mx-auto flex h-svh w-full max-w-6xl overflow-hidden">
          <AppSidebar />
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div
              data-root-scroll
              className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain scroll-smooth"
            >
              <ErrorBoundary fallback={<ErrorComponent />}>
                {showMainSkeleton ? <AppShellSkeleton /> : <Outlet />}
              </ErrorBoundary>
            </div>
          </main>
        </div>
        <Toaster />
        {canQueryProtected ? <CommandPalette /> : null}
      </NuqsAdapter>

      {canQueryProtected ? (
        <TanStackRouterDevtools position="bottom-right" />
      ) : null}
    </SidebarProvider>
  );
}

function ErrorComponent() {
  return <div>Error</div>;
}

function NotFoundComponent() {
  return <div>Not found</div>;
}
