"use client";

import { useSearchParams } from "next/navigation";
import { FormMessage } from "@/components/form-message";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/** After leaving guest mode (?guest=ended) or when it ran out (?guest=expired). */
export function GuestNotice({ t }: { t: Dictionary["guest"] }) {
  const reason = useSearchParams().get("guest");
  if (reason !== "ended" && reason !== "expired") return null;
  return <FormMessage tone="success" message={t[reason]} />;
}
