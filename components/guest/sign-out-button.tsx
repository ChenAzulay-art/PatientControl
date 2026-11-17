"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";

/**
 * The header's sign-out button. For a guest it reads "Exit guest mode" and
 * asks first, because signing out deletes their demo clinic.
 */
export function SignOutButton({
  action,
  locale,
  label,
  confirmText,
}: {
  action: (formData: FormData) => Promise<void>;
  locale: Locale;
  label: string;
  confirmText?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (confirmText && !window.confirm(confirmText)) event.preventDefault();
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      <Button type="submit" variant="ghost" size="sm">
        <LogOut aria-hidden className="rtl:-scale-x-100" />
        <span className="max-sm:sr-only">{label}</span>
      </Button>
    </form>
  );
}
