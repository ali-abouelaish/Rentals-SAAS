import type { ReactNode } from "react";

/** aria-describedby for a control: its hint always, its error while there is one. */
export function describedBy(id: string, error?: string | null): string {
  return error ? `${id}-hint ${id}-error` : `${id}-hint`;
}

/**
 * A field on the door: a visible label (with an optional link on its right, e.g. "Forgot
 * password?"), the control, a hint that is always there, and the inline error under it.
 * The control itself is the child, so each form keeps its own register() wiring; give it
 * `aria-describedby={describedBy(id, error)}`.
 */
export function DoorField({
  id,
  label,
  hint,
  hintLive = false,
  error,
  optional = false,
  aside,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  hint: ReactNode;
  /** Announce hint changes (e.g. the Caps Lock warning that replaces it). */
  hintLive?: boolean;
  error?: string | null;
  optional?: boolean;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const labelEl = (
    <label htmlFor={id}>
      {label}
      {optional ? <span className="optional">Optional</span> : null}
    </label>
  );
  return (
    <div className={className ? `field ${className}` : "field"}>
      {aside ? (
        <div className="field__row">
          {labelEl}
          {aside}
        </div>
      ) : (
        labelEl
      )}
      {children}
      <p className="field__hint" id={`${id}-hint`} role={hintLive ? "status" : undefined}>
        {hint}
      </p>
      {error ? (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The same, for a group of radios or chips: a fieldset whose legend is the label. */
export function DoorFieldset({
  id,
  legend,
  hint,
  error,
  children,
}: {
  id: string;
  legend: ReactNode;
  hint: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <fieldset className="field" aria-describedby={describedBy(id, error)}>
      <legend>{legend}</legend>
      {children}
      <p className="field__hint" id={`${id}-hint`}>
        {hint}
      </p>
      {error ? (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
