import type { OAuthStrategy } from "@clerk/shared/types";

type TAuthStep = "initial" | "email" | "code" | "sso" | null;
type TAuthFlow =
  | "sign-in-needs-first-factor"
  | "sign-in-needs-second-factor"
  | "sign-up"
  | null;

type TAuthError = {
  longMessage: string;
  shortMessage: string;
} | null;

type TAuthStrategy = OAuthStrategy | "email" | "email_code" | null;

export type { TAuthStep, TAuthError, TAuthFlow, TAuthStrategy };
