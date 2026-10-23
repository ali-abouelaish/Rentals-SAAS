// Turns a website enquiry — whatever a hand-written site, a form plugin or an
// automation tool posts — into one predictable lead. Only zod and node:crypto
// at runtime, so the node --test suite can import it directly:
//
//   npm test
//
// The rules are deliberately lenient. Form plugins fire and forget: a 400
// sent back to one is an enquiry silently lost. So anything a visitor typed
// that can't go in its own column is kept as a "Label: value" line in the
// message instead, and the only hard failure is having no way to contact the
// person at all.

import { createHash } from "node:crypto";
import { z } from "zod";

/** One submitted field, in arrival order. */
export type Pair = { key: string; value: string };

export type Extra = { label: string; value: string };

export type WebsiteLeadWarning =
  | "name_missing"
  | "email_invalid"
  | "phone_invalid"
  | "page_url_invalid"
  | "listing_id_invalid"
  | "listing_not_found"
  | "message_truncated"
  | "fields_truncated"
  | "files_ignored";

export const MAX_NAME = 200;
export const MAX_MESSAGE = 5000;
export const MAX_EXTRAS = 100;
export const MAX_EXTRA_VALUE = 1000;
/** Visitor message plus every extra field, as stored in leads.message_text. */
export const MAX_MESSAGE_TEXT = 10000;
/** Raw fields read from one body before anything is looked at. */
const MAX_RAW_PAIRS = 300;
/** Name given to an enquiry that arrived without one. */
export const FALLBACK_NAME = "Website enquiry";

type CanonicalField =
  | "name"
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "message"
  | "listing_id"
  | "property_ref"
  | "property_address"
  | "page_url"
  | "external_id"
  | "form_name";

/**
 * The field names each column is recognised by, after normalising —
 * lowercase, letters and digits only, so "Your-Name", "your_name" and
 * "yourName" are all "yourname". Covers hand-written forms, Contact Form 7
 * ("your-name"), Elementor and Webflow labels ("Name", "Email") and common
 * phrasing. Never bare "id": in plugin payloads that is the form's id.
 *
 * A visitor's own address or postcode is deliberately absent: leads.address is
 * shown as "Property address", so theirs is kept in the message instead.
 */
export const FIELD_ALIASES: Record<CanonicalField, readonly string[]> = {
  name: [
    "name", "fullname", "yourname", "yourfullname", "contactname", "customername",
    "clientname", "enquirername", "applicantname", "visitorname",
  ],
  first_name: ["firstname", "fname", "givenname", "forename", "yourfirstname"],
  last_name: ["lastname", "lname", "surname", "familyname", "yourlastname", "yoursurname"],
  email: ["email", "emailaddress", "youremail", "youremailaddress", "mail", "contactemail"],
  phone: [
    "phone", "phonenumber", "phoneno", "yourphone", "yourphonenumber", "telephone",
    "telephonenumber", "yourtelephone", "tel", "yourtel", "telno", "mobile", "mobilenumber",
    "mobilephone", "mobileno", "yourmobile", "cell", "cellphone", "contactnumber", "contactphone",
  ],
  message: [
    "message", "yourmessage", "comments", "comment", "yourcomments", "enquiry", "yourenquiry",
    "inquiry", "yourinquiry", "enquirydetails", "details", "notes", "question", "msg", "body",
    "additionalinformation", "additionalinfo",
  ],
  listing_id: ["listingid", "harborlistingid"],
  property_ref: [
    "propertyref", "propertyreference", "ref", "reference", "listingref", "listingreference",
    "propertyid", "propertycode", "roomref",
  ],
  property_address: [
    "propertyaddress", "property", "propertytitle", "propertyname", "listingtitle", "listingaddress",
  ],
  page_url: [
    "pageurl", "url", "pageuri", "page", "referrer", "referer", "sourceurl", "formurl", "landingpage",
  ],
  external_id: [
    "externalid", "submissionid", "entryid", "leadid", "responseid", "formentryid", "enquiryid",
  ],
  form_name: ["formname", "formtitle", "form"],
};

const ALIAS_INDEX = new Map<string, CanonicalField>(
  (Object.entries(FIELD_ALIASES) as [CanonicalField, readonly string[]][]).flatMap(
    ([field, aliases]) => aliases.map((alias) => [alias, field] as const)
  )
);

