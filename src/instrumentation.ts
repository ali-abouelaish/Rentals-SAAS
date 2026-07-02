/**
 * Runs once when the Node server boots (i.e. each PM2 process on the VPS).
 * Starts an in-process loop that drains the email_outbox queue, so queued mail
 * — form links, invoice sends, maintenance/support notifications — is actually
 * delivered without depending on an external cron.
 *
 * Concurrency-safe: the claim step uses FOR UPDATE SKIP LOCKED, so running
 * under PM2 cluster mode won't double-send. Opt out with EMAIL_WORKER_DISABLED=1
 * (e.g. if you wire up a dedicated scheduler instead). Tune the cadence with
 * EMAIL_WORKER_INTERVAL_MS (default 30000).
 */
export async function register() {
  // Only run in the Node.js server runtime — never on the Edge runtime or
  // during the build's module evaluation.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.EMAIL_WORKER_DISABLED === "1") return;

  const parsed = Number(process.env.EMAIL_WORKER_INTERVAL_MS ?? 30000);
  const intervalMs = Number.isFinite(parsed) && parsed >= 5000 ? parsed : 30000;

  // Import lazily so node-only modules (admin client, nodemailer) never end up
  // in an Edge bundle or run at build time.
  const { drainEmailOutbox } = await import("./lib/email/drain");

  let running = false;
  const tick = async () => {
    if (running) return; // don't overlap if a drain runs long
    running = true;
    try {
      const res = await drainEmailOutbox(10);
      if (res.claimed > 0) {
        console.log("[email-worker] drained", res);
      }
    } catch (err) {
      console.error(
        "[email-worker] drain failed",
        err instanceof Error ? err.message : err
      );
    } finally {
      running = false;
    }
  };

  // Kick shortly after boot, then on the interval.
  setTimeout(tick, 5000);
  setInterval(tick, intervalMs);
}
