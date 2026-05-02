import { useClerk } from "@clerk/clerk-react";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { Link, useMatchRoute, useParams } from "@tanstack/react-router";
import { DialogTrigger } from "~/components/ui/dialog";
import { api } from "~/convex/_generated/api";
import type { Id } from "~/convex/_generated/dataModel";
import { useAuth } from "~/hooks/use-auth";
import {
  Inbox,
  Link2,
  LogInIcon,
  Plus,
  Search,
  Share2,
} from "lucide-react";

const isMac =
  typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

import { CreateVaultDialog } from "./create-vault-dialog";
import { Logo } from "./icons/logo";
import { LoginDialog } from "./login-dialog/login-dialog";
import { ThemeToggle } from "./theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar";
import { Skeleton } from "./ui/skeleton";


type SidebarVault = {
  _id: Id<"vaults">;
  name: string;
  color?: string | null;
  emoji?: string;
};

type SidebarReceivedShare = {
  share: {
    _id: string;
    token: string;
  };
  role?: "viewer" | "editor";
  vault?: {
    name?: string;
    color?: string | null;
    emoji?: string;
  } | null;
  sharer?: {
    name?: string | null;
    email?: string | null;
    image_url?: string | null;
  } | null;
};

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const auth = useAuth();
  const { signOut } = useClerk();
  const matchRoute = useMatchRoute();

  const { data: vaults, isLoading: isVaultsLoading } = useQuery({
    enabled: auth.canQueryProtected,
    ...convexQuery(api.vaults.listMine, {}),
  });

  const { data: receivedShares, isLoading: isReceivedSharesLoading } =
    useQuery({
      enabled: auth.canQueryProtected,
      ...convexQuery(api.shares.listReceived, {}),
    });
  const typedVaults = (vaults ?? []) as SidebarVault[];
  const typedReceivedShares = (receivedShares ?? []) as SidebarReceivedShare[];

  const shouldShowDropdown = auth.session && !auth.isLoading;
  const shouldShowLoginButton = !auth.session && !auth.isLoading;

  const shouldShowVaultSkeletons =
    auth.isLoading ||
    (auth.authenticated && !auth.canQueryProtected) ||
    isVaultsLoading;
  const shouldShowSharedSkeletons =
    auth.isLoading ||
    (auth.authenticated && !auth.canQueryProtected) ||
    isReceivedSharesLoading;

  const routeParams: { vaultId?: string; shareToken?: string } = useParams({
    strict: false,
  });
  const isOnSpecificVault = Boolean(routeParams.vaultId);
  const isOnSpecificShare = Boolean(routeParams.shareToken);

  const isMyVaultsActive =
    Boolean(matchRoute({ to: "/my-vaults" })) && !isOnSpecificVault;
  const isSharedWithMeActive =
    Boolean(matchRoute({ to: "/shared-with-me" })) && !isOnSpecificShare;
  const isInboxActive = Boolean(matchRoute({ to: "/history" }));

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="pb-2">
            <Button
              size="icon-sm"
              variant="ghost"
              nativeButton={false}
              render={
                <Link to="/">
                  <Logo className="size-4.5" />
                </Link>
              }
            />
          </SidebarMenuItem>

          <SidebarMenuItem>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(
                  new KeyboardEvent("keydown", {
                    key: "k",
                    metaKey: true,
                    bubbles: true,
                  })
                );
              }}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] text-muted-foreground/60 transition-colors hover:bg-accent"
            >
              <Search className="size-4" />
              <span className="flex-1 text-left">Search...</span>
              <kbd className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/50">
                {isMac ? "⌘" : "Ctrl+"}K
              </kbd>
            </button>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={isMyVaultsActive}
              render={
                <Link
                  to="/my-vaults"
                  preload="intent"
                  activeOptions={{ exact: true }}
                >
                  <Link2 />
                  <span className="truncate">My Vaults</span>
                </Link>
              }
            />
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={isSharedWithMeActive}
              render={
                <Link
                  to="/shared-with-me"
                  preload="intent"
                  activeOptions={{ exact: true }}
                >
                  <Share2 />
                  <span className="truncate">Shared with me</span>
                </Link>
              }
            />
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={isInboxActive}
              render={
                <Link
                  to="/history"
                  preload="intent"
                  activeOptions={{ exact: true }}
                >
                  <Inbox />
                  <span className="truncate">Inbox</span>
                </Link>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Vaults</SidebarGroupLabel>
          {auth.canQueryProtected ? (
            <CreateVaultDialog
              trigger={
                <SidebarGroupAction aria-label="New vault">
                  <Plus />
                </SidebarGroupAction>
              }
            />
          ) : null}
          <SidebarGroupContent>
            <SidebarMenu>
              {shouldShowVaultSkeletons ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <SidebarMenuItem key={`vault-skeleton-${index}`}>
                    <SidebarMenuButton>
                      <Skeleton className="size-5 shrink-0 rounded-md" />
                      <Skeleton className="h-3.5 w-20" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : typedVaults.length ? (
                typedVaults.map((vault) => (
                  <SidebarMenuItem key={vault._id}>
                    <SidebarMenuButton
                      isActive={routeParams.vaultId === vault._id}
                      render={
                        <Link
                          to="/my-vaults/$vaultId"
                          preload="intent"
                          params={{ vaultId: vault._id }}
                        >
                          <span
                            className="flex size-5 shrink-0 items-center justify-center rounded-md text-[11px] leading-none"
                            style={{
                              backgroundColor: `${vault.color ?? "#6b7280"}20`,
                            }}
                          >
                            {vault.emoji ?? "📁"}
                          </span>
                          <span className="truncate">{vault.name}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                ))
              ) : (
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <span className="text-xs text-muted-foreground">
                      No vaults yet
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {typedReceivedShares.length > 0 || shouldShowSharedSkeletons ? (
          <SidebarGroup>
            <SidebarGroupLabel>Shared</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {shouldShowSharedSkeletons
                  ? Array.from({ length: 2 }).map((_, index) => (
                      <SidebarMenuItem key={`shared-skeleton-${index}`}>
                        <SidebarMenuButton>
                          <Skeleton className="size-5 shrink-0 rounded-md" />
                          <Skeleton className="h-3.5 w-20" />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))
                  : typedReceivedShares.map((item) => (
                      <SidebarMenuItem
                        key={item.share._id}
                        className="relative"
                      >
                        <SidebarMenuButton
                          isActive={
                            routeParams.shareToken === item.share.token
                          }
                          render={
                            <Link
                              to="/shared/$shareToken"
                              preload="intent"
                              params={{ shareToken: item.share.token }}
                            >
                              <span
                                className="flex size-5 shrink-0 items-center justify-center rounded-md text-[11px] leading-none"
                                style={{
                                  backgroundColor: `${item.vault?.color ?? "#6b7280"}20`,
                                }}
                              >
                                {item.vault?.emoji ?? "📁"}
                              </span>
                              <span className="truncate">
                                {item.vault?.name ?? "Shared vault"}
                              </span>
                            </Link>
                          }
                        />
                        {item.sharer?.image_url ? (
                          <Avatar
                            size="xs"
                            className="pointer-events-none absolute -right-1 -bottom-1 size-5 ring-2 ring-background"
                          >
                            <AvatarImage src={item.sharer.image_url} />
                            <AvatarFallback className="text-[8px]">
                              {(
                                item.sharer.name ??
                                item.sharer.email ??
                                "?"
                              )
                                .charAt(0)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : null}
                      </SidebarMenuItem>
                    ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {shouldShowDropdown ? (
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <SidebarMenuButton className="flex-1">
                        <Avatar size="sm">
                          <AvatarImage
                            src={auth.user?.image_url ?? undefined}
                          />
                          <AvatarFallback>
                            {auth.user?.first_name?.charAt(0)}
                            {auth.user?.last_name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate text-xs">
                          {auth.user?.email}
                        </span>
                      </SidebarMenuButton>
                    }
                  />
                  <DropdownMenuContent side="top">
                    <DropdownMenuItem onClick={() => signOut()}>
                      Log out
                      <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ThemeToggle />
              </div>
            ) : null}

            {auth.isLoading ? (
              <SidebarMenuButton>
                <Skeleton className="size-6 shrink-0 rounded-lg" />
                <Skeleton className="h-4 w-full rounded-lg" />
              </SidebarMenuButton>
            ) : null}

            {shouldShowLoginButton ? (
              <LoginDialog>
                <DialogTrigger
                  render={
                    <Button className="w-full">
                      <LogInIcon className="size-4" />
                      Log in
                    </Button>
                  }
                />
              </LoginDialog>
            ) : null}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