/** Wrapper objects form builders nest the submitted fields inside (normalised). */
const CONTAINER_KEYS = new Set([
  "data", "fields", "payload", "submission", "submissions", "entry", "formdata", "values",
]);

/** Control fields, matched on the exact key (case-insensitive). */
const HONEYPOT_KEYS = new Set(["_gotcha", "_honeypot"]);
const REDIRECT_KEYS = new Set(["_redirect", "_next"]);
const TEST_KEYS = new Set(["test", "_test"]);

/** Plugin plumbing and credentials — never part of what the visitor typed. */
const DROP_EXACT = new Set([
  "action", "submit", "formid", "postid", "queriedid", "referertitle", "useragent", "remoteip",
  "poweredby", "key", "apikey", "xapikey", "authorization",
]);
const DROP_CONTAINING = ["captcha", "turnstile", "nonce", "token", "secret", "password", "csrf"];

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

// Zod's .url() accepts javascript: URLs, and React still renders them as
// hrefs, so the scheme is checked explicitly.
const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .url()
  .refine((v) => /^https?:\/\//i.test(v), "Must be an http(s) URL");

export const websiteLeadFields = {
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .max(50)
    .refine((v) => {
      const digits = v.replace(/\D/g, "").length;
      return digits >= 7 && digits <= 15;
    }, "Enter a valid phone number"),
  listing_id: z.string().trim().uuid(),
  page_url: httpUrl,
};

const extraSchema = z.object({
  label: z.string().min(1).max(100),
  value: z.string().max(MAX_EXTRA_VALUE),
});

export const websiteLeadSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_NAME),
    email: websiteLeadFields.email.nullable(),
    phone: websiteLeadFields.phone.nullable(),
    message: z.string().max(MAX_MESSAGE).nullable(),
    message_text: z.string().max(MAX_MESSAGE_TEXT).nullable(),
    listing_id: websiteLeadFields.listing_id.nullable(),
    property_ref: z.string().trim().max(100).nullable(),
    property_address: z.string().trim().max(300).nullable(),
    page_url: httpUrl.nullable(),
    external_id: z.string().trim().min(1).max(200).nullable(),
    form_name: z.string().trim().max(200).nullable(),
    extras: z.array(extraSchema).max(MAX_EXTRAS),
  })
  .refine((lead) => Boolean(lead.email || lead.phone), {
    path: ["email"],
    message: "Provide a valid email address or phone number",
  });

export type WebsiteLead = z.output<typeof websiteLeadSchema>;

// ---------------------------------------------------------------------------
// Body → pairs
// ---------------------------------------------------------------------------

export type ParsedPairs = { pairs: Pair[]; filesIgnored: number } | { error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scalarToString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return null;
}

/** A form builder's field object ({ label, value }, { name, value }…) as a pair. */
function labelledValue(item: unknown): Pair | null {
  if (!isPlainObject(item) || !("value" in item)) return null;
  const label = ["label", "title", "name", "key", "field", "fieldName", "question"]
    .map((k) => scalarToString(item[k]))
    .find((s): s is string => Boolean(s && s.trim()));
  if (!label) return null;
  const value = Array.isArray(item.value)
    ? item.value.map(scalarToString).filter((s): s is string => s !== null).join(", ")
    : scalarToString(item.value);
  return value === null ? null : { key: label, value };
}

/** The scalar fields of one object level, with builder field arrays flattened in. */
function ownPairs(obj: Record<string, unknown>): Pair[] {
  const pairs: Pair[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const scalar = scalarToString(value);
    if (scalar !== null) {
      pairs.push({ key, value: scalar });
      continue;
    }
    if (!Array.isArray(value)) continue;
    const labelled = value.map(labelledValue).filter((p): p is Pair => p !== null);
    if (labelled.length > 0) {
      pairs.push(...labelled);
      continue;
    }
    const scalars = value.map(scalarToString).filter((s): s is string => s !== null);
    if (scalars.length > 0) pairs.push({ key, value: scalars.join(", ") });
  }
  return pairs;
}

function canonicalFor(key: string): CanonicalField | undefined {
  const rewritten = rewriteKey(key);
  return rewritten ? ALIAS_INDEX.get(normKey(rewritten)) : undefined;
}

