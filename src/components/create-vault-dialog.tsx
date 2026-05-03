import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { valibotResolver } from "@hookform/resolvers/valibot";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "~/convex/_generated/api";
import { Check, Globe, Lock, Pipette, Plus, X } from "lucide-react";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import * as v from "valibot";

import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "./ui/dialog";
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerSearch,
} from "./ui/emoji-picker";
import { FieldError } from "./ui/field";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Separator } from "./ui/separator";
import { VaultIdentity } from "./vault-identity";

const DEFAULT_VAULT_COLOR = "#6b7280";
const DEFAULT_VAULT_EMOJI = "📁";
const PRESET_COLORS = [
  "#6b7280",
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
];

const vaultSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.nonEmpty("Vault name is required")),
  color: v.pipe(
    v.string(),
    v.trim(),
    v.regex(
      /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/,
      "Color must be a valid hex value"
    )
  ),
  emoji: v.pipe(v.string(), v.trim(), v.nonEmpty("Emoji is required")),
  visibility: v.union([v.literal("private"), v.literal("public")]),
});

type VaultFormInput = v.InferInput<typeof vaultSchema>;

export { PRESET_COLORS, DEFAULT_VAULT_COLOR, DEFAULT_VAULT_EMOJI };

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const colorInputRef = React.useRef<HTMLInputElement>(null);
  const isCustom = !PRESET_COLORS.includes(value);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 transition-colors hover:border-border"
            style={{ backgroundColor: value }}
          >
            <span className="sr-only">Pick color</span>
          </button>
        }
      />
      <PopoverContent className="w-auto p-2" sideOffset={8}>
        <div className="flex items-center gap-1.5">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="relative flex size-7 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110"
              style={{ backgroundColor: preset }}
              onClick={() => onChange(preset)}
            >
              {value === preset ? (
                <Check className="size-3.5 text-white drop-shadow-sm" />
              ) : null}
            </button>
          ))}
          <button
            type="button"
            className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-border/60 transition-transform hover:scale-110"
            style={
              isCustom
                ? { backgroundColor: value }
                : {
                    background:
                      "conic-gradient(#ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #ef4444)",
                  }
            }
            onClick={() => colorInputRef.current?.click()}
          >
            {isCustom ? (
              <Check className="size-3.5 text-white drop-shadow-sm" />
            ) : (
              <Pipette className="size-3 text-white drop-shadow-sm" />
            )}
          </button>
          <input
            ref={colorInputRef}
            type="color"
            className="invisible absolute size-0"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function CreateVaultDialog({
  trigger,
}: {
  trigger?: React.ReactElement;
} = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [pendingInvites, setPendingInvites] = React.useState<string[]>([]);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = React.useState(false);

  const { mutate: createVault, isPending: isCreatingVault } = useMutation({
    mutationFn: useConvexMutation(api.vaults.create),
  });
  const { mutateAsync: setAccess } = useMutation({
    mutationFn: useConvexMutation(api.shares.setAccess),
  });
  const { mutateAsync: upsertInvite } = useMutation({
    mutationFn: useConvexMutation(api.shares.upsertInvite),
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<VaultFormInput>({
    resolver: valibotResolver(vaultSchema),
    defaultValues: {
      name: "",
      color: DEFAULT_VAULT_COLOR,
      emoji: DEFAULT_VAULT_EMOJI,
      visibility: "private",
    },
  });

  const color = useWatch({ control, name: "color" });
  const emoji = useWatch({ control, name: "emoji" });
  const visibility = useWatch({ control, name: "visibility" });

  function resetAll() {
    reset({
      name: "",
      color: DEFAULT_VAULT_COLOR,
      emoji: DEFAULT_VAULT_EMOJI,
      visibility: "private",
    });
    setPendingInvites([]);
    setInviteEmail("");
    setInviteError(null);
  }

  function addInvite() {
    const trimmed = inviteEmail.trim().toLowerCase();
    if (!trimmed) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setInviteError("Enter a valid email address");
      return;
    }
    if (pendingInvites.includes(trimmed)) {
      setInviteError("Already added");
      return;
    }
    setPendingInvites((prev) => [...prev, trimmed]);
    setInviteEmail("");
    setInviteError(null);
  }

  const onSubmit = handleSubmit(async (values) => {
    createVault(
      { name: values.name, color: values.color, emoji: values.emoji },
      {
        onSuccess: async (vaultId) => {
          if (values.visibility === "public") {
            try {
              await setAccess({ vaultId, isPublic: true });
            } catch {
              // Non-critical
            }
          }

          for (const email of pendingInvites) {
            try {
              await upsertInvite({ vaultId, email, role: "editor" });
            } catch {
              // Best-effort invite
            }
          }

          void queryClient.invalidateQueries(convexQuery(api.vaults.listMine, {}));
          void queryClient.invalidateQueries(convexQuery(api.shares.listReceived, {}));

          setOpen(false);
          resetAll();
          void navigate({
            to: "/vaults/$vaultId",
            params: { vaultId },
          });
        },
      }
    );
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetAll();
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              <Plus className="size-4" />
              New vault
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <form noValidate className="space-y-4" onSubmit={onSubmit}>
          {/* Identity row */}
          <div className="flex items-center gap-2.5">
            <ColorPicker
              value={color ?? DEFAULT_VAULT_COLOR}
              onChange={(c) => setValue("color", c, { shouldValidate: true })}
            />

            <Popover
              open={isEmojiPickerOpen}
              onOpenChange={setIsEmojiPickerOpen}
            >
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 transition-colors hover:border-border"
                  >
                    <VaultIdentity emoji={emoji ?? DEFAULT_VAULT_EMOJI} size="md" />
                  </button>
                }
              />
              <PopoverContent className="w-auto p-0" sideOffset={8}>
                <EmojiPicker
                  className="h-[342px]"
                  onEmojiSelect={({ emoji: selectedEmoji }) => {
                    setValue("emoji", selectedEmoji ?? DEFAULT_VAULT_EMOJI, {
                      shouldValidate: true,
                    });
                    setIsEmojiPickerOpen(false);
                  }}
                >
                  <EmojiPickerSearch />
                  <EmojiPickerContent />
                </EmojiPicker>
              </PopoverContent>
            </Popover>

            <input
              {...register("name")}
              placeholder="Vault name"
              className="min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
          <FieldError errors={[errors.name, errors.color, errors.emoji]} />

          <Separator />

          {/* Visibility */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Visibility</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setValue("visibility", "private", { shouldValidate: true })}
                className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left text-sm transition-colors ${
                  visibility === "private"
                    ? "border-foreground/20 bg-accent"
                    : "border-border hover:border-border/80 hover:bg-accent/50"
                }`}
              >
                <Lock className="size-4 text-muted-foreground" />
                <span className="font-medium">Private</span>
                <span className="text-[11px] leading-tight text-muted-foreground">
                  Only you and invited contributors
                </span>
              </button>
              <button
                type="button"
                onClick={() => setValue("visibility", "public", { shouldValidate: true })}
                className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left text-sm transition-colors ${
                  visibility === "public"
                    ? "border-foreground/20 bg-accent"
                    : "border-border hover:border-border/80 hover:bg-accent/50"
                }`}
              >
                <Globe className="size-4 text-muted-foreground" />
                <span className="font-medium">Public</span>
                <span className="text-[11px] leading-tight text-muted-foreground">
                  Anyone with a link can view
                </span>
              </button>
            </div>
          </div>

          <Separator />

          {/* Contributors */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Contributors
            </p>
            <div className="flex items-start gap-2">
              <Input
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  setInviteError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addInvite();
                  }
                }}
                type="email"
                placeholder="email@example.com"
                className="h-8 flex-1 text-sm"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                onClick={addInvite}
              >
                <Plus className="size-3.5" />
                Add
              </Button>
            </div>
            {inviteError ? (
              <p className="text-xs text-destructive">{inviteError}</p>
            ) : null}
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Contributors can add, edit, and remove links in this vault.
            </p>

            {pendingInvites.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {pendingInvites.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
                  >
                    {email}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() =>
                        setPendingInvites((prev) =>
                          prev.filter((e) => e !== email)
                        )
                      }
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex justify-end pt-1">
            <Button size="sm" loading={isCreatingVault} type="submit">
              Create vault
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
