"use client";

import { useEffect } from "react";

export function TocScrollSpy() {
  useEffect(() => {
    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('.harbor-legal .toc a[href^="#"]'),
    );
    if (links.length === 0) return;

    const sections = links
      .map((a) => document.getElementById((a.getAttribute("href") || "").slice(1)))
      .filter((el): el is HTMLElement => el !== null);

    function update() {
      const top = window.scrollY + 120;
      let active: HTMLElement | undefined = sections[0];
      for (const s of sections) {
        if (s.offsetTop <= top) active = s;
      }
      const activeId = active?.id ?? "";
      links.forEach((a) => {
        a.classList.toggle("active", a.getAttribute("href") === "#" + activeId);
      });
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return null;
}
