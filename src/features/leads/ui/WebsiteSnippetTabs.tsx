"use client";

import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { CopyButton } from "@/components/shared/CopyButton";
import { buildWebsiteSnippets } from "../domain/websiteSnippets";

/**
 * The reveal-once panel shown after a website is connected: the key itself,
 * then three ways to wire the site up, each ready to paste.
 */
export function WebsiteSnippetTabs({ apiBaseUrl, plaintext }: { apiBaseUrl: string; plaintext: string }) {
  const s = buildWebsiteSnippets({ baseUrl: apiBaseUrl, key: plaintext });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700/40 dark:bg-amber-950/40">
        <p className="font-medium text-foreground">Copy this key now — it won&apos;t be shown again.</p>
        <p className="mt-1 text-xs text-foreground-secondary">
          It can only add leads to your agency; it can&apos;t read anything. If it&apos;s ever exposed,
          disconnect this website and connect it again.
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <code
            data-testid="website-key-plaintext"
            className="min-w-0 flex-1 break-all rounded bg-surface-card px-2 py-1 text-xs"
          >
            {plaintext}
          </code>
          <CopyButton value={plaintext} label="Copy key" />
        </div>
      </div>

      <Tabs defaultValue="plugin">
        <TabsList>
          <TabTrigger
            value="plugin"
            tooltip="For a website built with a form plugin (Elementor, Contact Form 7, Webflow, Wix) or connected through Zapier or Make. No code needed."
          >
            Form plugin / Zapier
          </TabTrigger>
          <TabTrigger
            value="api"
            tooltip="For a website looked after by a developer: one call from the form's server code. The key never appears in the page."
          >
            Developer API
          </TabTrigger>
          <TabTrigger
            value="html"
            tooltip="For a simple website where you can edit the HTML but there's no server code or form plugin."
          >
            HTML form
          </TabTrigger>
        </TabsList>

        <TabsContent value="plugin" className="space-y-3">
          <p className="text-sm text-foreground-secondary">
            Paste this URL into your form plugin&apos;s <strong>webhook</strong> setting, or a Zapier/Make
            &quot;POST&quot; step. Name your fields <code>name</code>, <code>email</code>, <code>phone</code> and{" "}
            <code>message</code> — common names like <code>your-name</code> or <code>Email</code> work too, and
            any other field is added to the lead&apos;s message.
          </p>
          <CodeBlock code={s.webhookUrl} copyLabel="Copy URL" />
          <p className="text-xs text-foreground-muted">
            To check the connection without saving a lead, send an extra field <code>test</code> set to{" "}
            <code>true</code>.
          </p>
        </TabsContent>

        <TabsContent value="api" className="space-y-3">
          <p className="text-sm text-foreground-secondary">
            Send a JSON <code>POST</code> to <code>{s.endpoint}</code> with the key in an{" "}
            <code>Authorization: Bearer</code> header. Include your own <code>external_id</code> for each
            submission so a retry never creates a duplicate. Your developer can ask Harbor support for
            the full API reference.
          </p>
          <CodeBlock code={s.curl} />
          <CodeBlock code={s.nodeFetch} />
          <CodeBlock code={s.php} />
        </TabsContent>

        <TabsContent value="html" className="space-y-3">
          <p className="text-sm text-foreground-secondary">
            Replace your enquiry form&apos;s opening tag with this one, or start from the whole example. After
            sending, the visitor goes to your <code>_redirect</code> page — it must be on the same website.
          </p>
          <div className="flex gap-2 rounded-lg border border-border bg-surface-inset p-3 text-xs text-foreground-secondary">
            <ShieldAlert className="h-4 w-4 shrink-0 text-foreground-muted" />
            <p>
              The key is visible in your page&apos;s source here. That&apos;s acceptable because it can only add
              leads, and the hidden <code>_gotcha</code> field plus rate limits keep most spam out — but prefer the
              developer API if you have one.
            </p>
          </div>
          <CodeBlock code={s.htmlForm} />
        </TabsContent>
      </Tabs>
    </div>
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

function CodeBlock({ code, copyLabel = "Copy" }: { code: string; copyLabel?: string }) {
  return (
    <div className="space-y-1.5">
      <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-surface-inset p-3 text-xs leading-relaxed">
        <code className="whitespace-pre">{code}</code>
      </pre>
      <div className="flex justify-end">
        <CopyButton value={code} label={copyLabel} />
      </div>
    </div>
  );
}
