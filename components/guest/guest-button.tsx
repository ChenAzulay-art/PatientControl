"use client";

import { LoaderCircle, UserRound } from "lucide-react";
import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  type GuestState,
  startGuestSession,
} from "@/app/[locale]/(auth)/guest/actions";

/** "Try it as a guest": opens a fresh demo clinic, no sign-up. */
export function GuestButton({
  locale,
  t,
  size = "default",
  showHint = true,
}: {
  locale: Locale;
  t: Dictionary["guest"];
  size?: "default" | "lg";
  showHint?: boolean;
}) {
  const [state, formAction, pending] = useActionState<GuestState, FormData>(
    startGuestSession,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="locale" value={locale} />
      <FormMessage message={state.error ? t.errors[state.error] : null} />
      <div>
        <Button
          type="submit"
          variant="secondary"
          size={size}
          disabled={pending}
        >
          {pending ? (
            <LoaderCircle className="animate-spin" aria-hidden />
          ) : (
            <UserRound aria-hidden />
          )}
          {pending ? t.starting : t.try}
        </Button>
      </div>
      {showHint ? (
        <p className="text-sm text-muted-foreground">{t.tryHint}</p>
      ) : null}
    </form>
  );
}
