"use client";

import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useState, useTransition, type FormEvent } from "react";
import { FormMessage } from "@/components/form-message";
import { OtpField } from "@/components/otp-field";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient, authErrorKind } from "@/lib/auth-client";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Step =
  | { name: "password" }
  | { name: "scan"; qr: string; secret: string; backupCodes: string[] }
  | { name: "backup"; backupCodes: string[] };

export function SetupTwoFactorForm({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary["auth"];
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ name: "password" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function errorText(e: { status: number; code?: string }, fallback: string) {
    return authErrorKind(e) === "tooManyRequests"
      ? t.errors.tooManyRequests
      : fallback;
  }

  function onPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(
      new FormData(event.currentTarget).get("password") ?? "",
    );
    setError(null);

    startTransition(async () => {
      const { data, error } = await authClient.twoFactor.enable({ password });
      if (error || !data || data.method !== "totp") {
        setError(
          error ? errorText(error, t.errors.invalidPassword) : t.errors.generic,
        );
        return;
      }
      // The QR code is drawn in the browser, so the secret never passes through another service.
      const qr = await QRCode.toDataURL(data.totpURI, {
        margin: 1,
        width: 224,
      });
      const secret = new URL(data.totpURI).searchParams.get("secret") ?? "";
      setStep({ name: "scan", qr, secret, backupCodes: data.backupCodes });
    });
  }

  function onVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step.name !== "scan") return;
    setError(null);

    startTransition(async () => {
      const { error } = await authClient.twoFactor.verifyTotp({ code });
      if (error) {
        setCode("");
        setError(errorText(error, t.twoFactor.invalidCode));
        return;
      }
      setStep({ name: "backup", backupCodes: step.backupCodes });
    });
  }

  if (step.name === "password") {
    return (
      <form onSubmit={onPassword}>
        <FieldGroup>
          <FormMessage message={error} />
          <Field>
            <FieldLabel htmlFor="password">
              {t.setup2fa.confirmPassword}
            </FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <Button type="submit" disabled={pending}>
            {t.setup2fa.start}
          </Button>
        </FieldGroup>
      </form>
    );
  }

  if (step.name === "scan") {
    return (
      <form onSubmit={onVerify}>
        <FieldGroup>
          <FormMessage message={error} />
          <p className="text-sm">{t.setup2fa.scan}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- a generated data URL */}
          <img
            src={step.qr}
            alt=""
            width={224}
            height={224}
            className="mx-auto rounded-md border bg-white"
          />
          <div className="text-sm text-muted-foreground">
            <p>{t.setup2fa.manualKey}</p>
            <code
              dir="ltr"
              className="mt-1 block rounded-md bg-muted px-2 py-1.5 font-mono text-xs break-all text-foreground"
            >
              {step.secret}
            </code>
          </div>
          <Field>
            <FieldLabel htmlFor="code">{t.setup2fa.enterCode}</FieldLabel>
            <OtpField
              id="code"
              value={code}
              onChange={setCode}
              label={t.twoFactor.code}
              resetKey={error}
            />
          </Field>
          <Button type="submit" disabled={pending || code.length !== 6}>
            {t.setup2fa.verify}
          </Button>
        </FieldGroup>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-medium">{t.setup2fa.backupCodesTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.setup2fa.backupCodesDescription}
        </p>
      </div>
      <ul
        dir="ltr"
        className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 font-mono text-sm"
      >
        {step.backupCodes.map((backupCode) => (
          <li key={backupCode}>{backupCode}</li>
        ))}
      </ul>
      <Button
        onClick={() => {
          router.push(`/${locale}/dashboard`);
          router.refresh();
        }}
      >
        {t.setup2fa.continue}
      </Button>
    </div>
  );
}
