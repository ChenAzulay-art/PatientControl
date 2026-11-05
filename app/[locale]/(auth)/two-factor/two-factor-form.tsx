"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { FormMessage } from "@/components/form-message";
import { OtpField } from "@/components/otp-field";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient, authErrorKind } from "@/lib/auth-client";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function TwoFactorForm({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary["auth"];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const trustDevice = form.get("trustDevice") === "on";
    const value =
      mode === "totp" ? code : String(form.get("backupCode") ?? "").trim();
    setError(null);

    startTransition(async () => {
      const { error } =
        mode === "totp"
          ? await authClient.twoFactor.verifyTotp({ code: value, trustDevice })
          : await authClient.twoFactor.verifyBackupCode({
              code: value,
              trustDevice,
            });

      if (error) {
        if (error.code === "INVALID_TWO_FACTOR_COOKIE") {
          setExpired(true);
          return;
        }
        setCode("");
        setError(
          authErrorKind(error) === "tooManyRequests"
            ? t.errors.tooManyRequests
            : t.twoFactor.invalidCode,
        );
        return;
      }
      router.push(`/${locale}/dashboard`);
      router.refresh();
    });
  }

  if (expired) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage message={t.twoFactor.sessionExpired} />
        <Link
          href={`/${locale}/login`}
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          {t.login.title}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <FormMessage message={error} />
        {mode === "totp" ? (
          <Field>
            <FieldLabel htmlFor="code" className="sr-only">
              {t.twoFactor.code}
            </FieldLabel>
            <OtpField
              id="code"
              value={code}
              onChange={setCode}
              label={t.twoFactor.code}
              resetKey={error}
            />
          </Field>
        ) : (
          <Field>
            <FieldLabel htmlFor="backupCode">
              {t.twoFactor.backupCode}
            </FieldLabel>
            <Input
              id="backupCode"
              name="backupCode"
              autoComplete="off"
              dir="ltr"
              required
              autoFocus
            />
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="trustDevice"
            className="size-4 accent-primary"
          />
          {t.twoFactor.trustDevice}
        </label>
        <Button
          type="submit"
          disabled={pending || (mode === "totp" && code.length !== 6)}
        >
          {t.twoFactor.submit}
        </Button>
        <Button
          type="button"
          variant="link"
          onClick={() => {
            setError(null);
            setMode(mode === "totp" ? "backup" : "totp");
          }}
        >
          {mode === "totp"
            ? t.twoFactor.useBackupCode
            : t.twoFactor.useAuthenticator}
        </Button>
      </FieldGroup>
    </form>
  );
}
