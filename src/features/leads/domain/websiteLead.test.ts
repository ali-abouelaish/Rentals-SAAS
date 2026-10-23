// Website enquiries: whatever a site, form plugin or automation tool posts
// must come out as one predictable lead — and nothing the visitor typed may
// be silently lost.
//
//   npm test

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FALLBACK_NAME,
  MAX_EXTRAS,
  MAX_MESSAGE,
  normaliseSubmission,
  pairsFromFormData,
  pairsFromJson,
  validateSubmission,
  websiteMessageId,
  type Pair,
  type ValidationResult,
} from "./websiteLead.ts";

function pairsOf(parsed: ReturnType<typeof pairsFromJson>): Pair[] {
  if ("error" in parsed) throw new Error(`expected the body to parse: ${parsed.error}`);
  return parsed.pairs;
}

function fromJson(input: unknown): ValidationResult {
  return validateSubmission(normaliseSubmission(pairsOf(pairsFromJson(input))));
}

function fromForm(entries: [string, string][]): ValidationResult {
  return validateSubmission(normaliseSubmission(pairsOf(pairsFromFormData(new URLSearchParams(entries)))));
}

function okLead(result: ValidationResult) {
  if (!result.ok) throw new Error(`expected a valid lead, got: ${result.message}`);
  return result;
}

describe("form plugin payloads", () => {
  it("reads Contact Form 7 field names and drops its plumbing", () => {
    const { lead } = okLead(
      fromJson({
        "your-name": "Ada Lovelace",
        "your-email": "Ada@Example.com",
        "your-subject": "Room 3",
        "your-message": "Is it still free?",
        _wpcf7: "12",
        _wpcf7_unit_tag: "wpcf7-f12-o1",
        "g-recaptcha-response": "03AGdBq",
      })
    );
    assert.equal(lead.name, "Ada Lovelace");
    assert.equal(lead.email, "ada@example.com");
    assert.equal(lead.message, "Is it still free?");
    assert.deepEqual(lead.extras, [{ label: "Subject", value: "Room 3" }]);
    assert.equal(lead.message_text, "Is it still free?\n\nSubject: Room 3");
  });

  it("reads Elementor's simple mode (labels as keys) and drops its metadata", () => {
    const { lead } = okLead(
      fromForm([
        ["Name", "Bo Diddley"],
        ["Email", "bo@example.com"],
        ["Message", "Viewing on Saturday?"],
        ["Page URL", "https://agency.example/rooms/3"],
        ["User Agent", "Mozilla/5.0"],
        ["Remote IP", "203.0.113.9"],
        ["Powered by", "Elementor"],
        ["Date", "23 October 2026"],
        ["form_id", "a1b2c3"],
        ["form_name", "Room enquiry"],
      ])
    );
    assert.equal(lead.name, "Bo Diddley");
    assert.equal(lead.page_url, "https://agency.example/rooms/3");
    assert.equal(lead.form_name, "Room enquiry");
    assert.deepEqual(lead.extras, [{ label: "Date", value: "23 October 2026" }]);
    assert.ok(lead.message_text?.startsWith("Form: Room enquiry\nViewing on Saturday?"));
  });

  it("reads Elementor's advanced mode bracket keys", () => {
    const { lead } = okLead(
      fromForm([
        ["fields[name][value]", "Cy Twombly"],
        ["fields[name][title]", "Name"],
        ["fields[email][value]", "cy@example.com"],
        ["fields[email][type]", "email"],
        ["form[id]", "a1b2c3"],
        ["form[name]", "Room enquiry"],
        ["meta[date][value]", "23 October 2026"],
      ])
    );
    assert.equal(lead.name, "Cy Twombly");
    assert.equal(lead.email, "cy@example.com");
    assert.equal(lead.form_name, "Room enquiry");
    assert.deepEqual(lead.extras, []);
  });

  it("unwraps a Webflow v1 envelope without taking the form name as the visitor's", () => {
    const { lead } = okLead(
      fromJson({
        name: "Contact form",
        site: "62b0",
        data: { Name: "Di Ek", Email: "di@example.com", Message: "Hello" },
        d: "2026-10-23T09:00:00.000Z",
        _id: "6355",
      })
    );
    assert.equal(lead.name, "Di Ek");
    assert.equal(lead.form_name, "Contact form");
    assert.equal(lead.message, "Hello");
  });

  it("unwraps a Webflow v2 envelope two levels down and joins first + last name", () => {
    const { lead } = okLead(
      fromJson({
        triggerType: "form_submission",
        payload: {
          name: "Contact form",
          siteId: "62b0",
          data: { "First Name": "Ed", "Last Name": "Fry", Email: "ed@example.com" },
          submittedAt: "2026-10-23T09:00:00.000Z",
          id: "6355",
          formId: "62b1",
        },
      })
    );
    assert.equal(lead.name, "Ed Fry");
    assert.equal(lead.form_name, "Contact form");
    assert.deepEqual(lead.extras, []);
  });

  it("flattens Wix's label/value submissions array", () => {
    const { lead } = okLead(
      fromJson({
        data: {
          formName: "Room enquiry",
          submissions: [
            { label: "First name", value: "Fi" },
            { label: "Email", value: "fi@example.com" },
            { label: "Message", value: "Can I view it?" },
            { label: "Move-in date", value: "2026-11-01" },
          ],
        },
      })
    );
    assert.equal(lead.name, "Fi");
    assert.equal(lead.message, "Can I view it?");
    assert.equal(lead.form_name, "Room enquiry");
    assert.deepEqual(lead.extras, [{ label: "Move in date", value: "2026-11-01" }]);
  });

  it("accepts Zapier's one-element array", () => {
    const { lead } = okLead(fromJson([{ name: "Gil", email: "gil@example.com" }]));
    assert.equal(lead.name, "Gil");
  });

  it("rejects bodies that aren't one enquiry", () => {
    assert.ok("error" in pairsFromJson("just text"));
    assert.ok("error" in pairsFromJson([{ name: "A" }, { name: "B" }]));
  });
});

