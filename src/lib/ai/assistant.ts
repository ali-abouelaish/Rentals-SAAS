import OpenAI from "openai";
import { ASSISTANT_TOOLS, type ToolName } from "@/features/assistant/domain/tools";
import { DISPATCH } from "@/features/assistant/data/dispatch";
import { buildHelpKnowledgeBase } from "@/features/help/lib/knowledgeBase";

export type AssistantChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantTurnResult = {
  assistantMessage: string;
  toolTrace: { name: string; args: unknown }[];
};

const MAX_ITERS = 5;
/** Switchable without a code change. Defaults to gpt-4o for stronger reasoning + instruction-following. */
const MODEL = process.env.ASSISTANT_MODEL || "gpt-4o";
const FALLBACK =
  "I couldn't pull that together in a reasonable number of steps — could you narrow the question a little?";

/**
 * The in-app help guides, concatenated once into a single markdown document
 * and reused across turns. Injected into the system prompt so the assistant
 * can answer "how do I…" / "where do I…" questions about using the app.
 */
const PRODUCT_GUIDE = buildHelpKnowledgeBase();

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set on the server.");
    }
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_API_BASE_URL,
    });
  }
  return client;
}

export function buildAssistantSystemPrompt(companyName: string): string {
  return `You are the data assistant for ${companyName}, a UK property-management agency. You answer the admin's questions about THEIR data by calling the read-only tools provided. You never invent figures — if a tool doesn't return something, say you don't have it.

# WHAT YOU CAN DO
- Answer questions and summarise data across: properties & units (rooms), tenants & tenancy contracts, rent & finances, and bookings & leads.
- You are STRICTLY READ-ONLY. You cannot create, edit, delete, send, or change anything. If asked to, explain that you can only look things up, and suggest where in the app they can make the change.
- If a question is outside this property data (general knowledge, weather, coding, etc.), politely decline and say what you can help with.

# SCHEMA NAMING — IMPORTANT
- "tenant" in the user's question means a PROPERTY TENANT (an occupant) — use the pm-tenant / contract / rent tools. It does NOT mean the agency itself.
- A "unit" is a lettable room/studio/whole-flat — when the user says "room" they mean a unit.
- A "property" is a building/flat at an address and contains units.
- An "owner landlord" is who the agency rents a property from. (Don't confuse with the occupant.)

# MONEY
- Every monetary value returned by the tools is already in GBP (pounds). Report values with a £ sign. Do not multiply or divide amounts.

# ACCURACY — NEVER INVENT FIGURES
- Only state numbers that came directly from a tool result. If a tool didn't return something, say you don't have it.
- For per-property profit/loss you MUST use the "byProperty" array from get_finance_rollup. NEVER estimate a single property's figure by splitting or guessing from a portfolio total — if the per-property breakdown isn't available, say so.
- Before naming "the most/least profitable property" or "the one losing the most", read byProperty and pick the actual min/max netProfitGbp. Don't infer it from portfolio numbers.

# HOW TO WORK
- Resolve names to ids before filtering: e.g. call list_portfolios to turn a portfolio name into an id before passing portfolioId.
- For "how many vacant rooms / occupancy" use get_occupancy_snapshot. For "who is behind on rent" use get_arrears_summary (or get_rent_collection for the detailed list).
- Lists are capped (usually 20 rows). If a result is "truncated", tell the user you're showing the top N of the total and offer to filter further.
- Prefer one summarising tool over dumping many rows. Keep answers concise and in plain UK English.
- The current date is ${new Date().toISOString().slice(0, 10)}.

# FORMATTING
- Your replies are rendered as Markdown. Use it: "**bold**" for key figures/labels, "- " bullet lists, short "### " sub-headings, and Markdown tables when comparing rows (e.g. several properties or tenants). Keep it tight — no walls of text.

# LINKING — MAKE ENTITIES CLICKABLE
- When you mention a specific property, tenant or contract that you have an id for (from a tool result), render its name as a relative Markdown link so the user can jump straight to it. Use the name as the link text.
- Routes (use the exact id from the tool result — NEVER invent or guess an id or url):
  - Property → [Name](/properties/{id})  — the property's id, e.g. from list_properties / get_property / list_units (propertyId) / get_finance_rollup byProperty (propertyId).
  - Property finances / profit / loss / costs → [Name](/profitability/{id})  — prefer this over /properties when the question is about money.
  - Tenant (occupant) → [Name](/tenants?focus={id})  — the pm-tenant id (id / tenantId from the tools).
  - Contract → [contract](/contracts?focus={id})  — the contract's id.
- Only link when you actually have the id. If you don't have an id for something, just write its name as plain text. Never link a portfolio (no page exists).

# USING THE APP — PRODUCT GUIDE
Besides data questions, you can also help the admin learn HOW TO USE the ${companyName} app — answering "how do I…", "where do I…", and "what is this page for" questions. The product guide below documents each page. When answering these:
- Use ONLY what the guide describes — give concise, numbered steps and don't invent features, buttons, or pages that aren't in it.
- Link to the relevant page using its route from the guide as a relative Markdown link, e.g. [Rent Collection](/rent-collection). These are fixed page routes and need no id.
- This guide is about how the software works; for the user's actual records, keep using the read-only tools above. Don't quote the guide's headings verbatim — answer the question.

${PRODUCT_GUIDE}`;
}

