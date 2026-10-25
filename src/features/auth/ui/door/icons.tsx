/** The front door's line icons, drawn as in the design (currentColor, 1.6px strokes). */

export function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1 8h13M9 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M15 8H2M7 3 2 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function TickIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EyeOnIcon() {
  return (
    <svg className="eye-on" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function EyeOffIcon() {
  return (
    <svg className="eye-off" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17.5 17.5 0 0 1-3.2 4.1M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.9 9.9 0 0 0 5.4-1.6M9.9 9.9a3.2 3.2 0 0 0 4.2 4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The "request received" seal: a ring and a tick that draw themselves. */
export function DoneMark() {
  return (
    <svg className="done__mark" viewBox="0 0 56 56" aria-hidden="true">
      <circle pathLength={1} cx="28" cy="28" r="26" />
      <path pathLength={1} d="M17 29l7 7 15-16" />
    </svg>
  );
}
