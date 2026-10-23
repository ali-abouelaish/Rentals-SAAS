"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { Field } from "@/features/helpdesk/ui/Field";
import { websiteConnectionSchema, type WebsiteConnectionValues } from "../domain/schemas";
import { createWebsiteConnection } from "../actions/websiteLeads";
import { WebsiteSnippetTabs } from "./WebsiteSnippetTabs";

/**
 * Two steps in one dialog: name the website, then — once its key is minted —
 * the reveal-once panel. While the key is showing, clicking outside or
 * pressing Escape doesn't close the dialog, so the key can't be lost by
 * accident; only "Done" or the close button dismisses it.
 */
export function ConnectWebsiteDialog({ apiBaseUrl }: { apiBaseUrl: string }) {
  const [open, setOpen] = useState(false);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<WebsiteConnectionValues>({
    resolver: zodResolver(websiteConnectionSchema),
    defaultValues: { label: "" },
  });
  const labelError = form.formState.errors.label?.message;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setPlaintext(null);
      form.reset();
    }
  };

  const onSubmit = (values: WebsiteConnectionValues) => {
    startTransition(async () => {
      const result = await createWebsiteConnection(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPlaintext(result.plaintext);
      toast.success("Website connected");
    });
  };

  const keepOpenWhileKeyShows = (event: Event) => {
    if (plaintext) event.preventDefault();
  };

  return (
    <>
      <Tooltip content="Each website gets its own key, so you can see which site an enquiry came from — and disconnect one without touching the others.">
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Connect a website
        </Button>
      </Tooltip>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="md:max-w-2xl"
          onInteractOutside={keepOpenWhileKeyShows}
          onEscapeKeyDown={keepOpenWhileKeyShows}
        >
          {plaintext ? (
            <>
              <DialogHeader>
                <DialogTitle>Website connected</DialogTitle>
                <DialogDescription>
                  Choose how your website will send enquiries and paste the snippet in. Each one arrives on your
                  Leads page with a &quot;Website&quot; badge.
                </DialogDescription>
              </DialogHeader>
              <WebsiteSnippetTabs apiBaseUrl={apiBaseUrl} plaintext={plaintext} />
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
              <DialogHeader>
                <DialogTitle>Connect a website</DialogTitle>
                <DialogDescription>
                  Harbor creates a key that can only add leads. You&apos;ll see it once, with copy-and-paste
                  instructions for your site.
                </DialogDescription>
              </DialogHeader>
              <Field
                id="website-label"
                label="Website name"
                hint='Shown on every lead this site sends, e.g. "Main website". 2–80 characters.'
                tooltip="If you have more than one site, name each one so you can tell their enquiries apart on the Leads page."
                error={labelError}
              >
                <Input
                  id="website-label"
                  autoComplete="off"
                  aria-invalid={labelError ? true : undefined}
                  aria-describedby={labelError ? "website-label-error" : undefined}
                  {...form.register("label")}
                />
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="secondary" loading={isPending}>
                  Connect website
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
