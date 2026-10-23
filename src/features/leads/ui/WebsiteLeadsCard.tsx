import { Globe, Info } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import type { WebsiteConnection } from "../domain/types";
import { ConnectWebsiteDialog } from "./ConnectWebsiteDialog";
import { DisconnectWebsiteButton } from "./DisconnectWebsiteButton";

interface Props {
  connections: WebsiteConnection[];
  apiBaseUrl: string;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

/** Leads → Settings: the agency's connected websites and the way to add one. */
export function WebsiteLeadsCard({ connections, apiBaseUrl }: Props) {
  // Connected first, then disconnected ones as history.
  const sorted = [...connections].sort((a, b) => Number(Boolean(a.revoked_at)) - Number(Boolean(b.revoked_at)));

  return (
    <div className="rounded-bento bg-surface-card shadow-bento p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-foreground-muted" />
          <h2 className="text-sm font-semibold text-foreground">Website enquiries</h2>
        </div>
        <ConnectWebsiteDialog apiBaseUrl={apiBaseUrl} />
      </div>

      <p className="text-sm text-foreground-muted">
        Your website&apos;s enquiry forms can send each enquiry straight to Leads. Every connected website gets
        its own key, which can only add leads — it can&apos;t read any of your data.
      </p>

      {sorted.length === 0 ? (
        <p className="text-sm text-foreground-muted text-center py-4">
          No websites connected yet. Connect one to start receiving its enquiries here.
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-surface-inset px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{c.label}</p>
                    {c.revoked_at ? (
                      <span className="rounded-full border border-border bg-surface-card px-2 py-0.5 text-[11px] text-foreground-muted">
                        Disconnected
                      </span>
                    ) : (
                      <span className="rounded-full border border-success-border bg-success-bg px-2 py-0.5 text-[11px] text-success-fg">
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-foreground-muted">
                    {c.key_prefix}… · connected {formatWhen(c.created_at)}
                  </p>
                </div>
                {!c.revoked_at && <DisconnectWebsiteButton id={c.id} label={c.label} />}
              </div>

              <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                <Stat
                  label="Leads received"
                  value={c.lead_count === null ? "—" : String(c.lead_count)}
                  tooltip="Every enquiry this website has delivered. Repeat submissions of the same enquiry are only counted once."
                />
                <Stat label="Last lead" value={formatWhen(c.last_lead_at)} />
                <Stat
                  label="Last request"
                  value={formatWhen(c.last_used_at)}
                  tooltip="The last time the website reached Harbor with this key, test submissions included. If enquiries stop arriving, check this first: an old date means the site has stopped sending."
                />
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-foreground-muted">
        {label}
        {tooltip && (
          <Tooltip content={tooltip}>
            <button
              type="button"
              aria-label={`About ${label}`}
              className="inline-flex h-5 w-5 items-center justify-center rounded text-foreground-muted hover:text-foreground"
            >
              <Info className="h-3 w-3" />
            </button>
          </Tooltip>
        )}
      </dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
