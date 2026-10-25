"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Eye, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { CopyButton } from "@/components/shared/CopyButton";
import { getQuickLinkSiteSecret, replaceQuickLinkSiteSecret } from "../actions/quickLinks";
import { buildSiteSignInSnippets } from "../domain/siteSignInSnippets";

export type SiteSignInTarget = {
  id: string;
  title: string;
  sso_callback_url: string | null;
};

/**
 * Everything an agency's web developer needs to accept Harbor sign-ins: the
 * site's secret (fetched only when asked for) and a ready-made handler.
 */
export function SiteSignInDialog({
  link,
  onOpenChange,
}: {
  link: SiteSignInTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!link} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-2xl">
        {/* Keyed so a different link never shows the previous one's secret. */}
        {link && <SiteSignInBody key={link.id} link={link} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function SiteSignInBody({ link, onDone }: { link: SiteSignInTarget; onDone: () => void }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [isPending, startTransition] = useTransition();
  const s = buildSiteSignInSnippets({ callbackUrl: link.sso_callback_url });

  const reveal = () => {
    startTransition(async () => {
      const result = await getQuickLinkSiteSecret(link.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSecret(result.secret);
    });
  };

  const replace = () => {
    startTransition(async () => {
      const result = await replaceQuickLinkSiteSecret(link.id);
      setConfirmReplace(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSecret(result.secret);
      toast.success("Secret replaced. Give the new one to your web developer.");
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Website sign-in: {link.title}</DialogTitle>
        <DialogDescription>
          When someone in your team opens this link from the dashboard, Harbor signs them in to the website with
          their Harbor account. Your web developer sets the website up once, using the secret and handler below.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="text-sm">
          <p className="font-medium text-foreground">Sign-in URL</p>
          <code className="mt-1 block break-all rounded bg-surface-inset px-2 py-1 text-xs">
            {link.sso_callback_url ?? "Not set"}
          </code>
        </div>

        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700/40 dark:bg-amber-950/40">
          <p className="font-medium text-foreground">Website secret</p>
          <p className="mt-1 text-xs text-foreground-secondary">
            Anyone with this secret can sign in to your website as anyone, so only give it to your web developer, and
            never put it in the page itself. If it&apos;s ever exposed, replace it.
          </p>
          {secret ? (
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code data-testid="site-sign-in-secret" className="min-w-0 flex-1 break-all rounded bg-surface-card px-2 py-1 text-xs">
                {secret}
              </code>
              <CopyButton value={secret} label="Copy secret" />
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {!secret && (
              <Tooltip content="The secret isn't stored anywhere, so you can show it again whenever your developer needs it.">
                <Button type="button" variant="secondary" size="sm" onClick={reveal} loading={isPending && !confirmReplace}>
                  <Eye className="h-3.5 w-3.5" />
                  Show secret
                </Button>
              </Tooltip>
            )}
            {confirmReplace ? (
              <>
                <span className="text-xs text-foreground-secondary">
                  The website stops accepting sign-ins until it has the new secret.
                </span>
                <Button type="button" variant="secondary" size="sm" onClick={replace} loading={isPending}>
                  Replace now
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmReplace(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Tooltip content="Do this if the secret was shared somewhere it shouldn't be, or a developer who had it has left.">
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmReplace(true)}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Replace secret
                </Button>
              </Tooltip>
            )}
          </div>
        </div>

        <Tabs defaultValue="wordpress">
          <TabsList>
            <TabTrigger value="wordpress" tooltip="For a WordPress website. One file and one line of config, no extra plugins.">
              WordPress
            </TabTrigger>
            <TabTrigger value="node" tooltip="For a website with a Node.js (Express) server.">
              Node.js
            </TabTrigger>
            <TabTrigger value="other" tooltip="For any other website with server code: what Harbor sends and what the site must check.">
              Any other site
            </TabTrigger>
          </TabsList>

          <TabsContent value="wordpress" className="space-y-3">
            <p className="text-sm text-foreground-secondary">
              Add this line to <code>wp-config.php</code> with the secret above:
            </p>
            <CodeBlock code={s.wordpressConfig} />
            <p className="text-sm text-foreground-secondary">
              Save this as <code>wp-content/mu-plugins/harbor-sign-in.php</code>. Your team are matched to WordPress
              accounts by email; anyone new gets an account with the role set at the top of the file.
            </p>
            <CodeBlock code={s.wordpressPlugin} />
          </TabsContent>

          <TabsContent value="node" className="space-y-3">
            <p className="text-sm text-foreground-secondary">
              Set <code>HARBOR_SIGN_IN_SECRET</code> to the secret above in the server&apos;s environment, then add this
              route.
            </p>
            <CodeBlock code={s.node} />
          </TabsContent>

          <TabsContent value="other" className="space-y-3 text-sm text-foreground-secondary">
            <p>
              Harbor sends a form <code>POST</code> to the sign-in URL with one field, <code>harbor_token</code>: a
              standard JWT signed with HS256, using the secret above exactly as shown. It contains:
            </p>
            <CodeBlock code={s.claims} />
            <p>Before starting a session, the website must check that:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>the signature is valid and the algorithm is HS256</li>
              <li>
                <code>iss</code> is <code>harbor-ops</code> and <code>aud</code> is <code>{s.origin}</code>
              </li>
              <li>
                <code>exp</code> hasn&apos;t passed (allow 30 seconds for clock differences)
              </li>
              <li>
                the <code>jti</code> hasn&apos;t been used before (remember each one for 5 minutes)
              </li>
            </ul>
            <p>
              Then it starts its own session (a <code>SameSite=Lax</code> cookie, not Strict) and redirects to{" "}
              <code>return_to</code> if that&apos;s on the same website. Your developer can ask Harbor support for the
              full reference.
            </p>
          </TabsContent>
        </Tabs>
      </div>

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone}>
          Done
        </Button>
      </DialogFooter>
    </>
  );
}

/** Tabs triggers don't forward refs, so the tooltip anchors on a wrapping span. */
function TabTrigger({ value, tooltip, children }: { value: string; tooltip: string; children: ReactNode }) {
  return (
    <Tooltip content={tooltip}>
      <span className="inline-flex shrink-0">
        <TabsTrigger value={value}>{children}</TabsTrigger>
      </span>
    </Tooltip>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="space-y-1.5">
      <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-surface-inset p-3 text-xs leading-relaxed">
        <code className="whitespace-pre">{code}</code>
      </pre>
      <div className="flex justify-end">
        <CopyButton value={code} />
      </div>
    </div>
  );
}
