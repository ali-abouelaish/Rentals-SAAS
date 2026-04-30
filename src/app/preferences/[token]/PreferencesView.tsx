import type { CommunicationRequestRow, PreferenceContext } from "@/features/preferences/data/queries";
import {
  submitEmailChange,
  submitAlternativeFormat,
  submitDataAccess,
  submitOther,
} from "./actions";

const REQUEST_LABELS: Record<CommunicationRequestRow["request_type"], string> = {
  email_change: "Email change",
  alternative_format: "Alternative format",
  data_access: "Data access (GDPR)",
  other: "Other request",
};

const STATUS_STYLES: Record<CommunicationRequestRow["status"], string> = {
  pending:   "bg-amber-100 text-amber-800",
  approved:  "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  rejected:  "bg-slate-200 text-slate-700",
};

const STATUS_LABELS: Record<CommunicationRequestRow["status"], string> = {
  pending:   "Pending review",
  approved:  "Approved",
  completed: "Completed",
  rejected:  "Declined",
};

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

type Props = {
  ctx: PreferenceContext;
  requests: CommunicationRequestRow[];
  token: string;
  doneCode: string | null;
  errorCode: string | null;
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_link: "This link is no longer valid. Please contact your letting agent for a fresh one.",
  bad_email: "Please enter a valid email address.",
  bad_format: "Please choose a delivery format.",
  missing_notes: "Please tell us what you need before submitting.",
};

const DONE_MESSAGES: Record<string, string> = {
  email_change: "Thanks. Your email change request has been sent to your agency.",
  alternative_format: "Thanks. Your format request has been sent to your agency.",
  data_access: "Thanks. Your data access request has been sent to your agency.",
  other: "Thanks. Your request has been sent to your agency.",
};

export function PreferencesView({ ctx, requests, token, doneCode, errorCode }: Props) {
  const { branding, agencyName, pmTenantFirstName, pmTenantEmail, propertyAddress } = ctx;

  return (
    <main
      className="min-h-screen px-4 py-8 sm:py-12"
      style={{ backgroundColor: "#f4f4f7" }}
    >
      <div className="mx-auto w-full max-w-xl space-y-5">
        {doneCode && DONE_MESSAGES[doneCode] && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            {DONE_MESSAGES[doneCode]}
          </div>
        )}
        {errorCode && ERROR_MESSAGES[errorCode] && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            {ERROR_MESSAGES[errorCode]}
          </div>
        )}
        <header className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            {branding.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logo_url}
                alt={agencyName}
                className="h-12 w-12 rounded-lg object-contain"
              />
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-lg text-base font-bold text-white"
                style={{ backgroundColor: branding.primary_color }}
              >
                {agencyName.charAt(0).toUpperCase() || "A"}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">{agencyName}</div>
              <div className="text-xs text-slate-500">Email preferences</div>
            </div>
          </div>
        </header>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h1
            className="text-xl font-semibold leading-tight"
            style={{ color: branding.primary_color }}
          >
            Hi {pmTenantFirstName || "there"},
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {propertyAddress
              ? `Manage your communication preferences for ${propertyAddress}.`
              : "Manage your communication preferences."}
          </p>
        </section>

        <section
          className="rounded-2xl border p-5"
          style={{ backgroundColor: "#fffbeb", borderColor: "#fde68a" }}
        >
          <h2 className="text-sm font-semibold text-amber-900">Why you can't unsubscribe</h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-900/90">
            Rent reminders are part of the formal notice process under your tenancy agreement,
            so they cannot be disabled. You can still update where they're sent and request
            another format below, and {agencyName} will action your request as soon as they can.
          </p>
        </section>

        <FormCard title="Update your email address">
          <form action={submitEmailChange} className="space-y-3">
            <input type="hidden" name="token" value={token} />
            <div>
              <label htmlFor="current_email" className="mb-1 block text-xs font-medium text-slate-600">
                Current email
              </label>
              <input
                id="current_email"
                value={pmTenantEmail}
                readOnly
                className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
              />
            </div>
            <div>
              <label htmlFor="requested_email" className="mb-1 block text-xs font-medium text-slate-600">
                New email address
              </label>
              <input
                id="requested_email"
                name="requested_email"
                type="email"
                required
                placeholder="you@example.com"
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              {agencyName} will review this request and confirm with you. Until they approve, reminders continue to your current address.
            </p>
            <SubmitButton color={branding.accent_color}>Request change</SubmitButton>
          </form>
        </FormCard>

        <FormCard title="Request a different format">
          <form action={submitAlternativeFormat} className="space-y-3">
            <input type="hidden" name="token" value={token} />
            <fieldset className="space-y-2">
              <legend className="mb-1 block text-xs font-medium text-slate-600">Preferred format</legend>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <input type="radio" name="format" value="postal" required className="accent-slate-900" />
                Postal post
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <input type="radio" name="format" value="sms" className="accent-slate-900" />
                SMS / text message
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <input type="radio" name="format" value="other" className="accent-slate-900" />
                Other
              </label>
            </fieldset>
            <div>
              <label htmlFor="alt_notes" className="mb-1 block text-xs font-medium text-slate-600">
                Notes (optional)
              </label>
              <textarea
                id="alt_notes"
                name="notes"
                rows={3}
                placeholder="Anything {agencyName} should know"
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <SubmitButton color={branding.accent_color}>Send request</SubmitButton>
          </form>
        </FormCard>

        <FormCard title="Request a copy of your reminder history">
          <p className="mb-3 text-sm leading-relaxed text-slate-600">
            Under UK GDPR (Article 15), you can request a copy of every reminder we have on file
            for you. {agencyName} will send this to your current email address.
          </p>
          <form action={submitDataAccess}>
            <input type="hidden" name="token" value={token} />
            <SubmitButton color={branding.accent_color}>Request my reminder history</SubmitButton>
          </form>
        </FormCard>

        <FormCard title="Other request">
          <form action={submitOther} className="space-y-3">
            <input type="hidden" name="token" value={token} />
            <div>
              <label htmlFor="other_notes" className="mb-1 block text-xs font-medium text-slate-600">
                Tell us what you need
              </label>
              <textarea
                id="other_notes"
                name="notes"
                required
                rows={4}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <SubmitButton color={branding.accent_color}>Submit</SubmitButton>
          </form>
        </FormCard>

        <FormCard title="Past requests">
          {requests.length === 0 ? (
            <p className="text-sm text-slate-500">You haven't submitted any requests yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {requests.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900">{REQUEST_LABELS[r.request_type]}</div>
                    <div className="text-xs text-slate-500">{DATE_FMT.format(new Date(r.created_at))}</div>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[r.status]}`}
                  >
                    {STATUS_LABELS[r.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </FormCard>

        <footer className="space-y-2 px-1 pb-2 text-center text-xs text-slate-500">
          <div className="font-medium text-slate-700">{agencyName}</div>
          {branding.footer_address && <div>{branding.footer_address}</div>}
          {branding.reply_to_email && (
            <div>
              Contact: <a href={`mailto:${branding.reply_to_email}`} className="underline">{branding.reply_to_email}</a>
            </div>
          )}
          <div className="pt-2 text-[11px] text-slate-400">Powered by Harbor Ops</div>
        </footer>
      </div>
    </main>
  );
}

function FormCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function SubmitButton({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
      style={{ backgroundColor: color }}
    >
      {children}
    </button>
  );
}
