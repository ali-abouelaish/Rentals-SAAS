import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/features/auth/ui/door/door.css";
import { urbanist } from "@/features/site/fonts";

// Sign-in screens stay out of search results; /signup (the demo request) opts back in.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * The front door: every sign-in screen is drawn on Harbor's front door (see DoorShell). The
 * wrapper carries the door's scoped stylesheet; the inline script marks it .is-js before the first
 * paint, which lets the plate rise in (without script it simply shows).
 *
 * The className is a plain string on purpose: React leaves classes added at runtime (.is-js,
 * .is-open when the door swings) alone only while the prop itself never changes.
 */
export default function FrontDoorLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`harbor-door ${urbanist.variable}`} suppressHydrationWarning>
      <script
        dangerouslySetInnerHTML={{ __html: "document.currentScript.parentElement.classList.add('is-js')" }}
      />
      {children}
    </div>
  );
}
