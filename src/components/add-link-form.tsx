import { useConvexMutation } from "@convex-dev/react-query";
import { valibotResolver } from "@hookform/resolvers/valibot";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { api } from "~/convex/_generated/api";
import type { Id } from "~/convex/_generated/dataModel";
import * as React from "react";
import * as v from "valibot";

import { Button } from "./ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "./ui/field";
import { Input } from "./ui/input";

type AddLinkFormProps =
  | {
      mode: "vault";
      vaultId: Id<"vaults">;
      className?: string;
    }
  | {
      mode: "shared";
      shareId: Id<"shares">;
      className?: string;
    };

const addLinkSchema = v.object({
  url: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty("URL is required"),
    v.url("Provide a valid URL including protocol (https://...)")
  ),
});

type AddLinkInput = v.InferInput<typeof addLinkSchema>;

export function AddLinkForm(props: AddLinkFormProps) {
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const { mutate: addToVault, isPending: isAddingVault } = useMutation({
    mutationFn: useConvexMutation(api.links.create),
  });

  const { mutate: addToShare, isPending: isAddingShare } = useMutation({
    mutationFn: useConvexMutation(api.sharedVaultLinks.add),
  });

  const isPending = isAddingVault || isAddingShare;

  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<AddLinkInput>({
    resolver: valibotResolver(addLinkSchema),
    defaultValues: {
      url: "",
    },
  });

  const onSubmit = handleSubmit(({ url }) => {
    setSubmitError(null);

    if (props.mode === "vault") {
      addToVault(
        { vaultId: props.vaultId, url },
        {
          onSuccess: () => reset(),
          onError: (error) => setSubmitError(error.message),
        }
      );
      return;
    }

    addToShare(
      { shareId: props.shareId, url },
      {
        onSuccess: () => reset(),
        onError: (error) => setSubmitError(error.message),
      }
    );
  });

  return (
    <form noValidate onSubmit={onSubmit} className={props.className}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <FieldGroup className="w-full">
          <Field>
            <FieldLabel htmlFor="add-link-url" className="sr-only">
              URL
            </FieldLabel>
            <Input
              id="add-link-url"
              type="url"
              placeholder={props.mode === "vault" ? "Paste a link..." : "Add a link..."}
              aria-invalid={Boolean(errors.url)}
              className="h-9"
              {...register("url")}
            />
            <FieldError errors={[errors.url]} />
            <FieldError>{submitError}</FieldError>
          </Field>
        </FieldGroup>
        <Button
          type="submit"
          className="sm:w-auto"
          loading={isPending}
          loadingPlaceholder="Adding..."
        >
          Add Link
        </Button>
      </div>
    </form>
  );
}
