"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  INTEGRATIONS,
  formatIntegrationPrice,
  type Integration,
  type IntegrationKey,
} from "@/lib/integrations/catalog";
import type { IntegrationSubscription } from "@/lib/integrations/subscriptions";
import {
  activateIntegrationSchema,
  cancelIntegrationSchema,
  type ActivateIntegrationInput,
  type CancelIntegrationInput,
} from "../domain/schemas";
import {
  activateIntegrationAction,
  cancelIntegrationAction,
} from "../actions/subscriptions";
import { IntegrationCard } from "./IntegrationCard";
import { IntegrationLogo } from "./IntegrationLogo";

export function IntegrationsManager({
  subscriptions,
}: {
  /** Serialised from the server component — a Map doesn't cross the boundary. */
  subscriptions: Record<string, IntegrationSubscription>;
}) {
  const router = useRouter();
  const [activating, setActivating] = useState<Integration | null>(null);
  const [cancelling, setCancelling] = useState<Integration | null>(null);

  const grouped = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        items: INTEGRATIONS.filter((i) => i.category === category),
      })).filter((group) => group.items.length > 0),
    []
  );

  return (
    <>
      <div className="space-y-6">
        {grouped.map((group) => (
          <section key={group.category}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-2">
              {CATEGORY_LABELS[group.category]}
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {group.items.map((integration) => (
                <IntegrationCard
                  key={integration.key}
                  integration={integration}
                  subscription={subscriptions[integration.key]}
                  onActivate={() => setActivating(integration)}
                  onCancel={() => setCancelling(integration)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <ActivateDialog
        integration={activating}
        onClose={() => setActivating(null)}
        onDone={() => {
          setActivating(null);
          router.refresh();
        }}
      />
      <CancelDialog
        integration={cancelling}
        onClose={() => setCancelling(null)}
        onDone={() => {
          setCancelling(null);
          router.refresh();
        }}
      />
    </>
  );
}

function ActivateDialog({
  integration,
  onClose,
  onDone,
}: {
  integration: Integration | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const {
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = useForm<ActivateIntegrationInput>({
    resolver: zodResolver(activateIntegrationSchema),
    // integrationKey has no input on this form — it comes from the card that
    // opened the dialog. Without a default, the resolver would fail a key the
    // user cannot see or fix, and handleSubmit would never fire.
    values: {
      integrationKey: (integration?.key ?? "") as IntegrationKey,
      acceptCharge: false as true,
    },
  });

  if (!integration) return null;

  const isFree = integration.monthlyPricePence <= 0;

  const onSubmit = (values: ActivateIntegrationInput) => {
    startTransition(async () => {
      const result = await activateIntegrationAction({
        integrationKey: values.integrationKey,
        acceptCharge: values.acceptCharge,
      });
      if ("error" in result) {
        toast.error("Could not activate", { description: result.error });
        return;
      }
      toast.success(result.message);
      reset();
      onDone();
    });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <IntegrationLogo integration={integration} />
              <DialogTitle>Activate {integration.name}</DialogTitle>
            </div>
            <DialogDescription>
              {isFree
                ? "Included in your plan at no extra cost."
                : `${formatIntegrationPrice(integration.monthlyPricePence)}, added to your next monthly invoice. Nothing is charged today and no card is needed.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {integration.setupNote && (
              <p className="rounded-lg bg-surface-inset p-3 text-xs leading-relaxed text-foreground-secondary">
                {integration.setupNote}
              </p>
            )}

            <div>
              <label
                htmlFor="acceptCharge"
                className="flex items-start gap-2 text-sm text-foreground cursor-pointer"
              >
                <input
                  id="acceptCharge"
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border accent-[var(--brand)]"
                  {...register("acceptCharge")}
                />
                <span>
                  {isFree
                    ? "Turn this on for my agency"
                    : `I agree to ${formatIntegrationPrice(integration.monthlyPricePence)} being added to my agency's invoice`}
                </span>
              </label>
              <p className="mt-1 ml-6 text-[11px] text-foreground-muted">
                {isFree
                  ? "You can turn it off again at any time."
                  : "Charged monthly from the 1st of next month. Cancel any time — you keep access to the end of the month you cancel in."}
              </p>
              {errors.acceptCharge && (
                <p className="mt-1 ml-6 text-[11px] text-red-600">
                  {errors.acceptCharge.message}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                reset();
                onClose();
              }}
            >
              Not now
            </Button>
            <Button type="submit" variant="secondary" size="sm" loading={isPending}>
              {isFree ? "Turn on" : "Activate and bill me"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  integration,
  onClose,
  onDone,
}: {
  integration: Integration | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const {
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = useForm<CancelIntegrationInput>({
    resolver: zodResolver(cancelIntegrationSchema),
    values: {
      integrationKey: (integration?.key ?? "") as IntegrationKey,
      reason: "",
    },
  });

  if (!integration) return null;

  const onSubmit = (values: CancelIntegrationInput) => {
    startTransition(async () => {
      const result = await cancelIntegrationAction({
        integrationKey: values.integrationKey,
        reason: values.reason,
      });
      if ("error" in result) {
        toast.error("Could not cancel", { description: result.error });
        return;
      }
      toast.success(result.message);
      reset();
      onDone();
    });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <IntegrationLogo integration={integration} />
              <DialogTitle>Cancel {integration.name}?</DialogTitle>
            </div>
            <DialogDescription>
              You keep access until the end of this month, then the feature turns
              off and the charge stops. Anything already sent or registered stays
              where it is.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1 py-2">
            <label htmlFor="reason" className="block text-xs font-medium text-foreground">
              Why are you cancelling?
            </label>
            <p className="text-[11px] text-foreground-muted">
              Optional. Max 500 characters — it helps us fix what isn&apos;t working.
            </p>
            <Textarea id="reason" rows={3} {...register("reason")} />
            {errors.reason && (
              <p className="text-[11px] text-red-600">{errors.reason.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                reset();
                onClose();
              }}
            >
              Keep it
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={isPending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Cancel subscription
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