describe("field handling", () => {
  it("joins first and last name and accepts a phone-only enquiry", () => {
    const { lead } = okLead(fromJson({ first_name: "Hal", last_name: "Ives", phone: "07700 900123" }));
    assert.equal(lead.name, "Hal Ives");
    assert.equal(lead.phone, "07700 900123");
    assert.equal(lead.email, null);
  });

  it("drops credentials and anti-spam tokens", () => {
    const { lead } = okLead(
      fromJson({
        name: "Ian",
        email: "ian@example.com",
        password: "hunter2",
        csrf_token: "abc",
        "cf-turnstile-response": "xyz",
        api_key: "hopk_leaked",
      })
    );
    assert.deepEqual(lead.extras, []);
  });

  it("gathers repeated list fields under one label", () => {
    const { lead } = okLead(
      fromForm([
        ["name", "Jo"],
        ["email", "jo@example.com"],
        ["interests[]", "Double room"],
        ["interests[]", "Bills included"],
      ])
    );
    assert.deepEqual(lead.extras, [{ label: "Interests", value: "Double room, Bills included" }]);
  });

  it("keeps a visitor's own address in the message, not the property address", () => {
    const { lead } = okLead(fromJson({ name: "Kay", email: "kay@example.com", address: "1 High St" }));
    assert.equal(lead.property_address, null);
    assert.deepEqual(lead.extras, [{ label: "Address", value: "1 High St" }]);
  });

  it("counts uploaded files as ignored", () => {
    const form = new FormData();
    form.append("name", "Lu");
    form.append("email", "lu@example.com");
    form.append("cv", new Blob(["%PDF"]), "cv.pdf");
    const parsed = pairsFromFormData(form);
    if ("error" in parsed) throw new Error(parsed.error);
    assert.equal(parsed.filesIgnored, 1);
    const n = normaliseSubmission(parsed.pairs, { filesIgnored: parsed.filesIgnored });
    assert.deepEqual(n.warnings, ["files_ignored"]);
  });
});

describe("control fields", () => {
  it("detects the honeypot, redirect and test flags and keeps them out of the message", () => {
    const n = normaliseSubmission([
      { key: "name", value: "Bot" },
      { key: "email", value: "bot@example.com" },
      { key: "_gotcha", value: "http://spam.example" },
      { key: "_redirect", value: "https://agency.example/thanks" },
      { key: "test", value: "true" },
    ]);
    assert.equal(n.honeypot, true);
    assert.equal(n.redirect, "https://agency.example/thanks");
    assert.equal(n.test, true);
    assert.deepEqual(n.extras, []);
  });

  it("ignores an empty honeypot — real visitors leave it blank", () => {
    const n = normaliseSubmission([
      { key: "_gotcha", value: "" },
      { key: "email", value: "real@example.com" },
    ]);
    assert.equal(n.honeypot, false);
  });
});

