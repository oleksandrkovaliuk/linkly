import { useSignIn, useSignUp } from "@clerk/clerk-react";
import { isClerkAPIResponseError } from "@clerk/shared/error";
import { valibotResolver } from "@hookform/resolvers/valibot";
import { Button } from "~/components/ui/button";
import { Field, FieldContent, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { tryCatch } from "~/lib/try-catch";
import * as React from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import * as v from "valibot";

import type {
  TAuthError,
  TAuthFlow,
  TAuthStep,
  TAuthStrategy,
} from "./lib/types";

const verifyEmailCodeSchema = v.object({
  code: v.pipe(
    v.string("Please enter a code"),
    v.nonEmpty("Please enter a code"),
    v.length(6, "Please enter a valid code")
  ),
});

type TVerifyEmailCodeForm = v.InferOutput<typeof verifyEmailCodeSchema>;

export function VerifyEmailCode({
  flow,
  pending,
  setStep,
  setError,
  setPending,
}: {
  flow: TAuthFlow;
  pending: TAuthStrategy;
  setStep: React.Dispatch<React.SetStateAction<TAuthStep>>;
  setError: React.Dispatch<React.SetStateAction<TAuthError>>;
  setPending: React.Dispatch<React.SetStateAction<TAuthStrategy>>;
}) {
  const { signUp } = useSignUp();
  const { isLoaded, signIn, setActive } = useSignIn();

  const form = useForm<TVerifyEmailCodeForm>({
    mode: "onSubmit",
    resolver: valibotResolver(verifyEmailCodeSchema),
    defaultValues: {
      code: "",
    },
  });

  async function attemptSignIn(code: string) {
    if (!isLoaded) return;

    setPending("email_code");

    const signInAttemptPormise =
      flow === "sign-in-needs-first-factor"
        ? signIn.attemptFirstFactor({
            strategy: "email_code",
            code,
          })
        : signIn.attemptSecondFactor({
            strategy: "email_code",
            code,
          });

    const signInAttempt = await signInAttemptPormise;

    switch (signInAttempt.status) {
      case "complete": {
        await setActive({
          session: signInAttempt.createdSessionId,
        });

        break;
      }
    }
  }

  async function attemptSignUp(code: string) {
    if (!isLoaded || !signUp) return;

    setPending("email_code");

    const signUpAttempt = await signUp.attemptEmailAddressVerification({
      code,
    });

    switch (signUpAttempt.status) {
      case "complete": {
        await setActive({
          session: signUpAttempt.createdSessionId,
        });

        break;
      }
    }
  }

  async function onSubmit(data: TVerifyEmailCodeForm) {
    if (!isLoaded) return;

    setPending("email_code");

    const signInOrUpAttemptPromise =
      flow === "sign-up" ? attemptSignUp(data.code) : attemptSignIn(data.code);

    const [signInOrUpAttemptError] = await tryCatch(signInOrUpAttemptPromise);

    if (signInOrUpAttemptError) {
      setError(() => {
        if (isClerkAPIResponseError(signInOrUpAttemptError)) {
          return {
            longMessage: signInOrUpAttemptError.errors[0].longMessage ?? "",
            shortMessage: signInOrUpAttemptError.errors[0].message,
          };
        }

        return {
          longMessage:
            "We couldn't perform the action you requested. Please review the information you provided and try again.",
          shortMessage: "Something went wrong",
        };
      });

      setPending(null);
      return;
    }
  }

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex w-full flex-col items-center"
      >
        <Controller
          name="code"
          control={form.control}
          render={({ field, formState }) => (
            <Field data-invalid={!!formState.errors.code} className="mb-5">
              <FieldLabel className="sr-only">Code</FieldLabel>

              <FieldContent>
                <Input
                  {...field}
                  autoFocus
                  type="text"
                  maxLength={6}
                  autoCorrect="off"
                  spellCheck="false"
                  inputMode="numeric"
                  disabled={pending === "email_code"}
                  aria-busy={pending === "email_code"}
                  autoCapitalize="none"
                  contentEditable={false}
                  onChange={(e) => {
                    field.onChange(e);
                    setError(null);
                  }}
                  className="text-center"
                  aria-label="Your code..."
                  placeholder="Your code..."
                  autoComplete="one-time-code"
                  aria-invalid={!!formState.errors.code}
                />
              </FieldContent>
            </Field>
          )}
        />

        <Button
          size="lg"
          type="submit"
          className="mb-1 w-full"
          loaderVariant="ping-pong"
          loading={pending === "email_code"}
          loadingPlaceholder="Verifying code..."
        >
          Verify code
        </Button>

        <Button
          size="lg"
          type="button"
          variant="link"
          className="w-full"
          onClick={() => { setStep("initial"); }}
        >
          Back to login
        </Button>
      </form>
    </FormProvider>
  );
}