function hasContactField(pairs: Pair[]): boolean {
  return pairs.some((p) => {
    const field = canonicalFor(p.key);
    return (field === "email" || field === "phone") && p.value.trim() !== "";
  });
}

/**
 * The object level that holds the visitor's fields. Builders wrap them in
 * envelopes — Webflow sends { name: "<form>", data: {…} }, or { payload:
 * { data: {…} } }, and Wix { data: { submissions: [{ label, value }] } } — so
 * if a level has no email or phone field, look inside its container keys,
 * up to two levels down. The envelope's own "name" is the form's name, not the
 * visitor's, so it comes along as form_name.
 */
function findContactLevel(obj: Record<string, unknown>, depth: number): Pair[] | null {
  const own = ownPairs(obj);
  if (hasContactField(own)) return own;
  if (depth >= 2) return null;

  for (const [key, value] of Object.entries(obj)) {
    if (!CONTAINER_KEYS.has(normKey(key))) continue;
    const record = isPlainObject(value)
      ? value
      : Array.isArray(value) && value.length === 1 && isPlainObject(value[0])
        ? value[0]
        : null;
    if (!record) continue;
    const nested = findContactLevel(record, depth + 1);
    if (!nested) continue;
    const formName = own.find((p) => ["name", "formname"].includes(normKey(p.key)))?.value;
    const hasFormName = nested.some((p) => canonicalFor(p.key) === "form_name");
    return formName && !hasFormName ? [...nested, { key: "form_name", value: formName }] : nested;
  }
  return null;
}

/** A parsed JSON body. Accepts one object, or a one-element array (Zapier's "wrap in array"). */
export function pairsFromJson(input: unknown): ParsedPairs {
  let root = input;
  if (Array.isArray(root)) {
    if (root.length === 1 && isPlainObject(root[0])) {
      root = root[0];
    } else {
      const labelled = root.map(labelledValue).filter((p): p is Pair => p !== null);
      if (labelled.length === 0) return { error: "Send one JSON object per enquiry." };
      return { pairs: labelled.slice(0, MAX_RAW_PAIRS), filesIgnored: 0 };
    }
  }
  if (!isPlainObject(root)) return { error: "Send the enquiry as a JSON object." };
  const pairs = findContactLevel(root, 0) ?? ownPairs(root);
  return { pairs: pairs.slice(0, MAX_RAW_PAIRS), filesIgnored: 0 };
}

/** A form post (urlencoded or multipart). Uploaded files are skipped and counted. */
export function pairsFromFormData(form: { entries(): Iterable<[string, unknown]> }): ParsedPairs {
  const pairs: Pair[] = [];
  let filesIgnored = 0;
  for (const [key, value] of form.entries()) {
    if (typeof value !== "string") {
      filesIgnored++;
    } else if (pairs.length < MAX_RAW_PAIRS) {
      pairs.push({ key, value });
    }
  }
  return { pairs, filesIgnored };
}

// ---------------------------------------------------------------------------
// Pairs → normalised submission
// ---------------------------------------------------------------------------

function normKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Bracketed form keys. Elementor's "advanced data" mode posts
 * fields[email][value] plus metadata (fields[email][title], form[id],
 * meta[…]); PHP-style list fields arrive as interests[]. Returns null for a
 * key that should be dropped.
 */
function rewriteKey(raw: string): string | null {
  const key = raw.trim();
  const elementorValue = key.match(/^fields\[([^\]]+)\]\[value\]$/i);
  if (elementorValue) return elementorValue[1];
  if (/^fields\[[^\]]+\]\[[^\]]+\]$/i.test(key)) return null;
  if (/^form\[name\]$/i.test(key)) return "form_name";
  if (/^(form|meta)\[/i.test(key)) return null;
  const listKey = key.match(/^(.+)\[\]$/);
  if (listKey) return listKey[1];
  return key || null;
}

