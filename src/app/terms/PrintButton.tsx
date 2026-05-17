"use client";

export function PrintButton() {
  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        window.print();
      }}
    >
      ↓ PRINT / SAVE AS PDF
    </a>
  );
}