describe("lenient validation", () => {
  it("names a nameless enquiry instead of rejecting it", () => {
    const result = okLead(fromJson({ email: "nameless@example.com" }));
    assert.equal(result.lead.name, FALLBACK_NAME);
    assert.ok(result.warnings.includes("name_missing"));
  });

  it("moves a javascript: page URL into the message", () => {
    const result = okLead(
      fromJson({ name: "Mo", email: "mo@example.com", page_url: "javascript:alert(1)" })
    );
    assert.equal(result.lead.page_url, null);
    assert.ok(result.warnings.includes("page_url_invalid"));
    assert.ok(result.lead.message_text?.includes("Page: javascript:alert(1)"));
  });

  it("moves a too-short phone into the message when the email is valid", () => {
    const result = okLead(fromJson({ name: "Ned", email: "ned@example.com", phone: "123" }));
    assert.equal(result.lead.phone, null);
    assert.ok(result.warnings.includes("phone_invalid"));
    assert.ok(result.lead.message_text?.includes("Phone (as entered): 123"));
  });

  it("moves an invalid email into the message when the phone is valid", () => {
    const result = okLead(fromJson({ name: "Ola", email: "ola-at-example", phone: "+44 7700 900123" }));
    assert.equal(result.lead.email, null);
    assert.ok(result.warnings.includes("email_invalid"));
  });

  it("moves an invalid listing id into the message and keeps a valid one", () => {
    const bad = okLead(fromJson({ name: "Pat", email: "pat@example.com", listing_id: "room-3" }));
    assert.equal(bad.lead.listing_id, null);
    assert.ok(bad.warnings.includes("listing_id_invalid"));

    const id = "6f1c2a9e-4b7d-4c1e-9a3f-2d5e8b7c6a10";
    const good = okLead(fromJson({ name: "Pat", email: "pat@example.com", listing_id: id }));
    assert.equal(good.lead.listing_id, id);
  });

  it("refuses an enquiry with no way to contact the person", () => {
    const none = fromJson({ name: "Quinn" });
    assert.equal(none.ok, false);
    if (!none.ok) assert.equal(none.fields.email, "Missing");

    const bad = fromJson({ name: "Quinn", email: "nope" });
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.fields.email, "Not a valid email address");
  });

  it("truncates an over-long message and caps the extra fields", () => {
    const long = okLead(fromJson({ name: "Rae", email: "rae@example.com", message: "a".repeat(MAX_MESSAGE + 50) }));
    assert.equal(long.lead.message?.length, MAX_MESSAGE);
    assert.ok(long.warnings.includes("message_truncated"));

    const many: Record<string, string> = { name: "Sam", email: "sam@example.com" };
    for (let i = 0; i < MAX_EXTRAS + 5; i++) many[`extra_${i}`] = String(i);
    const capped = okLead(fromJson(many));
    assert.equal(capped.lead.extras.length, MAX_EXTRAS);
    assert.ok(capped.warnings.includes("fields_truncated"));
  });
});

describe("websiteMessageId", () => {
  const lead = {
    external_id: null,
    email: "tom@example.com",
    phone: "07700 900123",
    message_text: "Is the double room free?",
    listing_id: null,
    property_ref: "R12",
    page_url: "https://agency.example/rooms/12",
  };
  const day = new Date("2026-10-23T10:00:00Z");

  it("is stable for the same enquiry on the same day, whichever key sent it", () => {
    const a = websiteMessageId({ apiKeyId: "key-a", lead, now: day });
    const b = websiteMessageId({ apiKeyId: "key-b", lead, now: new Date("2026-10-23T22:00:00Z") });
    assert.equal(a, b);
    assert.match(a, /^web:h:[0-9a-f]{64}$/);
  });

  it("changes on another day and for another page", () => {
    const base = websiteMessageId({ apiKeyId: "key-a", lead, now: day });
    assert.notEqual(base, websiteMessageId({ apiKeyId: "key-a", lead, now: new Date("2026-10-24T10:00:00Z") }));
    assert.notEqual(
      base,
      websiteMessageId({ apiKeyId: "key-a", lead: { ...lead, page_url: "https://agency.example/rooms/13" }, now: day })
    );
  });

  it("namespaces a site's own submission id by the key that sent it", () => {
    const withId = { ...lead, external_id: "123" };
    assert.equal(websiteMessageId({ apiKeyId: "key-a", lead: withId, now: day }), "web:k:key-a:123");
    assert.notEqual(
      websiteMessageId({ apiKeyId: "key-a", lead: withId, now: day }),
      websiteMessageId({ apiKeyId: "key-b", lead: withId, now: day })
    );
  });
});
