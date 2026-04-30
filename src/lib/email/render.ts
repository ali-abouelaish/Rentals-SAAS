import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import { signPreferenceToken } from "@/lib/preferences/token";
import type { AgencyBranding } from "./branding";

Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);

export type RentEmailContext = {
  agency: {
    name: string;
    logo_url: string | null;
    primary_color: string;
    accent_color: string;
    footer_address: string;
  };
  tenant: {
    id: string;
    name: string;
  };
  property: {
    address: string;
  };
  amount: string;
  dueDate: string;
  daysOverdue?: number;
  preferenceUrl: string;
};

export type CommunicationRequestEmailContext = {
  agency: {
    name: string;
    logo_url: string | null;
    primary_color: string;
    accent_color: string;
  };
  tenant: { name: string };
  property: { address: string };
  requestTypeLabel: string;
  summary: string;
  requestUrl: string;
};

const TEMPLATES_DIR = path.join(process.cwd(), "emails");

function compile<T>(filename: string): HandlebarsTemplateDelegate<T> {
  const src = fs.readFileSync(path.join(TEMPLATES_DIR, filename), "utf8");
  return Handlebars.compile<T>(src, { noEscape: false });
}

let dueTpl: HandlebarsTemplateDelegate<RentEmailContext> | null = null;
let overdueTpl: HandlebarsTemplateDelegate<RentEmailContext> | null = null;
let commTpl: HandlebarsTemplateDelegate<CommunicationRequestEmailContext> | null = null;

function loadDue() {
  if (!dueTpl) dueTpl = compile<RentEmailContext>("rent-due.hbs");
  return dueTpl;
}
function loadOverdue() {
  if (!overdueTpl) overdueTpl = compile<RentEmailContext>("rent-overdue.hbs");
  return overdueTpl;
}
function loadCommunication() {
  if (!commTpl) commTpl = compile<CommunicationRequestEmailContext>("tenant-communication-request.hbs");
  return commTpl;
}

export const templates = {
  rentDue: (ctx: RentEmailContext) => loadDue()(ctx),
  rentOverdue: (ctx: RentEmailContext) => loadOverdue()(ctx),
  communicationRequest: (ctx: CommunicationRequestEmailContext) => loadCommunication()(ctx),
};

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 2,
});

export function formatAmount(value: number): string {
  return GBP.format(value);
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatDueDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return DATE_FMT.format(d);
}

export type RenderOptions = {
  branding: AgencyBranding;
  agencyName: string;
  pmTenantName: string;
  pmTenantId: string;
  propertyAddress: string;
  amountPence: number;
  dueDate: Date;
  daysOverdue?: number;
  appUrl: string;
};

/**
 * Build a signed preferences URL. The signed token replaces the previous
 * raw-id link so old emails can't be replayed against the wrong tenant.
 */
export function buildPreferenceUrl(appUrl: string, pmTenantId: string): string {
  const token = signPreferenceToken(pmTenantId);
  return `${appUrl.replace(/\/$/, "")}/preferences/${token}`;
}

export function buildContext(opts: RenderOptions): RentEmailContext {
  return {
    agency: {
      name: opts.agencyName,
      logo_url: opts.branding.logo_url,
      primary_color: opts.branding.primary_color,
      accent_color: opts.branding.accent_color,
      footer_address: opts.branding.footer_address,
    },
    tenant: {
      id: opts.pmTenantId,
      name: opts.pmTenantName,
    },
    property: {
      address: opts.propertyAddress,
    },
    amount: formatAmount(opts.amountPence),
    dueDate: formatDueDate(opts.dueDate),
    daysOverdue: opts.daysOverdue,
    preferenceUrl: buildPreferenceUrl(opts.appUrl, opts.pmTenantId),
  };
}

/**
 * Plain-text alternate, written by hand rather than stripped from HTML so the
 * structure stays readable in clients without HTML rendering.
 */
export function renderPlainText(
  variant: "due" | "overdue",
  ctx: RentEmailContext
): string {
  const lines: string[] = [];
  lines.push(`Hi ${ctx.tenant.name},`);
  lines.push("");
  if (variant === "due") {
    lines.push(
      `This is a friendly reminder that rent of ${ctx.amount} is due on ${ctx.dueDate} for ${ctx.property.address}.`
    );
  } else {
    const days = ctx.daysOverdue ?? 0;
    lines.push(
      `Your rent of ${ctx.amount} for ${ctx.property.address} is now ${days} day${days === 1 ? "" : "s"} overdue (was due ${ctx.dueDate}).`
    );
    lines.push("Please make payment as soon as possible, or contact us if you need to discuss arrangements.");
  }
  lines.push("");
  lines.push(`If you have any questions, just reply to this email.`);
  lines.push("");
  lines.push(`Thanks,`);
  lines.push(ctx.agency.name);
  lines.push("");
  lines.push("---");
  if (ctx.agency.footer_address) lines.push(ctx.agency.footer_address);
  lines.push(`You're receiving this because you're a tenant at ${ctx.property.address}.`);
  lines.push(`Manage email preferences: ${ctx.preferenceUrl}`);
  return lines.join("\n");
}
