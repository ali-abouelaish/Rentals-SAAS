// The demo request form's rules (shared by the form and the server action).
//
//   npm test

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { demoRequestSchema, portfolioLabel } from "./schemas.ts";

const valid = {
  first_name: "Amelia",
  last_name: "O'Brien-Khan",
  email: "amelia@agency.co.uk",
  company: "Truehold Ltd",
  portfolio_size: "50_99",
  goal: "",
  terms: true,
  plan: null,
};

const errorsFor = (input: Record<string, unknown>) => {
  const parsed = demoRequestSchema.safeParse(input);
  return parsed.success ? {} : parsed.error.flatten().fieldErrors;
};

describe("demoRequestSchema", () => {
  it("accepts a complete request and trims it", () => {
    const parsed = demoRequestSchema.parse({ ...valid, company: "  Truehold Ltd  " });
    assert.equal(parsed.company, "Truehold Ltd");
  });

  it("accepts names in any alphabet, with hyphens and apostrophes", () => {
    for (const first_name of ["José", "Zoë", "Anne-Marie", "D’Arcy", "Ngozi Ada", "Łucja"]) {
      assert.deepEqual(errorsFor({ ...valid, first_name }), {}, first_name);
    }
  });

  it("refuses names that could carry a link into the confirmation email", () => {
    for (const first_name of ["evil.com", "http://x", "Bob <b>", "J0hn", "a/b"]) {
      assert.ok(errorsFor({ ...valid, first_name }).first_name, first_name);
    }
  });

  it("asks for every required field in the designer's words", () => {
    const errors = errorsFor({ ...valid, first_name: "", last_name: "", company: " ", portfolio_size: "", terms: false });
    assert.deepEqual(errors.first_name, ["Enter your first name"]);
    assert.deepEqual(errors.last_name, ["Enter your last name"]);
    assert.deepEqual(errors.company, ["Enter your company name"]);
    assert.deepEqual(errors.portfolio_size, ["Choose the size of your portfolio"]);
    assert.deepEqual(errors.terms, ["Tick the box to agree to the terms and privacy policy"]);
  });

  it("checks the email address", () => {
    assert.deepEqual(errorsFor({ ...valid, email: "" }).email, ["Enter your work email"]);
    assert.deepEqual(errorsFor({ ...valid, email: "amelia@" }).email, ["Enter an email address like name@agency.co.uk"]);
  });

  it("only knows the five portfolio sizes and the two plans", () => {
    assert.ok(errorsFor({ ...valid, portfolio_size: "10–49 rooms" }).portfolio_size);
    assert.ok(errorsFor({ ...valid, plan: "gold" }).plan);
    assert.deepEqual(errorsFor({ ...valid, plan: "enterprise" }), {});
  });

  it("caps the free text", () => {
    assert.ok(errorsFor({ ...valid, goal: "x".repeat(1001) }).goal);
    assert.deepEqual(errorsFor({ ...valid, goal: "x".repeat(1000) }), {});
  });
});

describe("portfolioLabel", () => {
  it("turns the stored slug back into words", () => {
    assert.equal(portfolioLabel("200_plus"), "200+ rooms");
    assert.equal(portfolioLabel("unknown"), "unknown");
  });
});
