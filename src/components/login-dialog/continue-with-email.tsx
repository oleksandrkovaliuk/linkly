import { useSignIn, useSignUp } from "@clerk/clerk-react";
import { isClerkAPIResponseError } from "@clerk/shared/error";
import type { EmailCodeFactor } from "@clerk/shared/types";
import { valibotResolver } from "@hookform/resolvers/valibot";
import { Button } from "~/components/ui/button";
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "~/components/ui/field";
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

const schema = v.object({
  email: v.pipe(
    v.string("Please enter an email address"),
    v.nonEmpty("Please enter an email address"),
    v.email("Please enter a valid email address")
  ),
});

type TContinueWithEmailForm = v.InferOutput<typeof schema>;

export function ContinueWithEmail({
  pending,
  setStep,
  setFlow,
  setError,
  setPending,
}: {
  setStep: React.Dispatch<React.SetStateAction<TAuthStep>>;
  setFlow: React.Dispatch<React.SetStateAction<TAuthFlow>>;
  setError: React.Dispatch<React.SetStateAction<TAuthError>>;
  pending: TAuthStrategy;
  setPending: React.Dispatch<React.SetStateAction<TAuthStrategy>>;
}) {
  const { signUp } = useSignUp();
  const { isLoaded, signIn, setActive } = useSignIn();

  const form = useForm<TContinueWithEmailForm>({
    mode: "onSubmit",
    resolver: valibotResolver(schema),
    defaultValues: {
      email: "",
    },
  });

  async function attemptSignUp(email: string) {
    if (!isLoaded) return;

    setPending("email");

    await signUp?.create({
      emailAddress: email,
    });

    await signUp?.prepareEmailAddressVerification({
      strategy: "email_code",
    });

    setStep("code");
    setFlow("sign-up");
    setPending(null);
  }

  async function attemptSignIn(email: string) {
    if (!isLoaded) return;

    setPending("email");

    const signInAttempt = await signIn.create({
      identifier: email,
    });

    switch (signInAttempt.status) {
      case "complete": {
        await setActive({
          session: signInAttempt.createdSessionId,
        });

        break;
      }
      case "needs_first_factor": {
        const emailCodeFactor = signInAttempt.supportedFirstFactors?.find(
          (factor): factor is EmailCodeFactor =>
            factor.strategy === "email_code"
        );

        if (emailCodeFactor) {
          await signIn.prepareFirstFactor({
            strategy: "email_code",
            emailAddressId: emailCodeFactor.emailAddressId,
          });

          setStep("code");
          setFlow("sign-in-needs-first-factor");
        }

        break;
      }
      case "needs_second_factor": {
        const emailCodeFactor = signInAttempt.supportedSecondFactors?.find(
          (factor): factor is EmailCodeFactor =>
            factor.strategy === "email_code"
        );

        if (emailCodeFactor) {
          await signIn.prepareSecondFactor({
            strategy: "email_code",
            emailAddressId: emailCodeFactor.emailAddressId,
          });

          setStep("code");
          setFlow("sign-in-needs-second-factor");
        }

        break;
      }
    }

    setPending(null);
  }

  async function onSubmit(data: TContinueWithEmailForm) {
    setPending("email");

    const [signInAttemptError] = await tryCatch(attemptSignIn(data.email));

    if (!isClerkAPIResponseError(signInAttemptError)) {
      setError({
        longMessage:
          "We couldn't perform the action you requested. Please review the information you provided and try again.",
        shortMessage: "Something went wrong",
      });

      setPending(null);
      return;
    }

    switch (signInAttemptError.errors[0].code) {
      case "form_identifier_not_found": {
        const [signUpError] = await tryCatch(attemptSignUp(data.email));

        if (signUpError) {
          setError(() => {
            if (isClerkAPIResponseError(signUpError)) {
              return {
                longMessage: signUpError.errors[0].longMessage ?? "",
                shortMessage: signUpError.errors[0].message,
              };
            }

            return {
              longMessage:
                "We couldn't perform the action you requested. Please review the information you provided and try again.",
              shortMessage: "Something went wrong",
            };
          });

          setPending(null);
          break;
        }

        break;
      }
      default: {
        setError({
          longMessage: signInAttemptError.errors[0].longMessage ?? "",
          shortMessage: signInAttemptError.errors[0].message,
        });
        setPending(null);
        return;
      }
    }
  }

  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex w-full flex-col items-center"
      >
        <Controller
          name="email"
          control={form.control}
          render={({ field, formState }) => (
            <Field data-invalid={!!formState.errors.email} className="mb-5">
              <FieldLabel className="sr-only">Email</FieldLabel>

              <FieldContent>
                <Input
                  {...field}
                  autoFocus
                  type="email"
                  autoCorrect="off"
                  inputMode="email"
                  spellCheck="false"
                  disabled={pending === "email"}
                  aria-busy={pending === "email"}
                  autoComplete="email"
                  autoCapitalize="none"
                  className="text-center"
                  contentEditable={false}
                  aria-label="Your email..."
                  placeholder="Your email..."
                  onChange={(e) => {
                    setError(null);
                    field.onChange(e);
                  }}
                  aria-invalid={!!formState.errors.email}
                />
              </FieldContent>

              <FieldError errors={[formState.errors.email]} />
            </Field>
          )}
        />

        <Button
          size="lg"
          type="submit"
          loaderVariant="stars"
          className="mb-1 w-full"
          loading={pending === "email"}
          loadingPlaceholder="Checking your email..."
        >
          Continue with email
        </Button>

        <Button
          size="lg"
          type="button"
          variant="link"
          className="w-full"
          onClick={() => {
            setStep("initial");
          }}
        >
          Back to login
        </Button>
      </form>
    </FormProvider>
  );
}
