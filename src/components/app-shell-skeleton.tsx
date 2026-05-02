import { Skeleton } from "~/components/ui/skeleton";

/** Main-column loading state while auth or Convex user resolves; matches app content width. */
export function AppShellSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-6">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Skeleton className="h-7 w-40" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-xl bg-muted/30"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
