"use client";

import { useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Info,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { setSpareroomScrapeEnabled, startSpareroomScrapeNow } from "../actions/scraper-schedule";
import type { ScrapeRun, ScrapeRunsState } from "../domain/types";

/** While a run is going, how often the card re-reads its status. */
const POLL_MS = 15_000;
/** Landlords listed by name under a run before collapsing to "and N more". */
const MAX_NAMED = 5;

const TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "2-digit",
  minute: "2-digit",
});
const DAY_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" });
const SHORT_DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "numeric",
  month: "short",
});

/** "today at 09:02", "yesterday at 09:02", "21 Oct at 09:02" — UK time, like the schedule. */
function formatRunTime(iso: string): string {
  const date = new Date(iso);
  const day = DAY_KEY.format(date);
  const today = DAY_KEY.format(new Date());
  const yesterday = DAY_KEY.format(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const prefix = day === today ? "today" : day === yesterday ? "yesterday" : SHORT_DATE.format(date);
  return `${prefix} at ${TIME.format(date)}`;
}

function startedBy(run: ScrapeRun): string {
  if (run.trigger === "schedule") return "daily run";
  return run.started_by_name ? `started by ${run.started_by_name}` : "started by hand";
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function LandlordLinks({ landlords }: { landlords: { id: string; name: string }[] }) {
  const named = landlords.slice(0, MAX_NAMED);
  const more = landlords.length - named.length;
  return (
    <>
      {named.map((l, i) => (
        <span key={l.id}>
          {i > 0 && ", "}
          <Link href={`/landlords/${l.id}`} className="font-medium underline underline-offset-2 hover:text-foreground">
            {l.name}
          </Link>
        </span>
      ))}
      {more > 0 && ` and ${more} more`}
    </>
  );
}

/** The latest finished run, or the one in progress. */
function RunStatus({ runs }: { runs: ScrapeRunsState }) {
  const { current, last } = runs;

  return (
    <div className="space-y-1.5 border-t border-border pt-3 text-xs">
      {current && (
        <p className="flex items-start gap-1.5 text-foreground-secondary">
          <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-brand" />
          <span>
            {current.trigger === "schedule"
              ? `Daily run in progress — started ${formatRunTime(current.started_at)}.`
              : `Scraping all landlords now — ${startedBy(current)} ${formatRunTime(current.started_at)}.`}{" "}
            You can leave this page; the result will show here.
          </span>
        </p>
      )}

      {last ? (
        last.status === "success" ? (
          <>
            <p className="flex items-start gap-1.5 text-foreground-secondary">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              <span>
                Last run {formatRunTime(last.finished_at ?? last.started_at)} ({startedBy(last)})
                {last.landlords_total != null &&
                  ` · ${last.landlords_refreshed ?? 0} of ${plural(last.landlords_total, "landlord")} read`}
                {last.listings_posted != null && ` · ${plural(last.listings_posted, "listing")} refreshed`}
                {last.listings_swept ? ` · ${last.listings_swept} removed as no longer live` : ""}
              </span>
            </p>
            {last.unreadable.length > 0 && (
              <p className="flex items-start gap-1.5 text-warning-fg">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {plural(last.unreadable.length, "landlord")} couldn&apos;t be read, so their listings were kept
                  and will age: <LandlordLinks landlords={last.unreadable} />. Usually the SpareRoom link has changed
                  or the profile is blocking us — check it on the landlord.
                </span>
              </p>
            )}
            {last.cleared.length > 0 && (
              <p className="flex items-start gap-1.5 text-foreground-muted">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {plural(last.cleared.length, "landlord")} had no live adverts, so their old listings were removed:{" "}
                  <LandlordLinks landlords={last.cleared} />.
                </span>
              </p>
            )}
          </>
        ) : (
          <p className="flex items-start gap-1.5 text-error">
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Last run {formatRunTime(last.finished_at ?? last.started_at)} ({startedBy(last)}) failed:{" "}
              {last.error_message ?? "no reason recorded."}
            </span>
          </p>
        )
      ) : (
        !current && (
          <p className="text-foreground-muted">
            No full scrape recorded yet. The next 09:00 run, or Scrape all now, will show its result here.
          </p>
        )
      )}
    </div>
  );
}

/**
 * The agency's "Daily SpareRoom scraping" card, on the Landlords page: the
 * schedule switch, "Scrape all now", and how the latest full scrape went.
 * Everyone sees the status; only admins get the buttons.
 */
export function ScraperScheduleCard({
  enabled,
  available,
  rosterCount,
  canEdit,
  runs,
}: {
  enabled: boolean;
  /** False until the scrape-switch migration has been applied. */
  available: boolean;
  rosterCount: number;
  canEdit: boolean;
  runs: ScrapeRunsState;
}) {
  const router = useRouter();
  const [isToggling, startToggle] = useTransition();
  const [isStarting, startRun] = useTransition();

  // Poll while a run is going, so the card moves from "in progress" to its
  // result without anyone reloading.
  const currentId = runs.current?.id ?? null;
  useEffect(() => {
    if (!currentId) return;
    const timer = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [currentId, router]);

  // Announce the result when the run this page was watching finishes.
  const watched = useRef<string | null>(currentId);
  useEffect(() => {
    if (currentId) {
      watched.current = currentId;
      return;
    }
    if (watched.current && runs.last?.id === watched.current) {
      if (runs.last.status === "success") {
        toast.success("SpareRoom scrape finished", {
          description:
            runs.last.listings_posted != null ? `${plural(runs.last.listings_posted, "listing")} refreshed.` : undefined,
        });
      } else {
        toast.error("SpareRoom scrape failed", { description: runs.last.error_message ?? undefined });
      }
    }
    watched.current = null;
  }, [currentId, runs.last]);

  const onToggle = () => {
    const next = !enabled;
    startToggle(async () => {
      const result = await setSpareroomScrapeEnabled({ enabled: next });
      if (!result.ok) {
        toast.error("Couldn't change daily scraping", { description: result.error });
        return;
      }
      toast.success(next ? "Daily SpareRoom scraping turned on" : "Daily SpareRoom scraping paused", {
        description: next
          ? "Listings will be refreshed at the next 09:00 run."
          : "Existing listings are kept but won't be refreshed. Run scraper on a landlord still works.",
      });
      router.refresh();
    });
  };

  const onScrapeNow = () => {
    startRun(async () => {
      const result = await startSpareroomScrapeNow();
      if (!result.ok) {
        toast.error("Couldn't start the scrape", { description: result.error });
      } else {
        toast.success("Scrape started", {
          description: "It takes a few minutes per landlord. You can leave this page — the result will show here.",
        });
      }
      router.refresh();
    });
  };

  const landlords = plural(rosterCount, "landlord");

  return (
    <div className="rounded-bento bg-surface-card shadow-bento p-5 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <div className="p-2 rounded-lg bg-brand-subtle">
            <CalendarClock className="h-4 w-4 text-brand" strokeWidth={2} />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Daily SpareRoom scraping</h2>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  enabled
                    ? "bg-success-bg text-success-fg"
                    : "bg-warning-bg text-warning-fg"
                }`}
              >
                {enabled ? "On" : "Paused"}
              </span>
              <Tooltip content="Pausing stops the 09:00 run for your agency only. Listings already scraped are kept, but they stop being refreshed and turn red after 7 days. Scrape all now, and Run scraper on a landlord's page, still work while paused.">
                {/* 44px hit area on touch screens; the negative margin keeps it
                    taking a 24px slot in the row. */}
                <button
                  type="button"
                  aria-label="About daily SpareRoom scraping"
                  className="-m-2.5 inline-flex h-11 w-11 items-center justify-center rounded text-foreground-muted hover:text-foreground md:m-0 md:h-6 md:w-6"
                >
                  <Info size={13} />
                </button>
              </Tooltip>
            </div>
            <p className="text-xs text-foreground-muted">
              {rosterCount === 0
                ? `${enabled ? "Runs" : "Would run"} every day at 09:00 UK time, but no landlord has a SpareRoom profile yet — add one on a landlord to have their listings scraped.`
                : enabled
                  ? `Runs every day at 09:00 UK time for the ${landlords} with a SpareRoom profile.`
                  : `Paused — the ${landlords} with a SpareRoom profile aren't being refreshed. Use Scrape all now, or Run scraper on a landlord, to refresh them by hand.`}
            </p>
            {!available && (
              <p className="text-xs text-warning-fg">
                This switch becomes available once the latest database update has been applied. Until then daily
                scraping stays on.
              </p>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Tooltip content="Scrapes every landlord with a SpareRoom profile now instead of waiting for 09:00. It takes a few minutes per landlord and runs in the background, so you can leave the page.">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2"
                loading={isStarting}
                disabled={!runs.available || rosterCount === 0 || Boolean(runs.current) || isStarting}
                onClick={onScrapeNow}
              >
                <RefreshCw className="h-4 w-4" />
                Scrape all now
              </Button>
            </Tooltip>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              loading={isToggling}
              disabled={!available || isToggling}
              onClick={onToggle}
            >
              {enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {enabled ? "Pause daily scraping" : "Turn on daily scraping"}
            </Button>
          </div>
        )}
      </div>

      {runs.available && <RunStatus runs={runs} />}
    </div>
  );
}
