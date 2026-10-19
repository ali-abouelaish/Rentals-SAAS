#!/usr/bin/env node
// Usage gate for the long-running PM E2E run.
//
// The run can take hours and burns Claude usage. Before every phase and every
// batch of fixes, Claude runs `node e2e/usage-gate.mjs` and reads the verdict:
//
//   ok      (exit 0)   — proceed.
//   wait    (exit 10)  — too close to a limit; pause and resume after it resets.
//   unknown (exit 0)   — no fresh snapshot; proceed but warn (the hourly
//                        watchdog is the only safety net until a snapshot lands).
//
// The snapshot is written by .claude/statusline-usage.mjs, which only runs when
// a status line is configured AND the client actually executes status-line
// commands (the TUI does; the VS Code extension may not). So `unknown` is a
// real, expected state, not an error.
//
// Thresholds: pause at 80% of the 5-hour window or 95% of the 7-day window. The
// 7-day threshold is higher because hitting it costs a day, not an afternoon —
// we'd rather coast closer to it than stall for a week early.
//
//   node e2e/usage-gate.mjs            # prints JSON, sets exit code
//   node e2e/usage-gate.mjs --quiet    # exit code only

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = path.resolve(HERE, "..", ".claude", "usage-snapshot.json");

const FIVE_HOUR_LIMIT = 80; // pause at/above this % of the 5h window
const SEVEN_DAY_LIMIT = 95; // pause at/above this % of the 7d window
const STALE_MS = 15 * 60 * 1000; // a snapshot older than this is untrustworthy
const RESUME_BUFFER_MS = 5 * 60 * 1000; // resume 5 min after a window resets

const quiet = process.argv.includes("--quiet");

function out(verdict, extra = {}) {
  const payload = { verdict, ...extra };
  if (!quiet) process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
  return payload;
}

function readSnapshot() {
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOT, "utf8"));
  } catch {
    return null;
  }
}

/** Local one-shot cron string (minute hour day-of-month month *) for a Date. */
function cronAt(date) {
  return `${date.getMinutes()} ${date.getHours()} ${date.getDate()} ${date.getMonth() + 1} *`;
}

function local(date) {
  return date.toLocaleString("en-GB", { hour12: false });
}

const snap = readSnapshot();

if (!snap) {
  out("unknown", {
    reason: "no .claude/usage-snapshot.json — status line not writing it yet",
    hint: "Register the status line (see .claude/statusline-usage.mjs) or run the gate from a terminal Claude session.",
  });
  process.exit(0);
}

const age = Date.now() - (snap.ts ?? 0);
if (age > STALE_MS) {
  out("unknown", {
    reason: `snapshot is ${Math.round(age / 60000)} min old (stale > ${STALE_MS / 60000} min)`,
    snapshot: snap,
  });
  process.exit(0);
}

const fivePct = snap.fiveHourPct;
const sevenPct = snap.sevenDayPct;

// If the subscriber tier carries no rate-limit fields, the snapshot has nulls.
// Treat that as unknown rather than a false "ok" — we genuinely don't know.
if (fivePct == null && sevenPct == null) {
  out("unknown", {
    reason: "snapshot has no rate-limit percentages (tier may not expose them)",
    snapshot: snap,
  });
  process.exit(0);
}

const fiveHot = fivePct != null && fivePct >= FIVE_HOUR_LIMIT;
const sevenHot = sevenPct != null && sevenPct >= SEVEN_DAY_LIMIT;

if (fiveHot || sevenHot) {
  // Resume after whichever hot window resets first (plus a buffer).
  const candidates = [];
  if (fiveHot && snap.fiveHourResetsAt) candidates.push(snap.fiveHourResetsAt * 1000);
  if (sevenHot && snap.sevenDayResetsAt) candidates.push(snap.sevenDayResetsAt * 1000);
  const resetMs = candidates.length ? Math.min(...candidates) : Date.now() + 60 * 60 * 1000;
  const resumeAt = new Date(resetMs + RESUME_BUFFER_MS);

  out("wait", {
    reason:
      (fiveHot ? `5h window at ${Math.round(fivePct)}% (>= ${FIVE_HOUR_LIMIT}%)` : "") +
      (fiveHot && sevenHot ? "; " : "") +
      (sevenHot ? `7d window at ${Math.round(sevenPct)}% (>= ${SEVEN_DAY_LIMIT}%)` : ""),
    fiveHourPct: fivePct,
    sevenDayPct: sevenPct,
    resumeAt: local(resumeAt),
    resumeAtEpoch: Math.floor(resumeAt.getTime() / 1000),
    cron: cronAt(resumeAt),
    snapshot: snap,
  });
  process.exit(10);
}

out("ok", { fiveHourPct: fivePct, sevenDayPct: sevenPct });
process.exit(0);
