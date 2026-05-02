import {
  AuthenticateWithRedirectCallback,
  useClerk,
  useSignIn,
} from "@clerk/clerk-react";
import { isClerkAPIResponseError } from "@clerk/shared/error";
import type { OAuthStrategy } from "@clerk/shared/types";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  createDialogHandle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { tryCatch } from "~/lib/try-catch";
import { InfoIcon } from "lucide-react";
import { AnimatePresence, motion, type MotionProps } from "motion/react";
import * as React from "react";

import { Loader } from "../icons/loader";
import { ContinueWithEmail } from "./continue-with-email";
import type {
  TAuthError,
  TAuthFlow,
  TAuthStep,
  TAuthStrategy,
} from "./lib/types";
import { VerifyEmailCode } from "./verify-email-code";

const loginDialogHandle = createDialogHandle();

const sharedMotionProps = {
  initial: { scale: 0.98, opacity: 0 },
  exit: { scale: 0.98, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { duration: 0.15, ease: "easeOut" },
} satisfies MotionProps;

const providers = [
  {
    strategy: "email",
    label: "Continue with Email",
  },
  {
    strategy: "oauth_google",
    label: "Continue with Google",
  },
] as const;

export function LoginDialog({
  children,
  defaultStep = "initial",
  ...props
}: React.ComponentProps<typeof Dialog> & {
  children?: React.ReactNode;
  defaultStep?: TAuthStep;
}) {
  const { client } = useClerk();
  const { isLoaded, signIn } = useSignIn();

  const [flow, setFlow] = React.useState<TAuthFlow>(null);
  const [step, setStep] = React.useState<TAuthStep>(defaultStep);
  const [error, setError] = React.useState<TAuthError>(null);
  const [pending, setPending] = React.useState<TAuthStrategy>(null);

  const lastUsedProviders = providers.find(
    (provider) => provider.strategy === client?.lastAuthenticationStrategy
  );
  const otherProviders = providers.filter(
    (provider) => provider.strategy !== client?.lastAuthenticationStrategy
  );

  async function onAuthenticateWithRedirect(strategy: OAuthStrategy) {
    if (!isLoaded) return;

    const [signInWithRedirectError] = await tryCatch(
      signIn?.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sso",
        redirectUrlComplete: "/",
      })
    );

    if (signInWithRedirectError) {
      setError(() => {
        if (isClerkAPIResponseError(signInWithRedirectError)) {
          return {
            longMessage: signInWithRedirectError.longMessage ?? "",
            shortMessage: signInWithRedirectError.message,
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

  function onContinueWithProvider(strategy: TAuthStrategy) {
    if (!strategy) return;

    switch (strategy) {
      case "email_code":
      case "email": {
        setStep("email");

        break;
      }

      default: {
        void onAuthenticateWithRedirect(strategy);

        break;
      }
    }

    setPending(null);
  }

  function onOpenChange(open: boolean) {
    if (open) {
      setStep(defaultStep);
      setError(null);
      setPending(null);
      setFlow(null);
    }
  }

  return (
    <Dialog
      handle={loginDialogHandle}
      onOpenChange={onOpenChange}
      defaultOpen={defaultStep === "sso"}
      disablePointerDismissal={defaultStep === "sso"}
      {...props}
    >
      {children}
      <DialogContent
        className="max-h-max items-center transition-[height]"
        showCloseButton={defaultStep !== "sso"}
      >
        <AnimatePresence mode="wait">
          {step === "sso" && (
            <motion.div key="sso" {...sharedMotionProps}>
              <DialogHeader>
                <DialogTitle className="text-center text-lg">
                  Authenticating
                </DialogTitle>

                <span className="animate-spin">
                  <Loader className="mx-auto size-7.5" />
                </span>
              </DialogHeader>

              <DialogDescription className="sr-only">
                We're gathering some information to authenticate you..
              </DialogDescription>

              <AuthenticateWithRedirectCallback
                signInForceRedirectUrl="/"
                signUpForceRedirectUrl="/"
              />

              <div id="clerk-captcha" />
            </motion.div>
          )}

          {step === "initial" && (
            <motion.div key="initial" {...sharedMotionProps}>
              <DialogHeader className="mb-5">
                <DialogTitle className="text-center text-lg">
                  Welcome to Link Vault
                </DialogTitle>
              </DialogHeader>

              {error ? (
                <Alert variant="destructive" className="mb-5">
                  <InfoIcon />
                  {error.shortMessage ? (
                    <AlertTitle>{error.shortMessage}</AlertTitle>
                  ) : null}

                  {error.longMessage ? (
                    <AlertDescription>{error.longMessage}</AlertDescription>
                  ) : null}
                </Alert>
              ) : null}

              <div className="flex flex-col space-y-1">
                {lastUsedProviders && (
                  <Button
                    size="lg"
                    loaderVariant="stars"
                    className="relative w-full"
                    loadingPlaceholder="Redirecting..."
                    loading={pending === lastUsedProviders.strategy}
                    onPointerDown={() => {
                      onContinueWithProvider(lastUsedProviders.strategy);
                    }}
                  >
                    {lastUsedProviders.label}
                    <Badge
                      variant="secondary"
                      className="absolute top-0 right-0 translate-x-2 -translate-y-1/2"
                    >
                      Last used
                    </Badge>
                  </Button>
                )}

                {otherProviders.map((provider) => (
                  <Button
                    size="lg"
                    className="w-full"
                    variant="secondary"
                    loaderVariant="stars"
                    loadingPlaceholder="Redirecting..."
                    loading={pending === provider.strategy}
                    onClick={() => {
                      onContinueWithProvider(provider.strategy);
                    }}
                  >
                    {provider.label}
                  </Button>
                ))}
              </div>

              <div id="clerk-captcha" />
            </motion.div>
          )}

          {step === "email" && (
            <motion.div key="email" {...sharedMotionProps}>
              <DialogHeader>
                <DialogTitle className="text-center text-lg">
                  What's your email?
                </DialogTitle>
              </DialogHeader>

              <DialogDescription className="mb-5 text-center text-sm">
                We'll send you a code to verify your email.
              </DialogDescription>

              {error ? (
                <Alert variant="destructive" className="mb-5">
                  <InfoIcon />
                  {error.shortMessage ? (
                    <AlertTitle>{error.shortMessage}</AlertTitle>
                  ) : null}

                  {error.longMessage ? (
                    <AlertDescription>{error.longMessage}</AlertDescription>
                  ) : null}
                </Alert>
              ) : null}

              <div id="clerk-captcha" />

              <ContinueWithEmail
                setStep={setStep}
                setFlow={setFlow}
                setError={setError}
                pending={pending}
                setPending={setPending}
              />
            </motion.div>
          )}

          {step === "code" && (
            <motion.div key="code" {...sharedMotionProps}>
              <DialogHeader>
                <DialogTitle className="text-center text-lg">
                  Verify your email
                </DialogTitle>
              </DialogHeader>

              <DialogDescription className="mb-5 text-center text-sm">
                Now just enter the code we sent to your email.
              </DialogDescription>

              {error ? (
                <Alert variant="destructive" className="mb-5">
                  <InfoIcon />
                  {error.shortMessage ? (
                    <AlertTitle>{error.shortMessage}</AlertTitle>
                  ) : null}

                  {error.longMessage ? (
                    <AlertDescription>{error.longMessage}</AlertDescription>
                  ) : null}
                </Alert>
              ) : null}

              <div id="clerk-captcha" />

              <VerifyEmailCode
                flow={flow}
                setStep={setStep}
                pending={pending}
                setError={setError}
                setPending={setPending}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

export { loginDialogHandle };
