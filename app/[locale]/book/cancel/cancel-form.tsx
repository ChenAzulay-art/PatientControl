"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cancelAction, type CancelState } from "./actions";

export function CancelForm({
  locale,
  t,
  token,
  slug,
}: {
  locale: Locale;
  t: Dictionary["booking"]["cancel"];
  token: string;
  slug: string;
}) {
  const [state, formAction, pending] = useActionState<CancelState, FormData>(
    cancelAction,
    {},
  );

  if (state.result === "cancelled") {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="success" message={t.cancelled} />
        <Link
          href={`/${locale}/book/${slug}`}
          className="text-sm font-medium underline underline-offset-4"
        >
          {t.bookAgain}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <FormMessage
        message={
          state.result === "notCancellable"
            ? t.notCancellable
            : state.result === "invalid"
              ? t.invalid
              : null
        }
      />
      <div>
        <Button type="submit" variant="destructive" disabled={pending}>
          {t.confirm}
        </Button>
      </div>
    </form>
  );
}