/** "your-subject" → "Subject", "move_in_date" → "Move in date". */
function tidyLabel(key: string): string {
  const spaced = key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-.[\]:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^your\s+/i, "");
  const label = (spaced || "Field").slice(0, 100);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function isTruthy(value: string): boolean {
  return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export type NormalisedSubmission = {
  fields: Partial<Record<CanonicalField, string>>;
  extras: Extra[];
  honeypot: boolean;
  test: boolean;
  redirect: string | null;
  warnings: WebsiteLeadWarning[];
};

export function normaliseSubmission(
  pairs: Pair[],
  options: { filesIgnored?: number } = {}
): NormalisedSubmission {
  const fields: Partial<Record<CanonicalField, string>> = {};
  const extras = new Map<string, string[]>();
  const warnings = new Set<WebsiteLeadWarning>();
  let honeypot = false;
  let test = false;
  let redirect: string | null = null;

  if (options.filesIgnored) warnings.add("files_ignored");

  for (const pair of pairs) {
    const key = rewriteKey(pair.key);
    if (!key) continue;
    const value = pair.value.replace(/\r\n?/g, "\n").trim();
    const lower = key.toLowerCase();

    if (HONEYPOT_KEYS.has(lower)) {
      if (value) honeypot = true;
      continue;
    }
    if (REDIRECT_KEYS.has(lower)) {
      if (value && !redirect) redirect = value;
      continue;
    }
    if (TEST_KEYS.has(lower)) {
      if (isTruthy(value)) test = true;
      continue;
    }
    if (!value || key.startsWith("_")) continue;

    const norm = normKey(key);
    if (!norm || DROP_EXACT.has(norm) || DROP_CONTAINING.some((word) => norm.includes(word))) {
      continue;
    }

    const field = ALIAS_INDEX.get(norm);
    if (field && fields[field] === undefined) {
      fields[field] = value;
      continue;
    }
    // Repeated keys (checkbox groups) gather under one label.
    const label = tidyLabel(key);
    extras.set(label, [...(extras.get(label) ?? []), value]);
  }

  let extraList: Extra[] = [...extras].map(([label, values]) => ({ label, value: values.join(", ") }));
  if (extraList.length > MAX_EXTRAS) {
    extraList = extraList.slice(0, MAX_EXTRAS);
    warnings.add("fields_truncated");
  }
  extraList = extraList.map((extra) => {
    if (extra.value.length <= MAX_EXTRA_VALUE) return extra;
    warnings.add("fields_truncated");
    return { ...extra, value: clip(extra.value, MAX_EXTRA_VALUE) };
  });

  return { fields, extras: extraList, honeypot, test, redirect, warnings: [...warnings] };
}

// ---------------------------------------------------------------------------
// Normalised submission → validated lead
// ---------------------------------------------------------------------------

export type ValidationResult =
  | { ok: true; lead: WebsiteLead; warnings: WebsiteLeadWarning[] }
  | { ok: false; message: string; fields: Record<string, string> };

function parseOrNull<S extends z.ZodTypeAny>(schema: S, value: string | undefined): z.output<S> | null {
  if (!value) return null;
  const result = schema.safeParse(value);
  return result.success ? (result.data as z.output<S>) : null;
}

function clipOrNull(value: string | undefined, max: number): string | null {
  return value ? clip(value, max) : null;
}

export function validateSubmission(n: NormalisedSubmission): ValidationResult {
  const warnings = new Set(n.warnings);
  const f = n.fields;
  /** Values the visitor typed that couldn't go in their own column. */
  const kept: Extra[] = [];
  const keep = (label: string, value: string | undefined) => {
    if (value) kept.push({ label, value: clip(value, MAX_EXTRA_VALUE) });
  };

  const email = parseOrNull(websiteLeadFields.email, f.email);
  const phone = parseOrNull(websiteLeadFields.phone, f.phone);
  if (!email && !phone) {
    return {
      ok: false,
      message: "An enquiry needs a valid email address or phone number.",
      fields: {
        email: f.email ? "Not a valid email address" : "Missing",
        phone: f.phone ? "Not a valid phone number" : "Missing",
      },
    };
  }

  const joinedName = [f.first_name, f.last_name].filter(Boolean).join(" ").trim();
  let name = f.name ?? (joinedName || null);
  if (f.name && joinedName) {
    keep("First name", f.first_name);
    keep("Last name", f.last_name);
  }
  if (!name) {
    name = FALLBACK_NAME;
    warnings.add("name_missing");
  }

  if (f.email && !email) {
    keep("Email (as entered)", f.email);
    warnings.add("email_invalid");
  }
  if (f.phone && !phone) {
    keep("Phone (as entered)", f.phone);
    warnings.add("phone_invalid");
  }

  const pageUrl = parseOrNull(websiteLeadFields.page_url, f.page_url);
  if (f.page_url && !pageUrl) {
    keep("Page", f.page_url);
    warnings.add("page_url_invalid");
  }

  const listingId = parseOrNull(websiteLeadFields.listing_id, f.listing_id);
  if (f.listing_id && !listingId) {
    keep("Listing id", f.listing_id);
    warnings.add("listing_id_invalid");
  }

  let message = f.message ?? null;
  if (message && message.length > MAX_MESSAGE) {
    message = clip(message, MAX_MESSAGE);
    warnings.add("message_truncated");
  }

  let extras = [...kept, ...n.extras];
  if (extras.length > MAX_EXTRAS) {
    extras = extras.slice(0, MAX_EXTRAS);
    warnings.add("fields_truncated");
  }

  const candidate = {
    name: clip(name, MAX_NAME),
    email,
    phone,
    message,
    listing_id: listingId,
    property_ref: clipOrNull(f.property_ref, 100),
    property_address: clipOrNull(f.property_address, 300),
    page_url: pageUrl,
    external_id: clipOrNull(f.external_id, 200),
    form_name: clipOrNull(f.form_name, 200),
    extras,
  };
  const { text, truncated } = buildMessageText(candidate);
  if (truncated) warnings.add("fields_truncated");

  const parsed = websiteLeadSchema.safeParse({ ...candidate, message_text: text });
  if (!parsed.success) {
    // Every value was checked above, so reaching this is a bug — refuse
    // plainly rather than store a half-checked lead.
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = String(issue.path[0] ?? "body");
      fields[path] ??= issue.message;
    }
    return { ok: false, message: "The enquiry could not be read.", fields };
  }

  return { ok: true, lead: parsed.data, warnings: [...warnings] };
}

