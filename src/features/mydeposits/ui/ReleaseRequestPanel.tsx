"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { RefreshCw, ExternalLink, Trash2, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MD_PORTAL_URL } from "@/lib/mydeposits/config";
import {
  initiateReleaseRequest,
  refreshReleaseRequest,
  cancelReleaseRequestAction,
} from "../actions/release";
import type { MdProtection, MdReleaseRequest } from "../domain/types";

export function ReleaseRequestPanel({
  protection,
  releaseRequests,
}: {
  protection: MdProtection;
  releaseRequests: MdReleaseRequest[];
}) {
  const [isPending, startTransition] = useTransition();

  const run = (fn: () => Promise<unknown>, success: string) =>
    startTransition(async () => {
      try {
        await fn();
        toast.success(success);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      }
    });

  const canInitiate =
    protection.status === "protected" && releaseRequests.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Release requests</h4>
        {canInitiate && (
          <Button
            variant="secondary"
            size="sm"
            loading={isPending}
            onClick={() => run(() => initiateReleaseRequest(protection.id), "Release request started")}
          >
            <Handshake className="h-3.5 w-3.5" />
            Start release request
          </Button>
        )}
      </div>

      {releaseRequests.length === 0 ? (
        <p className="text-xs text-foreground-secondary">
          {protection.status === "protected"
            ? "No release requests yet."
            : "A deposit must be protected before it can be released."}
        </p>
      ) : (
        <ul className="space-y-2">
          {releaseRequests.map((rr) => {
            const settlements = Array.isArray(rr.settlements) ? rr.settlements : [];
            return (
              <li key={rr.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {rr.status ?? "Open"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="xs"
                      loading={isPending}
                      onClick={() =>
                        run(
                          () => refreshReleaseRequest(rr.remote_release_id ?? ""),
                          "Release request refreshed"
                        )
                      }
                      disabled={!rr.remote_release_id}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Refresh
                    </Button>
                    <Button
                      variant="destructive"
                      size="xs"
                      loading={isPending}
                      onClick={() =>
                        run(
                          () => cancelReleaseRequestAction(rr.remote_release_id ?? ""),
                          "Release request cancelled"
                        )
                      }
                      disabled={!rr.remote_release_id}
                    >
                      <Trash2 className="h-3 w-3" />
                      Cancel
                    </Button>
                  </div>
                </div>

                {settlements.length > 0 && (
                  <div className="rounded bg-surface-inset p-2">
                    <p className="text-[11px] font-semibold text-foreground-muted mb-1">
                      Settlements ({settlements.length})
                    </p>
                    <pre className="overflow-x-auto text-[11px] text-foreground-secondary">
                      {JSON.stringify(settlements, null, 2)}
                    </pre>
                  </div>
                )}

                <a
                  href={MD_PORTAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-foreground-link hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open in mydeposits portal (disputes &amp; resolution)
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
