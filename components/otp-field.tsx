"use client";

import { useEffect, useRef } from "react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

/**
 * Six-digit code input. Always left-to-right, since codes read that way in
 * every language. When `resetKey` changes (after a rejected code), focus
 * returns to the input so the next code can be typed straight away.
 */
export function OtpField({
  id,
  value,
  onChange,
  label,
  resetKey,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
  resetKey?: unknown;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (resetKey) inputRef.current?.focus();
  }, [resetKey]);

  return (
    <div dir="ltr" className="flex justify-center">
      <InputOTP
        ref={inputRef}
        id={id}
        maxLength={6}
        value={value}
        onChange={onChange}
        inputMode="numeric"
        pattern="^[0-9]*$"
        autoComplete="one-time-code"
        aria-label={label}
        autoFocus
      >
        <InputOTPGroup>
          {Array.from({ length: 6 }, (_, index) => (
            <InputOTPSlot key={index} index={index} />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}
