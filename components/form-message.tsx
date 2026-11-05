import { CircleAlert, CircleCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/** A form-level error or success message, announced to screen readers. */
export function FormMessage({
  message,
  tone = "error",
}: {
  message?: string | null;
  tone?: "error" | "success";
}) {
  if (!message) return null;
  const Icon = tone === "error" ? CircleAlert : CircleCheck;
  return (
    <Alert
      variant={tone === "error" ? "destructive" : "default"}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
