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
import { access, constants as fsConstants } from "node:fs/promises";
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

/**
 * How long a scheduled run waits for the lock before giving up. The lock is
 * server-wide, not per tenant, so without this an admin's "Scrape all now"
 * still going at 09:00 failed the daily run for every agency it reached in
 * turn. Manual runs never wait — they fail fast and say the scraper is busy.
 */
export const SCRAPER_LOCK_WAIT_MS = 30 * 60_000;

/**
 * A run still marked running after this cannot still be going: it has outlived
 * the longest lock wait plus the tenant timeout. It died with the process (a
 * deploy or PM2 restart) and never reported back.
 */
export const STALE_RUN_AFTER_MS = SCRAPER_LOCK_WAIT_MS + SCRAPER_TENANT_TIMEOUT_MS + 5 * 60_000;

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
  /**
   * Queue behind a run already holding the lock for up to this long, instead
   * of failing at once. Counted on top of the run timeout.
   */
  waitForLockMs?: number;
}): Promise<SpareroomScriptResult> {
  const { tenantId, landlordId, waitForLockMs } = options;
  const runTimeout =
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
  const lockWait = useFlock && waitForLockMs ? waitForLockMs : 0;
  const timeout = runTimeout + lockWait;
  // -w N waits up to N seconds for the lock; -n gives up immediately. Both exit
  // 1 with no output of their own when they don't get it.
  const flockArgs = lockWait ? ["-w", String(Math.ceil(lockWait / 1000))] : ["-n"];

  const env: NodeJS.ProcessEnv = { ...process.env, TENANT_ID: tenantId };
  if (landlordId) {
    env.LANDLORD_ID = landlordId;
  } else {
    // An inherited LANDLORD_ID would silently narrow a full sweep to one
    // landlord — and a narrowed run deliberately skips the orphan sweep.
    delete env.LANDLORD_ID;
  }

  const runOpts = { cwd: process.cwd(), env, timeout, maxBuffer: 10 * 1024 * 1024 } as const;

  // Checked up front because, through flock, a missing interpreter is not an
  // ENOENT but a generic exit 1 ("flock: failed to execute …"). That read as an
  // ordinary scrape error and hid, for weeks, a server that had no venv at all.
  const required: [string, number][] = [
    [pythonBin, fsConstants.X_OK],
    // Run through the interpreter, so it only has to be readable.
    [scriptPath, fsConstants.R_OK],
  ];
  for (const [file, mode] of required) {
    try {
      await access(file, mode);
    } catch {
      throw new SpareroomScriptError({
        kind: "runtime-missing",
        message: `Scraper runtime missing on this host: ${file} not found. Set it up from the app directory with \`python3 -m venv venv && venv/bin/python -m pip install -r requirements.txt\` — scripts/deploy.sh does this on every deploy.`,
        stdout: "",
        stderr: "",
      });
    }
  }

  try {
    const res = useFlock
      ? await execFileAsync("flock", [...flockArgs, SCRAPER_LOCK_FILE, pythonBin, scriptPath], runOpts)
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

    // ENOENT: flock itself is missing. "failed to execute": flock is there but
    // the interpreter vanished between the check above and the spawn.
    if (e.code === "ENOENT" || /flock: failed to execute/.test(stderr)) {
      throw new SpareroomScriptError({
        kind: "runtime-missing",
        message: `Scraper runtime missing on this host: ${
          e.code === "ENOENT" ? (useFlock ? "flock" : pythonBin) : stderr
        }. It needs flock, Python and the project venv (scripts/deploy.sh sets up the venv).`,
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
    // `flock -n` / `-w` exit 1 with no output of their own when the lock is held.
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

export type ScrapedLandlordRef = { id: string; name: string };

export type ScraperRunDetails = {
  posted: number | null;
  swept: number | null;
  /** Profiles the run loaded — printed before any scraping, so present even when it bails. */
  landlordsTotal: number | null;
  landlordsRefreshed: number | null;
  /** Not read end-to-end: their listings were left untouched and will age. */
  unreadable: ScrapedLandlordRef[];
  /** Read cleanly with nothing live: their old listings were removed. */
  cleared: ScrapedLandlordRef[];
};

/** "      - Some Landlord (3f2a…-uuid)" — the name may itself contain brackets. */
const LANDLORD_LINE = /^\s*- (.*) \(([0-9a-f-]{36})\)\s*$/i;

/**
 * Everything a full-roster run reports about itself, for the agency-facing run
 * history. Reads the lines OGSCRPAPER.py prints at the end of main(); the
 * landlord lists follow their headers one per line until anything else.
 */
export function parseScraperRunDetails(stdout: string): ScraperRunDetails {
  const { posted, swept } = parseScraperSummary(stdout);
  const loaded = stdout.match(/Loaded (\d+) landlord profiles/);
  const refreshed = stdout.match(/Landlords refreshed: (\d+) of (\d+)/);

  const unreadable: ScrapedLandlordRef[] = [];
  const cleared: ScrapedLandlordRef[] = [];
  let section: ScrapedLandlordRef[] | null = null;
  for (const line of stdout.split(/\r?\n/)) {
    if (/landlords could not be read/.test(line)) {
      section = unreadable;
      continue;
    }
    if (/landlords read cleanly with 0 live listings/.test(line)) {
      section = cleared;
      continue;
    }
    const item = section ? LANDLORD_LINE.exec(line) : null;
    if (section && item) {
      section.push({ name: item[1], id: item[2] });
    } else {
      section = null;
    }
  }

  return {
    posted,
    swept,
    landlordsTotal: refreshed ? Number(refreshed[2]) : loaded ? Number(loaded[1]) : null,
    landlordsRefreshed: refreshed ? Number(refreshed[1]) : null,
    unreadable,
    cleared,
  };
}
