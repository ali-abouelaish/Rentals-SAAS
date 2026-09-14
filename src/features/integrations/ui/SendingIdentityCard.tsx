"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Info, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import type {
  ESigningAgencyIdentity,
  ESigningBrandSource,
} from "../data/esigning";
import {
  requestSenderIdentitySchema,
  type RequestSenderIdentityInput,
} from "../domain/esigningSchemas";
import {
  applyAgencyBrandingAction,
  refreshSenderIdentityAction,
  removeSenderIdentityAction,
  requestSenderIdentityAction,
  resendSenderIdentityAction,
  resyncAgencyBrandingAction,
} from "../actions/esigning";

type Result = { error: string } | { success: true; message: string };

function Pill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "muted";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone === "ok" && "bg-emerald-100 text-emerald-800",
        tone === "warn" && "bg-amber-100 text-amber-800",
        tone === "muted" && "bg-neutral-200 text-neutral-700"
      )}
    >
      {children}
    </span>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function SendingIdentityCard({
  identity,
  source,
}: {
  identity: ESigningAgencyIdentity | null;
  source: ESigningBrandSource | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showIdentityForm, setShowIdentityForm] = useState(false);

  const run = (action: () => Promise<Result>) => {
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  };

  const hasBrand = Boolean(identity?.brandId);
  // BoldSign requires a logo to create a brand at all, so this is a hard
  // prerequisite rather than a nice-to-have — say so before they press a
  // button that can only fail.
  const missingLogo = !source?.logoUrl;
  const identityState = identity?.senderIdentityState ?? "none";

  return (
    <section className="rounded-xl border border-border bg-surface-card p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Sending identity</h2>
        <p className="text-xs text-foreground-secondary mt-0.5">
          What your tenants, landlords and contractors see when a document
          arrives from you.
        </p>
      </div>

      {identity?.lastError && (
        <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-700" aria-hidden />
          <p className="text-[11px] text-amber-900 leading-relaxed">
            Last attempt failed: {identity.lastError}
          </p>
        </div>
      )}

      {/* ---------------- Branding ---------------- */}
      <div className="rounded-lg border border-border p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">Branding</p>
            <p className="text-[11px] text-foreground-muted mt-0.5">
              Your logo, colour and agency name on the signing page and the
              email that carries it.
            </p>
          </div>
          {hasBrand ? (
            <Pill tone={identity!.brandingIsStale ? "warn" : "ok"}>
              {identity!.brandingIsStale ? "Out of date" : (
                <>
                  <Check className="h-3 w-3" aria-hidden />
                  Applied
                </>
              )}
            </Pill>
          ) : (
            <Pill tone="muted">Using default</Pill>
          )}
        </div>

        {hasBrand && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-foreground-secondary">
            {source?.primaryColor && (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded-full border border-border"
                  style={{ backgroundColor: source.primaryColor }}
                  aria-hidden
                />
                {source.primaryColor}
              </span>
            )}
            <span>{identity!.brandName}</span>
            {identity!.lastSyncedAt && <span>Updated {formatDate(identity!.lastSyncedAt)}</span>}
          </div>
        )}

        {identity?.brandingIsStale && (
          <p className="mt-2 rounded bg-surface-inset p-2 text-[11px] text-foreground-secondary leading-relaxed">
            You&apos;ve changed your logo, name or colour in Harbor Ops since this
            was last applied. Documents are still going out with the old version
            until you update it.
          </p>
        )}

        {missingLogo && !hasBrand && (
          <p className="mt-2 flex gap-2 rounded bg-surface-inset p-2 text-[11px] text-foreground-secondary leading-relaxed">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
            <span>
              Your agency has no logo set, and the signing provider requires one
              before your branding can be applied. Ask us to upload your logo,
              then come back here.
            </span>
          </p>
        )}

        <div className="mt-3">
          <Tooltip
            content={
              missingLogo && !hasBrand
                ? "A logo is required before branding can be applied."
                : hasBrand
                  ? "Pushes your current Harbor Ops branding to the signing provider."
                  : "Applies your logo, colour and agency name to every document you send for signature."
            }
          >
            <span className="inline-block">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={isPending}
                disabled={missingLogo && !hasBrand}
                onClick={() =>
                  run(hasBrand ? resyncAgencyBrandingAction : applyAgencyBrandingAction)
                }
              >
                {hasBrand ? "Update branding" : "Apply my branding"}
              </Button>
            </span>
          </Tooltip>
          <p className="mt-1 text-[11px] text-foreground-muted">
            {hasBrand
              ? "Re-reads your Harbor Ops branding and applies it."
              : "Taken from the branding already set up on your account — nothing new to fill in."}
          </p>
        </div>
      </div>

      {/* ---------------- Sender address ---------------- */}
      <div className="rounded-lg border border-border p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">Send from your own address</p>
            <p className="text-[11px] text-foreground-muted mt-0.5">
              Optional. Makes the signing request arrive from your agency&apos;s
              mailbox instead of ours, so replies reach you.
            </p>
          </div>
          {identityState === "verified" && (
            <Pill tone="ok">
              <Check className="h-3 w-3" aria-hidden />
              Verified
            </Pill>
          )}
          {identityState === "pending" && <Pill tone="warn">Awaiting verification</Pill>}
          {identityState === "declined" && <Pill tone="warn">Declined</Pill>}
          {identityState === "unknown" && <Pill tone="warn">Unknown status</Pill>}
          {identityState === "none" && <Pill tone="muted">Not set up</Pill>}
        </div>

        {identity?.senderIdentityEmail && (
          <p className="mt-2 text-xs text-foreground">{identity.senderIdentityEmail}</p>
        )}

        {identityState === "pending" && (
          <p className="mt-2 rounded bg-surface-inset p-2 text-[11px] text-foreground-secondary leading-relaxed">
            We&apos;ve emailed that address a verification link
            {identity?.senderIdentityRequestedAt && (
              <> on {formatDate(identity.senderIdentityRequestedAt)}</>
            )}
            . Someone with access to the mailbox needs to open it. Until then
            documents keep sending from the default address — nothing is broken
            in the meantime.
          </p>
        )}

        {identityState === "declined" && (
          <p className="mt-2 rounded bg-surface-inset p-2 text-[11px] text-foreground-secondary leading-relaxed">
            The signing provider won&apos;t send from that address. Request it
            again if that was a mistake, or try a different mailbox.
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {identityState === "none" && !showIdentityForm && (
            <Tooltip content="We'll email the address a verification link. Nothing changes until someone opens it.">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowIdentityForm(true)}
              >
                Use my own address
              </Button>
            </Tooltip>
          )}

          {(identityState === "pending" || identityState === "unknown") && (
            <>
              <Tooltip content="Checks with the signing provider. Verification happens by email, so nothing tells us automatically.">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={isPending}
                  onClick={() => run(refreshSenderIdentityAction)}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Check again
                </Button>
              </Tooltip>
              <Tooltip content="Sends the verification email again, in case it was lost.">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={isPending}
                  onClick={() => run(resendSenderIdentityAction)}
                >
                  Resend email
                </Button>
              </Tooltip>
            </>
          )}

          {identityState === "declined" && (
            <Tooltip content="Sends a fresh verification request to that address.">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowIdentityForm(true)}
              >
                Request again
              </Button>
            </Tooltip>
          )}

          {identityState === "verified" && (
            <Tooltip content="Re-checks the address is still approved by the signing provider.">
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={isPending}
                onClick={() => run(refreshSenderIdentityAction)}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Re-check
              </Button>
            </Tooltip>
          )}

          {identity?.senderIdentityEmail && (
            <Tooltip content="Stops using your address. Documents go back to sending from the default one; nothing already sent is affected.">
              <Button
                type="button"
                size="sm"
                loading={isPending}
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={() => run(removeSenderIdentityAction)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Remove
              </Button>
            </Tooltip>
          )}
        </div>

        {showIdentityForm && (
          <SenderIdentityForm
            defaultName={source?.displayName ?? ""}
            onCancel={() => setShowIdentityForm(false)}
            onDone={() => {
              setShowIdentityForm(false);
              router.refresh();
            }}
          />
        )}
      </div>
    </section>
  );
}

