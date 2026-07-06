/**
 * Runs once when the Node server boots (i.e. each PM2 process on the VPS).
 * Bootstraps the in-process background work that used to depend on external
 * schedulers:
 *   1. Drains the email_outbox queue so queued mail — form links, invoice
 *      sends, maintenance/support notifications — is actually delivered.
 *   2. Starts the node-cron scheduler for the recurring jobs that were
 *      previously Vercel Cron (rent reminders, mydeposits + TDS polling).
 *
 * Concurrency-safe: the email claim step uses FOR UPDATE SKIP LOCKED, so running
 * under PM2 cluster mode won't double-send. Opt out of the email worker with
 * EMAIL_WORKER_DISABLED=1 and the cron scheduler with CRON_DISABLED=1. Tune the
 * email cadence with EMAIL_WORKER_INTERVAL_MS (default 30000).
 *
 * The whole body is wrapped in `process.env.NEXT_RUNTIME === "nodejs"` (not an
 * early return) so webpack dead-code-eliminates these node-only dynamic imports
 * from the Edge compilation of this file — the Edge bundle can't resolve `crypto`
 * and friends that the jobs pull in transitively.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Recurring jobs (rent reminders, deposit polling).
    const { startCronScheduler } = await import("./lib/cron/scheduler");
    startCronScheduler();

    if (process.env.EMAIL_WORKER_DISABLED !== "1") {
      const parsed = Number(process.env.EMAIL_WORKER_INTERVAL_MS ?? 30000);
      const intervalMs = Number.isFinite(parsed) && parsed >= 5000 ? parsed : 30000;

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
  }
}
