"use client";

import { useRef } from "react";

type Field = HTMLTextAreaElement | HTMLInputElement;

/**
 * Insert text at a field's caret instead of appending to the end.
 *
 * Used by the merge-field chips: someone writing a template puts the caret
 * mid-sentence and clicks "Renter name" expecting {{renter_name}} to land
 * there. Appending to the end of the body meant re-cutting and pasting it
 * every time.
 *
 * Pair the chip buttons with `preventBlur` — a plain click moves focus off the
 * field first, and while the browser keeps the selection offsets, the caret
 * would visibly jump away after the insert.
 */
export function useCursorInsert<T extends Field = HTMLTextAreaElement>() {
  const elRef = useRef<T | null>(null);

  /**
   * Attach to the field, forwarding to React Hook Form's own ref:
   *   const { ref: rhfRef, ...field } = register("body");
   *   <textarea {...field} ref={(el) => bindRef(el, rhfRef)} />
   */
  const bindRef = (el: T | null, forward?: (el: T | null) => void) => {
    elRef.current = el;
    forward?.(el);
  };

  /** Keeps the field focused (and its selection live) when a chip is clicked. */
  const preventBlur = (event: React.MouseEvent) => {
    event.preventDefault();
  };

  /**
   * Splice `token` in at the caret, replacing any selection, then leave the
   * caret just past what was inserted. Falls back to appending if the field
   * isn't mounted yet.
   */
  const insert = (current: string, token: string, apply: (next: string) => void) => {
    const value = current ?? "";
    const el = elRef.current;
    if (!el) {
      apply(value + token);
      return;
    }

    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? start;
    apply(value.slice(0, start) + token + value.slice(end));

    // Wait for React to commit the new value before moving the caret, or the
    // re-render would put it back at the end.
    const caret = start + token.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  return { bindRef, insert, preventBlur };
}
