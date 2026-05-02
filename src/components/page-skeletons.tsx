import { Skeleton } from "./ui/skeleton";

export function PageLoadingState() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1">
      {/* Banner skeleton */}
      <div className="relative h-20 w-full rounded-b-xl bg-muted/40">
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-lg bg-background/60 p-0.5 backdrop-blur-sm">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="size-7 rounded-md" />
        </div>
        <div className="absolute bottom-0 left-6 translate-y-1/2">
          <Skeleton className="size-12 rounded-xl" />
        </div>
      </div>

      <div className="px-6 pt-8 pb-4">
        <Skeleton className="h-5 w-32" />
      </div>

      <div className="px-6 pb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-44 animate-pulse rounded-xl bg-muted/30"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function HistoryLoadingState() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="h-5 w-28" />
      </div>
      <div className="space-y-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton className="size-7 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsLoadingState() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-3.5 w-48" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-px w-full" />
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

export function InboxLoadingState() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <Skeleton className="h-6 w-20" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-1">
            <div className="flex items-center gap-2 px-3 py-1.5">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 w-24" />
            </div>
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="size-7 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
