"use client";

import { useState, type KeyboardEvent } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { EyeOffIcon, EyeOnIcon } from "./icons";
import { describedBy } from "./DoorField";

/**
 * A password input with the design's show/hide button. Reports Caps Lock so the field can swap its
 * hint for a warning while it's on.
 */
export function PasswordInput({
  id,
  registration,
  autoComplete,
  error,
  disabled,
  onCapsLockChange,
}: {
  id: string;
  registration: UseFormRegisterReturn;
  autoComplete: "current-password" | "new-password";
  error?: string | null;
  disabled?: boolean;
  onCapsLockChange?: (on: boolean) => void;
}) {
  const [shown, setShown] = useState(false);
  const caps = (e: KeyboardEvent<HTMLInputElement>) => onCapsLockChange?.(e.getModifierState("CapsLock"));

  return (
    <div className="field__control">
      <input
        className="input"
        id={id}
        type={shown ? "text" : "password"}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error)}
        disabled={disabled}
        {...registration}
        onKeyDown={caps}
        onKeyUp={caps}
        onBlur={(e) => {
          onCapsLockChange?.(false);
          return registration.onBlur(e);
        }}
      />
      <button
        className="reveal"
        type="button"
        aria-controls={id}
        aria-pressed={shown}
        aria-label={shown ? "Hide password" : "Show password"}
        onClick={() => {
          setShown((s) => !s);
          document.getElementById(id)?.focus({ preventScroll: true });
        }}
      >
        <EyeOnIcon />
        <EyeOffIcon />
      </button>
    </div>
  );
}
