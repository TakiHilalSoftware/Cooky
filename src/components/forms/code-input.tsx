"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import type { ComponentProps } from "react";

import type { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type CodeInputProps = Omit<ComponentProps<typeof Input>, "onChange" | "value" | "maxLength"> & {
  value: string;
  onValueChange: (value: string) => void;
};

/**
 * Six-digit one-time code. Digits always read left to right (also in Arabic),
 * and phones offer the code from SMS/apps via autocomplete="one-time-code".
 */
export function CodeInput({ value, onValueChange, id, className, ...rest }: CodeInputProps) {
  return (
    <div dir="ltr" className="w-fit">
      <InputOTP
        id={id}
        maxLength={6}
        pattern={REGEXP_ONLY_DIGITS}
        inputMode="numeric"
        autoComplete="one-time-code"
        value={value}
        onChange={onValueChange}
        containerClassName={className}
        aria-invalid={rest["aria-invalid"]}
        aria-describedby={rest["aria-describedby"]}
        autoFocus={rest.autoFocus}
      >
        <InputOTPGroup>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <InputOTPSlot key={index} index={index} aria-invalid={rest["aria-invalid"]} />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}
