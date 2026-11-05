"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient, authErrorKind } from "@/lib/auth-client";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation/auth";

export function ResetPasswordForm({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary["auth"];
}) {
  const params = useSearchParams();
  const token = params.get("token");
  const linkError = params.get("error");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loginLink = (
    <Link
      href={`/${locale}/login`}
      className="font-medium underline-offset-4 hover:underline"
    >
      {t.signup.logInLink}
    </Link>
  );

  if (!token || linkError) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage message={t.reset.invalidToken} />
        <Link
          href={`/${locale}/forgot-password`}
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          {t.forgot.submit}
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="success" message={t.reset.success} />
        {loginLink}
      </div>
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const newPassword = String(
      new FormData(event.currentTarget).get("password") ?? "",
    );
    setError(null);
    if (newPassword.length < MIN_PASSWORD_LENGTH)
      return setError(t.errors.passwordTooShort);

    startTransition(async () => {
      const { error } = await authClient.resetPassword({
        newPassword,
        token: token!,
      });
      if (error) {
        const kind = authErrorKind(error);
        setError(
          kind === "tooManyRequests"
            ? t.errors.tooManyRequests
            : t.reset.invalidToken,
        );
        return;
      }
      setDone(true);
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <FormMessage message={error} />
        <Field>
          <FieldLabel htmlFor="password">{t.reset.newPassword}</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={128}
            required
            aria-describedby="password-hint"
          />
          <FieldDescription id="password-hint">
            {t.signup.passwordHint}
          </FieldDescription>
        </Field>
        <Button type="submit" disabled={pending}>
          {t.reset.submit}
        </Button>
      </FieldGroup>
    </form>
  );
}