/**
 * leads.message_text: the form's name, the visitor's message, then every
 * other field as "Label: value" lines. Lines that would push it past
 * MAX_MESSAGE_TEXT are dropped (and reported as truncated).
 */
export function buildMessageText(lead: {
  form_name: string | null;
  message: string | null;
  extras: Extra[];
}): { text: string | null; truncated: boolean } {
  const head = [lead.form_name ? `Form: ${lead.form_name}` : null, lead.message]
    .filter((part): part is string => Boolean(part))
    .join("\n");

  let block = "";
  let truncated = false;
  for (const extra of lead.extras) {
    const line = `${extra.label}: ${extra.value}`;
    const next = block ? `${block}\n${line}` : line;
    if ((head ? head.length + 2 : 0) + next.length > MAX_MESSAGE_TEXT) {
      truncated = true;
      break;
    }
    block = next;
  }

  const text = head && block ? `${head}\n\n${block}` : head || block;
  return { text: text || null, truncated };
}

/**
 * The lead's dedupe key (leads.message_id, unique per tenant).
 *
 * With an external id from the site, namespaced by the key that sent it —
 * two of an agency's websites can both send Contact Form 7 entry #123.
 * Without one, a hash of what the visitor sent plus the UTC date, tenant-wide:
 * a plugin retrying the same submission, or the same enquiry arriving from
 * two of the agency's sites, makes one lead, while the same words sent again
 * on another day make a new one.
 */
export function websiteMessageId(input: {
  apiKeyId: string;
  lead: Pick<
    WebsiteLead,
    "external_id" | "email" | "phone" | "message_text" | "listing_id" | "property_ref" | "page_url"
  >;
  now: Date;
}): string {
  const { lead } = input;
  if (lead.external_id) return `web:k:${input.apiKeyId}:${lead.external_id}`;
  const digest = createHash("sha256")
    .update(
      [
        lead.email ?? "",
        (lead.phone ?? "").replace(/\D/g, ""),
        (lead.message_text ?? "").replace(/\s+/g, " ").trim().toLowerCase(),
        lead.listing_id ?? "",
        (lead.property_ref ?? "").toLowerCase(),
        lead.page_url ?? "",
        input.now.toISOString().slice(0, 10),
      ].join("|")
    )
    .digest("hex");
  return `web:h:${digest}`;
}
