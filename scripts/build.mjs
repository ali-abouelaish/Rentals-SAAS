// Cross-platform `next build` with a raised V8 heap.
// NODE_OPTIONS (not a node flag) is used so Next's build worker child process inherits it.
// Override with BUILD_HEAP_MB, e.g. PowerShell: $env:BUILD_HEAP_MB=8192; npm run build
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const heapMb = Number(process.env.BUILD_HEAP_MB) || 6144;
const existing = (process.env.NODE_OPTIONS ?? "")
  .split(/\s+/)
  .filter((opt) => opt && !/^--max[-_]old[-_]space[-_]size/.test(opt));

const env = {
  ...process.env,
  NODE_OPTIONS: [...existing, `--max-old-space-size=${heapMb}`].join(" ")
};

const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
console.log(`[build] next build with ${heapMb} MB heap`);

const child = spawn(process.execPath, [nextBin, "build", ...process.argv.slice(2)], {
  stdio: "inherit",
  env
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
