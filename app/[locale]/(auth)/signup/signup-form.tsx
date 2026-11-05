"use client";

import { useRouter } from "next/navigation";
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

export function SignupForm({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary["auth"];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setError(null);

    if (!name) return setError(t.errors.nameRequired);
    if (password.length < MIN_PASSWORD_LENGTH)
      return setError(t.errors.passwordTooShort);

    startTransition(async () => {
      const { error } = await authClient.signUp.email({
        name,
        email: String(form.get("email") ?? "").trim(),
        password,
        locale,
        // After the email link is opened, continue to two-step setup.
        callbackURL: `/${locale}/setup-2fa`,
      });

      if (error) {
        const kind = authErrorKind(error);
        setError(
          kind === "conflict"
            ? t.signup.emailTaken
            : kind === "tooManyRequests"
              ? t.errors.tooManyRequests
              : error.status === 400
                ? t.errors.invalidEmail
                : t.errors.generic,
        );
        return;
      }
      router.push(`/${locale}/verify-email`);
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <FormMessage message={error} />
        <Field>
          <FieldLabel htmlFor="name">{t.name}</FieldLabel>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            maxLength={100}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">{t.email}</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            dir="ltr"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">{t.password}</FieldLabel>
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
          {t.signup.submit}
        </Button>
      </FieldGroup>
    </form>
  );
}
