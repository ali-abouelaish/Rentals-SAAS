"use server";

import OpenAI from "openai";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { ParsedQuestion, QuestionType } from "../domain/types";

let openaiClient: OpenAI | null = null;
function getClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set on the server.");
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

const VALID_TYPES: QuestionType[] = [
  "text", "textarea", "email", "phone", "date", "select", "checkbox", "file_upload", "number", "info", "confirm",
];

const SYSTEM_PROMPT = `You are a form field extractor. The user will paste raw text copied from a Google Form or any other form. Extract each question and return strictly valid JSON of the form {"questions":[{"label":"...","type":"...","options":null,"is_required":false}]}.

Map question types as follows:
- Short answer → "text"
- Paragraph → "textarea"
- Multiple choice, Dropdown → "select" (extract options as an array of strings)
- Checkboxes (multi-select list) → "select" (extract options)
- Checkbox (single yes/no) → "checkbox"
- Date → "date"
- Number → "number"
- Email → "email"
- Phone → "phone"
- File upload → "file_upload"
- Consent / agreement statement the applicant must accept (e.g. "I agree to the terms", "I confirm the above is correct", a required tick-to-agree) → "confirm"
- Info / description text (not a question) → "info"

For "select" type, populate "options" with an array of choice strings. For all other types set "options" to null.
Set "is_required" to true only if the question is explicitly marked required.
Return only the JSON object, no markdown or explanation.`;

export async function importBookingForm(rawText: string): Promise<ParsedQuestion[]> {
  await requireRole([...ADMIN_ROLES]);

  const capped = rawText.slice(0, 6000);

  const completion = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: capped },
    ],
  });

  const content = completion.choices[0]?.message?.content?.trim() ?? "{}";

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("AI returned an unexpected response. Please try again.");
  }

  const raw = (parsed as { questions?: unknown[] }).questions;
  if (!Array.isArray(raw)) {
    throw new Error("AI returned an unexpected response. Please try again.");
  }

  const questions: ParsedQuestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;

    const label = typeof obj.label === "string" && obj.label.trim() ? obj.label.trim().slice(0, 500) : null;
    if (!label) continue;

    const rawType = typeof obj.type === "string" ? obj.type : "text";
    const type: QuestionType = VALID_TYPES.includes(rawType as QuestionType)
      ? (rawType as QuestionType)
      : "text";

    const options =
      Array.isArray(obj.options) && type === "select"
        ? (obj.options as unknown[]).filter((o) => typeof o === "string").map(String)
        : null;

    const is_required = obj.is_required === true;

    questions.push({ label, type, options: options && options.length > 0 ? options : null, is_required });
  }

  return questions;
}
