// Copies the pdfjs-dist worker into public/pdfjs/ so the browser can load it
// for the contract template editor. Runs automatically on npm install.

import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "public", "pdfjs");

const candidates = [
  join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs"),
  join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.mjs"),
  join(root, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.min.mjs"),
  join(root, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs"),
];

const source = candidates.find((p) => existsSync(p));
if (!source) {
  console.warn("[copy-pdfjs-worker] pdfjs-dist worker not found; skipping.");
  process.exit(0);
}

if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true });
}

const target = join(publicDir, "pdf.worker.min.mjs");
copyFileSync(source, target);
console.log(`[copy-pdfjs-worker] Copied ${source} → ${target}`);
