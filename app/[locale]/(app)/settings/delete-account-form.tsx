"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import { type DeleteAccountState, deleteAccount } from "./actions";

export function DeleteAccountForm({
  locale,
  t,
  slug,
}: {
  locale: Locale;
  t: Dictionary["deleteAccount"];
  slug: string;
}) {
  const [state, formAction, pending] = useActionState<
    DeleteAccountState,
    FormData
  >(deleteAccount, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <label className="flex flex-col gap-1.5 text-sm sm:max-w-xs">
        <span className="font-medium">{format(t.confirmLabel, { slug })}</span>
        <Input
          name="confirm"
          dir="ltr"
          autoComplete="off"
          spellCheck={false}
          required
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm sm:max-w-xs">
        <span className="font-medium">{t.password}</span>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          dir="ltr"
          required
          maxLength={128}
        />
      </label>
      <FormMessage message={state.error ? t.errors[state.error] : null} />
      <div>
        <Button type="submit" variant="destructive" disabled={pending}>
          {t.submit}
        </Button>
      </div>
    </form>
  );
}
