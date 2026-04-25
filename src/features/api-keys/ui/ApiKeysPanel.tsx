"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Copy, KeyRound, Ban, Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  createPublicApiKey,
  revokePublicApiKey,
  deletePublicApiKey,
} from "../actions/publicApiKeys";
import type { PublicApiKey } from "../domain/types";

type Props = { keys: PublicApiKey[] };

export function ApiKeysPanel({ keys }: Props) {
  const { toast } = useToast();
  const [createdPlaintext, setCreatedPlaintext] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCreate(formData: FormData) {
    setSubmitting(true);
    try {
      const { plaintext } = await createPublicApiKey(formData);
      setCreatedPlaintext(plaintext);
      setCopied(false);
    } catch (e) {
      toast({ title: "Could not create key", description: (e as Error).message, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function copyKey() {
    if (!createdPlaintext) return;
    await navigator.clipboard.writeText(createdPlaintext);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-foreground-muted" />
            <p className="text-sm font-medium">Create API key</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              void handleCreate(fd);
              e.currentTarget.reset();
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1 space-y-1">
              <label htmlFor="label" className="block text-xs font-medium text-foreground-muted">
                Label
              </label>
              <Input id="label" name="label" placeholder="e.g. Partner portal — staging" required />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create key"}
            </Button>
          </form>
          {createdPlaintext ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700/40 dark:bg-amber-950/40">
              <p className="font-medium">
                Copy this key now — it will not be shown again.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-background px-2 py-1 text-xs">
                  {createdPlaintext}
                </code>
                <Button type="button" variant="outline" size="sm" onClick={copyKey}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span className="ml-1">{copied ? "Copied" : "Copy"}</span>
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <p className="text-sm font-medium">Existing keys</p>
          {keys.length === 0 ? (
            <p className="text-sm text-foreground-muted">No API keys yet.</p>
          ) : (
            <div className="space-y-2">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{k.label}</span>
                      {k.revoked_at ? (
                        <span className="rounded bg-red-100 px-2 py-0.5 text-[11px] text-red-700 dark:bg-red-950/40 dark:text-red-300">
                          Revoked
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-foreground-muted">
                      <code>{k.key_prefix}…</code> · scopes: {k.scopes.join(", ") || "—"}
                    </div>
                    <div className="text-xs text-foreground-muted">
                      Created {new Date(k.created_at).toLocaleString()}
                      {k.last_used_at ? ` · last used ${new Date(k.last_used_at).toLocaleString()}` : " · never used"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!k.revoked_at ? (
                      <form action={revokePublicApiKey}>
                        <input type="hidden" name="id" value={k.id} />
                        <Button type="submit" variant="outline" size="sm">
                          <Ban className="mr-1 h-3.5 w-3.5" /> Revoke
                        </Button>
                      </form>
                    ) : null}
                    <form action={deletePublicApiKey}>
                      <input type="hidden" name="id" value={k.id} />
                      <Button
                        type="submit"
                        variant="destructive"
                        size="sm"
                        className="bg-red-600 hover:bg-red-700"
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 pt-6 text-sm">
          <p className="font-medium">Using your key</p>
          <p className="text-foreground-muted">
            Send the key as a Bearer token (or <code>x-api-key</code> header) to:
          </p>
          <pre className="overflow-x-auto rounded bg-background p-2 text-xs">
{`GET /api/public/scraped-listings?limit=50&offset=0
Authorization: Bearer hopk_…`}
          </pre>
          <p className="text-foreground-muted">
            Filters: <code>status</code>, <code>landlord_id</code>, <code>property_type</code>,{" "}
            <code>paying</code>, <code>min_price</code>, <code>max_price</code>,{" "}
            <code>location</code> (ILIKE), <code>available_from</code> (YYYY-MM-DD).
            Sort: <code>?sort=price.asc</code> or <code>created_at.desc</code> (default).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
