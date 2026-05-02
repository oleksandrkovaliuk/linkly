import { Lock } from "lucide-react";

import { LoginDialog } from "~/components/login-dialog/login-dialog";
import { Button } from "~/components/ui/button";
import { DialogTrigger } from "~/components/ui/dialog";

type SignInToContinueProps = {
  title?: string;
  description?: string;
};

export function SignInToContinue({
  title = "Sign in to continue",
  description = "You need an account to access this page.",
}: SignInToContinueProps) {
  return (
    <div className="mx-auto flex min-h-[min(60vh,480px)] w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <Lock className="size-8 text-muted-foreground" />
      <div className="space-y-1.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <LoginDialog>
        <DialogTrigger
          render={<Button size="default">Sign in</Button>}
        />
      </LoginDialog>
    </div>
  );
}
