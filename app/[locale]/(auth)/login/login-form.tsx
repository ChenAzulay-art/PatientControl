"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient, authErrorKind } from "@/lib/auth-client";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function LoginForm({
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
    setError(null);

    startTransition(async () => {
      const { data, error } = await authClient.signIn.email({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      });

      if (error) {
        const kind = authErrorKind(error);
        setError(
          kind === "unauthorized"
            ? t.login.invalidCredentials
            : kind === "forbidden"
              ? t.login.emailNotVerified
              : kind === "tooManyRequests"
                ? t.errors.tooManyRequests
                : t.errors.generic,
        );
        return;
      }

      if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
        router.push(`/${locale}/two-factor`);
        return;
      }
      // The dashboard sends new users on to two-step setup and onboarding.
      router.push(`/${locale}/dashboard`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate={false}>
      <FieldGroup>
        <FormMessage message={error} />
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
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor="password">{t.password}</FieldLabel>
            <Link
              href={`/${locale}/forgot-password`}
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              {t.login.forgotPassword}
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <Button type="submit" disabled={pending}>
          {t.login.submit}
        </Button>
      </FieldGroup>
    </form>
  );
}