export async function runAssistantTurn(args: {
  companyName: string;
  history: AssistantChatMessage[];
  userMessage: string;
}): Promise<AssistantTurnResult> {
  const openai = getClient();
  const toolTrace: { name: string; args: unknown }[] = [];

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: buildAssistantSystemPrompt(args.companyName) },
    ...args.history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: args.userMessage },
  ];

  for (let i = 0; i < MAX_ITERS; i++) {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools: ASSISTANT_TOOLS as unknown as OpenAI.Chat.ChatCompletionTool[],
      tool_choice: "auto",
      temperature: 0.2,
    });

    const msg = completion.choices[0]?.message;
    if (!msg) break;

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const text = msg.content?.trim();
      return {
        assistantMessage: text || "Sorry, I didn't catch that — could you rephrase?",
        toolTrace,
      };
    }

    // Push the assistant's tool-call message, then resolve every call.
    messages.push(msg as OpenAI.Chat.ChatCompletionMessageParam);

    const functionCalls = msg.tool_calls.filter(
      (tc): tc is OpenAI.Chat.ChatCompletionMessageFunctionToolCall => tc.type === "function"
    );

    const results = await Promise.all(
      functionCalls.map(async (tc) => {
        const name = tc.function.name as ToolName;
        let parsed: Record<string, unknown> = {};
        try {
          parsed = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
        } catch {
          parsed = {};
        }
        toolTrace.push({ name, args: parsed });

        const fn = DISPATCH[name];
        let output: unknown;
        if (!fn) {
          output = { error: `unknown_tool: ${name}` };
        } else {
          try {
            output = await fn(parsed);
          } catch (err) {
            output = { error: err instanceof Error ? err.message : "tool_failed" };
          }
        }
        return { tool_call_id: tc.id, content: JSON.stringify(output) };
      })
    );

    for (const r of results) {
      messages.push({ role: "tool", tool_call_id: r.tool_call_id, content: r.content });
    }
  }

  return { assistantMessage: FALLBACK, toolTrace };
}

/** Runs the requested tool calls in parallel and returns their JSON-encoded results. */
async function executeToolCalls(
  toolCalls: { id: string; name: string; args: string }[]
): Promise<{ tool_call_id: string; content: string }[]> {
  return Promise.all(
    toolCalls.map(async (tc) => {
      const name = tc.name as ToolName;
      let parsed: Record<string, unknown> = {};
      try {
        parsed = tc.args ? JSON.parse(tc.args) : {};
      } catch {
        parsed = {};
      }
      const fn = DISPATCH[name];
      let output: unknown;
      if (!fn) {
        output = { error: `unknown_tool: ${name}` };
      } else {
        try {
          output = await fn(parsed);
        } catch (err) {
          output = { error: err instanceof Error ? err.message : "tool_failed" };
        }
      }
      return { tool_call_id: tc.id, content: JSON.stringify(output) };
    })
  );
}

/**
 * Streaming variant of {@link runAssistantTurn}. Tool-call rounds are resolved
 * server-side (no output yielded); the final natural-language answer is yielded
 * token-by-token as the model produces it. The first pull surfaces any provider
 * error (bad key / quota) before the caller commits to a streamed 200 response.
 */
export async function* streamAssistantTurn(args: {
  companyName: string;
  history: AssistantChatMessage[];
  userMessage: string;
}): AsyncGenerator<string, void, unknown> {
  const openai = getClient();

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: buildAssistantSystemPrompt(args.companyName) },
    ...args.history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: args.userMessage },
  ];

  for (let i = 0; i < MAX_ITERS; i++) {
    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools: ASSISTANT_TOOLS as unknown as OpenAI.Chat.ChatCompletionTool[],
      tool_choice: "auto",
      temperature: 0.2,
      stream: true,
    });

    const toolAcc: Record<number, { id: string; name: string; args: string }> = {};
    let content = "";
    let sawToolCall = false;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.tool_calls) {
        sawToolCall = true;
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          const acc = (toolAcc[idx] ??= { id: "", name: "", args: "" });
          if (tc.id) acc.id = tc.id;
          if (tc.function?.name) acc.name += tc.function.name;
          if (tc.function?.arguments) acc.args += tc.function.arguments;
        }
      }

      if (delta.content) {
        content += delta.content;
        // Only forward live during an answer round — never leak a tool-call round's stray text.
        if (!sawToolCall) yield delta.content;
      }
    }

    if (!sawToolCall) {
      // Final answer round — everything was streamed above.
      if (!content.trim()) yield "Sorry, I didn't catch that — could you rephrase?";
      return;
    }

    const toolCalls = Object.keys(toolAcc)
      .map(Number)
      .sort((a, b) => a - b)
      .map((k) => toolAcc[k])
      .filter((t) => t.id && t.name);

    messages.push({
      role: "assistant",
      content: content || null,
      tool_calls: toolCalls.map((t) => ({
        id: t.id,
        type: "function" as const,
        function: { name: t.name, arguments: t.args },
      })),
    });

    const results = await executeToolCalls(toolCalls);
    for (const r of results) {
      messages.push({ role: "tool", tool_call_id: r.tool_call_id, content: r.content });
    }
  }

  yield FALLBACK;
}

export function assistantGreeting(): string {
  return "Hi — I'm your data assistant. Ask me anything about your properties, tenants, contracts, rent, finances, bookings or leads. For example: \"How many rooms are vacant?\", \"Who's behind on rent?\", or \"What was net profit last month?\"";
}
