"use client";

import { useId, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { Field } from "@/features/helpdesk/ui/Field";
import { addQuickLink, updateQuickLink } from "../actions/quickLinks";
import { quickLinkSchema, type QuickLinkValues } from "../domain/schemas";
import { WORDPRESS_SIGN_IN_PATH } from "../domain/siteSignInSnippets";
import type { QuickLink } from "../data/queries";

export type SavedQuickLink = {
  id: string;
  title: string;
  sso_enabled: boolean;
  sso_callback_url: string | null;
  /** True when this save switched website sign-in on. */
  signInJustEnabled: boolean;
};

/** Add (no `link`) or edit a Useful Resources link, including its website sign-in settings. */
export function QuickLinkForm({
  link,
  onSaved,
  onCancel,
}: {
  link?: QuickLink;
  onSaved: (saved: SavedQuickLink) => void;
  onCancel?: () => void;
}) {
  const uid = useId();
  const [isPending, startTransition] = useTransition();

  const form = useForm<QuickLinkValues>({
    resolver: zodResolver(quickLinkSchema),
    defaultValues: {
      title: link?.title ?? "",
      url: link?.url ?? "",
      description: link?.description ?? "",
      sso_enabled: link?.sso_enabled ?? false,
      sso_callback_url: link?.sso_callback_url ?? "",
    },
  });
  const { errors } = form.formState;
  const ssoEnabled = form.watch("sso_enabled");

  const onSubmit = (values: QuickLinkValues) => {
    startTransition(async () => {
      let id: string;
      if (link) {
        const result = await updateQuickLink(link.id, values);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        id = link.id;
      } else {
        const result = await addQuickLink(values);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        id = result.id;
      }
      onSaved({
        id,
        title: values.title,
        sso_enabled: values.sso_enabled,
        sso_callback_url: values.sso_callback_url || null,
        signInJustEnabled: values.sso_enabled && !link?.sso_enabled,
      });
      if (!link) form.reset();
    });
  };

  const fieldProps = (name: keyof QuickLinkValues) => ({
    id: `${uid}-${name}`,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${uid}-${name}-error` : undefined,
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-3">
      <Field id={`${uid}-title`} label="Title" hint="Shown on the dashboard card. Max 60 characters." error={errors.title?.message}>
        <Input placeholder="e.g. Rightmove" autoComplete="off" {...fieldProps("title")} {...form.register("title")} />
      </Field>

      <Field
        id={`${uid}-url`}
        label="URL"
        hint="The full address, starting https://"
        error={errors.url?.message}
      >
        <Input type="url" placeholder="https://example.com" autoComplete="off" {...fieldProps("url")} {...form.register("url")} />
      </Field>

      <Field
        id={`${uid}-description`}
        label="Description (optional)"
        hint="One line under the title. Max 120 characters."
        error={errors.description?.message}
      >
        <Input placeholder="Short description" autoComplete="off" {...fieldProps("description")} {...form.register("description")} />
      </Field>

      <div className="rounded-xl border border-border p-3 space-y-3">
        <div className="flex items-start gap-2">
          <input
            id={`${uid}-sso_enabled`}
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-border"
            {...form.register("sso_enabled")}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <label htmlFor={`${uid}-sso_enabled`} className="text-sm font-medium text-foreground">
                Sign my team in to this website
              </label>
              <Tooltip content="For your agency's own website. Your team arrive signed in with their Harbor account, so the site doesn't need its own login page. Your web developer adds a small sign-in handler once.">
                <button
                  type="button"
                  aria-label="About website sign-in"
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-foreground-muted hover:text-foreground"
                >
                  <Info size={13} />
                </button>
              </Tooltip>
            </div>
            <p className="text-xs text-foreground-muted">
              Only for websites you control. Harbor shares each person&apos;s name, email and role with the site.
            </p>
          </div>
        </div>

        {ssoEnabled && (
          <Field
            id={`${uid}-sso_callback_url`}
            label="Sign-in URL"
            hint={`The address of your website's sign-in handler, starting https://. On WordPress it's your site address followed by ${WORDPRESS_SIGN_IN_PATH}`}
            tooltip="Harbor sends each sign-in here. It's usually different from the URL above: your developer sets it up, and the person then lands on the URL above."
            error={errors.sso_callback_url?.message}
          >
            <Input
              type="url"
              placeholder={`https://www.youragency.co.uk${WORDPRESS_SIGN_IN_PATH}`}
              autoComplete="off"
              {...fieldProps("sso_callback_url")}
              {...form.register("sso_callback_url")}
            />
          </Field>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="submit" variant="secondary" size="sm" loading={isPending}>
          {link ? "Save" : "Add link"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
