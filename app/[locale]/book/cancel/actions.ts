"use server";

import { cancelByToken } from "@/lib/dal/public-booking";

export type CancelState = {
  result?: "cancelled" | "notCancellable" | "invalid";
};

/** The patient cancels from the link in their email. Public: the token is the proof. */
export async function cancelAction(
  _prev: CancelState,
  formData: FormData,
): Promise<CancelState> {
  const outcome = await cancelByToken(String(formData.get("token") ?? ""));
  if (outcome.ok) return { result: "cancelled" };
  return {
    result: outcome.error === "notFound" ? "invalid" : "notCancellable",
  };
}
