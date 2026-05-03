import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { valibotResolver } from "@hookform/resolvers/valibot";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  DEFAULT_VAULT_COLOR,
  DEFAULT_VAULT_EMOJI,
  PRESET_COLORS,
} from "~/components/create-vault-dialog";
import { SettingsLoadingState } from "~/components/page-skeletons";
import { Button } from "~/components/ui/button";
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerSearch,
} from "~/components/ui/emoji-picker";
import { FieldError } from "~/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { VaultIdentity } from "~/components/vault-identity";
import { api } from "~/convex/_generated/api";
import type { Id } from "~/convex/_generated/dataModel";
import { useAuth } from "~/hooks/use-auth";
import { Check, Pipette } from "lucide-react";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import * as v from "valibot";

export const Route = createFileRoute("/vaults_/$vaultId/settings/appearance")({
  component: AppearanceSettings,
});

const appearanceSchema = v.object({
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
});

type AppearanceInput = v.InferInput<typeof appearanceSchema>;

function AppearanceSettings() {
  const auth = useAuth();
  const { vaultId } = Route.useParams();
  const typedVaultId = vaultId as Id<"vaults">;
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = React.useState(false);
  const colorInputRef = React.useRef<HTMLInputElement>(null);

  const { data: vaultData, isPending: isVaultPending } = useQuery({
    enabled: auth.canQueryProtected,
    ...convexQuery(api.vaults.get, { vaultId: typedVaultId }),
  });

  const vault = vaultData as
    | { _id: Id<"vaults">; name: string; color?: string; emoji?: string }
    | undefined;

  const { mutate: updateVault, isPending: isUpdating } = useMutation({
    mutationFn: useConvexMutation(api.vaults.update),
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isDirty },
  } = useForm<AppearanceInput>({
    resolver: valibotResolver(appearanceSchema),
    defaultValues: {
      name: vault?.name ?? "",
      color: vault?.color ?? DEFAULT_VAULT_COLOR,
      emoji: vault?.emoji ?? DEFAULT_VAULT_EMOJI,
    },
  });

  const color = useWatch({ control, name: "color" });
  const emoji = useWatch({ control, name: "emoji" });

  React.useEffect(() => {
    if (!vault) return;
    reset({
      name: vault.name,
      color: vault.color ?? DEFAULT_VAULT_COLOR,
      emoji: vault.emoji ?? DEFAULT_VAULT_EMOJI,
    });
  }, [vault?._id, vault?.name, vault?.color, vault?.emoji, reset]);

  const onSubmit = handleSubmit((values) => {
    updateVault(
      {
        vaultId: typedVaultId,
        name: values.name,
        color: values.color,
        emoji: values.emoji,
      },
      {
        onSuccess: () => toast.success("Appearance updated"),
        onError: (error) => toast.error(error.message),
      }
    );
  });

  if (isVaultPending) {
    return <SettingsLoadingState />;
  }

  const isCustomColor = !PRESET_COLORS.includes(color ?? DEFAULT_VAULT_COLOR);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="text-sm text-muted-foreground">
          Customize how this vault shows up for every member.
        </p>
      </div>

      <form noValidate className="space-y-6" onSubmit={onSubmit}>
        <div className="space-y-3">
          <label className="text-sm font-medium">Identity</label>
          <div className="flex items-center gap-3">
            <Popover
              open={isEmojiPickerOpen}
              onOpenChange={setIsEmojiPickerOpen}
            >
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 transition-colors hover:border-border"
                  >
                    <VaultIdentity
                      emoji={emoji ?? DEFAULT_VAULT_EMOJI}
                      size="md"
                    />
                  </button>
                }
              />
              <PopoverContent className="w-auto p-0" sideOffset={8}>
                <EmojiPicker
                  className="h-[342px]"
                  onEmojiSelect={({ emoji: selectedEmoji }) => {
                    setValue(
                      "emoji",
                      selectedEmoji ?? DEFAULT_VAULT_EMOJI,
                      { shouldValidate: true, shouldDirty: true }
                    );
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
              className="min-w-0 flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/20"
              placeholder="Vault name"
            />
          </div>
          <FieldError errors={[errors.name, errors.emoji]} />
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium">Accent color</label>
          <div className="flex items-center gap-2">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="relative flex size-7 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110"
                style={{ backgroundColor: preset }}
                onClick={() =>
                  setValue("color", preset, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              >
                {color === preset ? (
                  <Check className="size-3.5 text-white drop-shadow-sm" />
                ) : null}
              </button>
            ))}
            <button
              type="button"
              className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-border/60 transition-transform hover:scale-110"
              style={
                isCustomColor
                  ? { backgroundColor: color ?? DEFAULT_VAULT_COLOR }
                  : {
                      background:
                        "conic-gradient(#ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #ef4444)",
                    }
              }
              onClick={() => colorInputRef.current?.click()}
            >
              {isCustomColor ? (
                <Check className="size-3.5 text-white drop-shadow-sm" />
              ) : (
                <Pipette className="size-3 text-white drop-shadow-sm" />
              )}
            </button>
            <input
              ref={colorInputRef}
              type="color"
              className="invisible absolute size-0"
              value={color ?? DEFAULT_VAULT_COLOR}
              onChange={(event) =>
                setValue("color", event.target.value, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            />
          </div>
          <FieldError errors={[errors.color]} />
        </div>

        <div className="flex justify-end border-t border-border/50 pt-4">
          <Button
            size="sm"
            type="submit"
            loading={isUpdating}
            disabled={!isDirty}
          >
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}