function SenderIdentityForm({
  defaultName,
  onCancel,
  onDone,
}: {
  defaultName: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestSenderIdentityInput>({
    resolver: zodResolver(requestSenderIdentitySchema),
    defaultValues: {
      email: "",
      displayName: defaultName,
      acknowledgeVerification: false as true,
    },
  });

  const onSubmit = (values: RequestSenderIdentityInput) => {
    startTransition(async () => {
      const result = await requestSenderIdentityAction(values);
      if ("error" in result) {
        toast.error("Could not request verification", { description: result.error });
        return;
      }
      toast.success(result.message);
      onDone();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-3 space-y-3 rounded-lg bg-surface-inset p-3">
      <div>
        <label htmlFor="senderEmail" className="block text-xs font-medium text-foreground">
          Send documents from
        </label>
        <p className="text-[11px] text-foreground-muted mt-0.5 mb-1">
          A real, monitored mailbox at your agency — e.g. lettings@youragency.co.uk.
          Replies from tenants come back here.
        </p>
        <Input id="senderEmail" type="email" autoComplete="email" {...register("email")} />
        {errors.email && (
          <p className="mt-1 text-[11px] text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="senderName" className="block text-xs font-medium text-foreground">
          Name recipients see
        </label>
        <p className="text-[11px] text-foreground-muted mt-0.5 mb-1">
          Usually your agency name. 2–100 characters.
        </p>
        <Input id="senderName" {...register("displayName")} />
        {errors.displayName && (
          <p className="mt-1 text-[11px] text-red-600">{errors.displayName.message}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="acknowledgeVerification"
          className="flex items-start gap-2 text-xs text-foreground cursor-pointer"
        >
          <input
            id="acknowledgeVerification"
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-border accent-[var(--brand)]"
            {...register("acknowledgeVerification")}
          />
          <span>
            I understand a verification email will be sent to this address, and
            someone needs to open it
          </span>
        </label>
        <p className="mt-1 ml-6 text-[11px] text-foreground-muted">
          Nothing changes until it&apos;s confirmed — documents keep sending as they do now.
        </p>
        {errors.acknowledgeVerification && (
          <p className="mt-1 ml-6 text-[11px] text-red-600">
            {errors.acknowledgeVerification.message}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" variant="secondary" size="sm" loading={isPending}>
          Send verification email
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
