import { Eye, ImageOff, Pin } from "lucide-react";
import * as React from "react";

import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

type LinkViewer = {
  userId: string;
  name: string | null;
  avatar: string | null;
};

type LinkCardProps = {
  title: string;
  url: string;
  description?: string;
  image?: string;
  favicon?: string;
  category: string;
  sharedBy?: string;
  isEnriching?: boolean;
  isPinned?: boolean;

  viewers?: LinkViewer[];
  onNavigate?: () => void;
  onTogglePin?: () => void;
};

const EMPTY_VIEWERS: LinkViewer[] = [];

export function LinkCard({
  title,
  url,
  description,
  image,
  favicon,
  category,
  sharedBy,
  isEnriching = false,
  isPinned = false,
  viewers = EMPTY_VIEWERS,
  onNavigate,
  onTogglePin,
}: LinkCardProps) {
  const [isImageBroken, setIsImageBroken] = React.useState(false);
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const hasImage = Boolean(image) && !isImageBroken;

  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {
    /* noop */
  }

  if (isEnriching) {
    return (
      <div className="group relative block outline-none">
        <Card className="relative h-52 overflow-hidden py-0">
          <div className="bg-muted/30 absolute inset-0 animate-pulse" />
          <div className="relative flex h-full flex-col justify-end p-3.5">
            <Skeleton className="mb-1.5 h-4 w-3/4 rounded" />
            <Skeleton className="mb-2 h-3 w-1/2 rounded" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <p className="text-muted-foreground mt-2 truncate text-[11px]">
              {hostname || url}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="group relative block outline-none">
      <Card className="relative h-52 overflow-hidden py-0 transition-shadow duration-200 hover:shadow-lg">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="absolute inset-0 z-[1]"
          aria-label={`Open ${title}`}
          onClick={() => {
            onNavigate?.();
          }}
        />
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
          {onTogglePin ? (
            <button
              type="button"
              className={`rounded-full p-1.5 opacity-0 shadow-sm backdrop-blur-sm transition-all group-hover:opacity-100 ${
                isPinned
                  ? "bg-amber-400 text-amber-950 opacity-100"
                  : "bg-background/80 text-muted-foreground hover:text-foreground"
              }`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onTogglePin();
              }}
              aria-label={isPinned ? "Unpin link" : "Pin link"}
            >
              <Pin className="size-3.5" />
            </button>
          ) : null}
        </div>

        {hasImage ? (
          <>
            <img
              src={image}
              alt={title}
              loading="lazy"
              onError={() => {
                setIsImageBroken(true);
              }}
              onLoad={() => {
                setImageLoaded(true);
              }}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            />
            {!imageLoaded ? (
              <div className="bg-muted/30 absolute inset-0 animate-pulse" />
            ) : null}
          </>
        ) : (
          <div className="bg-muted/20 text-muted-foreground absolute inset-0 flex items-center justify-center">
            <ImageOff className="size-8" />
          </div>
        )}

        {hasImage ? (
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        ) : null}

        <div
          className={`pointer-events-none relative flex h-full flex-col justify-end p-3.5 ${hasImage && imageLoaded ? "text-white" : ""}`}
        >
          <div className="flex items-center gap-1.5">
            {favicon ? (
              <img
                src={favicon}
                alt=""
                aria-hidden
                className="size-3.5 shrink-0 rounded-sm"
              />
            ) : null}
            <p className="line-clamp-1 text-sm leading-tight font-semibold">
              {title}
            </p>
          </div>
          {description ? (
            <p
              className={`mt-1 line-clamp-1 text-xs leading-tight ${hasImage && imageLoaded ? "text-white/70" : "text-muted-foreground"}`}
            >
              {description}
            </p>
          ) : null}
          <div className="mt-2 flex items-center gap-2">
            <Badge
              variant="secondary"
              className={
                hasImage && imageLoaded
                  ? "border-white/20 bg-white/15 text-white backdrop-blur-sm"
                  : ""
              }
            >
              {category}
            </Badge>
            {sharedBy ? (
              <span
                className={`text-xs ${hasImage && imageLoaded ? "text-white/60" : "text-muted-foreground"}`}
              >
                by {sharedBy}
              </span>
            ) : null}
          </div>
        </div>
      </Card>
      <AvatarGroup className="absolute -right-1 -bottom-1">
        <Avatar size="sm" className="bg-muted ring-background ring-2">
          <AvatarFallback className="bg-muted text-muted-foreground">
            <Eye className="size-3" />
          </AvatarFallback>
        </Avatar>
        {viewers.slice(0, 3).map((viewer) => (
          <Avatar
            size="sm"
            key={viewer.userId}
            className="ring-background ring-2"
          >
            <AvatarImage src={viewer.avatar ?? undefined} />
            <AvatarFallback>
              {viewer.name?.charAt(0)?.toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
        ))}
      </AvatarGroup>
    </div>
  );
}
