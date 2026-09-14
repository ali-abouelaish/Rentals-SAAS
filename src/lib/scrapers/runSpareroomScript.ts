/**
 * Single entry point for invoking scripts/OGSCRPAPER.py.
 *
 * Two callers need it — the on-demand "Run scraper" button on a landlord
 * (src/features/landlords/actions/landlords.ts) and the daily sweep
 * (src/lib/cron/spareroomScraper.ts) — and they must agree on the lock file, or
 * the two can run concurrently against the same tenant. Concurrency is not
 * merely wasteful here: each run sweeps rows whose last_seen_at predates its own
 * start, so an overlapping run would sweep the rows the other just wrote.
 *
 * Server-only: spawns a child process and reads the project venv.
 */

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * flock serialises every invocation, on-demand and scheduled alike. POSIX-only,
 * so it is used where it exists (the VPS) and skipped elsewhere (local Windows
 * dev, where there is no cron run to collide with).
 */
export const SCRAPER_LOCK_FILE = "/tmp/harborops_scraper.lock";

/** A single landlord: one profile, a handful of adverts. */
export const SCRAPER_ONE_LANDLORD_TIMEOUT_MS = 120_000;

/**
 * A whole tenant: every rostered profile, and the script sleeps ~1s between
 * advert pages to stay polite to SpareRoom. Thirty-odd landlords at a couple of
 * hundred adverts lands well inside this; the ceiling exists so a hung run
 * cannot hold the lock until the next night.
 */
export const SCRAPER_TENANT_TIMEOUT_MS = 45 * 60_000;

export type SpareroomScriptResult = {
  stdout: string;
  stderr: string;
};

export type SpareroomScriptFailure = {
  /** No python, no venv, no flock — the runtime is missing, not busy. */
  kind: "runtime-missing" | "timeout" | "lock-held" | "failed";
  message: string;
  stdout: string;
  stderr: string;
};

export class SpareroomScriptError extends Error implements SpareroomScriptFailure {
  kind: SpareroomScriptFailure["kind"];
  stdout: string;
  stderr: string;

  constructor(failure: SpareroomScriptFailure) {
    super(failure.message);
    this.name = "SpareroomScriptError";
    this.kind = failure.kind;
    this.stdout = failure.stdout;
    this.stderr = failure.stderr;
  }
}

/**
 * Run the scraper for exactly one tenant, optionally narrowed to one landlord.
 *
 * One tenant per invocation is the script's own contract — it reads a single
 * TENANT_ID and every write and sweep it performs is scoped to it — so callers
 * covering several tenants invoke this once per tenant rather than batching.
 *
 * Throws SpareroomScriptError with a `kind` the caller can turn into the right
 * message; the distinction between "the lock was held" and "the scrape failed"
 * is the difference between a retry and an alert.
 */
export async function runSpareroomScript(options: {
  tenantId: string;
  landlordId?: string;
  timeoutMs?: number;
}): Promise<SpareroomScriptResult> {
  const { tenantId, landlordId } = options;
  const timeout =
    options.timeoutMs ??
    (landlordId ? SCRAPER_ONE_LANDLORD_TIMEOUT_MS : SCRAPER_TENANT_TIMEOUT_MS);

  const isWindows = process.platform === "win32";
  const pythonBin = path.join(
    process.cwd(),
    "venv",
    isWindows ? "Scripts" : "bin",
    isWindows ? "python.exe" : "python"
  );
  const scriptPath = path.join(process.cwd(), "scripts", "OGSCRPAPER.py");
  const useFlock = !isWindows;

  const env: NodeJS.ProcessEnv = { ...process.env, TENANT_ID: tenantId };
  if (landlordId) {
    env.LANDLORD_ID = landlordId;
  } else {
    // An inherited LANDLORD_ID would silently narrow a full sweep to one
    // landlord — and a narrowed run deliberately skips the orphan sweep.
    delete env.LANDLORD_ID;
  }

  const runOpts = { cwd: process.cwd(), env, timeout, maxBuffer: 10 * 1024 * 1024 } as const;

  try {
    const res = useFlock
      ? await execFileAsync("flock", ["-n", SCRAPER_LOCK_FILE, pythonBin, scriptPath], runOpts)
      : await execFileAsync(pythonBin, [scriptPath], runOpts);
    return { stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
  } catch (err: unknown) {
    const e = err as {
      code?: string;
      killed?: boolean;
      signal?: string;
      stdout?: string;
      stderr?: string;
    };
    const stdout = (e.stdout ?? "").trim();
    const stderr = (e.stderr ?? "").trim();

    if (e.code === "ENOENT") {
      throw new SpareroomScriptError({
        kind: "runtime-missing",
        message:
          "Scraper runtime not available here. It needs Python and the project venv on the host running the app — present on the production server, absent in local dev without a venv.",
        stdout,
        stderr,
      });
    }
    if (e.killed || e.signal === "SIGTERM") {
      throw new SpareroomScriptError({
        kind: "timeout",
        message: `Scraper timed out after ${Math.round(timeout / 1000)}s.`,
        stdout,
        stderr,
      });
    }
    // `flock -n` exits 1 with no output of its own when the lock is already held.
    if (useFlock && !stdout && !stderr) {
      throw new SpareroomScriptError({
        kind: "lock-held",
        message: "Another scraper run is already in progress.",
        stdout,
        stderr,
      });
    }
    throw new SpareroomScriptError({
      kind: "failed",
      message: (stderr || stdout).split("\n").filter(Boolean).pop() || "Scraper run failed.",
      stdout,
      stderr,
    });
  }
}

/**
 * Pull the run's own accounting out of its stdout.
 *
 * `posted` is null when the summary line is absent, which means the run bailed
 * before writing anything — a failure to read the source, not a finding that
 * nothing is live. Callers must keep those apart: only the second is a reason to
 * tell someone their listings are gone.
 */
export function parseScraperSummary(stdout: string): {
  posted: number | null;
  swept: number | null;
} {
  const posted = stdout.match(/Successfully posted (\d+) listings/);
  const swept = stdout.match(/Swept (\d+) listing\(s\)/);
  return {
    posted: posted ? Number(posted[1]) : null,
    swept: swept ? Number(swept[1]) : null,
  };
}
