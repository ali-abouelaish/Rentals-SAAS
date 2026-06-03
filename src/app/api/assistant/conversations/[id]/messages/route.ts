import { APIError } from "openai";
import { NextRequest, NextResponse } from "next/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import { isAdminRole } from "@/lib/auth/roles";
import { getPublishedModuleConfigForApp } from "@/features/admin/data/admin";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  appendAssistantMessage,
  assertConversationAccess,
  loadAssistantHistory,
} from "@/features/assistant/data/conversations";
import { streamAssistantTurn } from "@/lib/ai/assistant";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // ── Gate: admin + property_management module + ai_assistant entitlement ──
  const profile = await requireUserProfile();
  if (!isAdminRole(profile.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const moduleConfig = await getPublishedModuleConfigForApp(profile.tenant_id);
  if (!moduleConfig.property_management_enabled) {
    return NextResponse.json({ error: "module_disabled" }, { status: 403 });
  }
  const entitlements = await getEntitlements();
  if (!entitlements.has("ai_assistant")) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 403 });
  }

  let body: { content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const content = body.content?.trim();
  if (!content) {
    return NextResponse.json({ error: "missing_content" }, { status: 400 });
  }

  const hasAccess = await assertConversationAccess(params.id);
  if (!hasAccess) {
    return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });
  }

  try {
    const [history, company] = await Promise.all([
      loadAssistantHistory(params.id),
      (async () => {
        const supabase = createSupabaseServerClient();
        const { data } = await supabase
          .from("tenants")
          .select("name")
          .eq("id", profile.tenant_id)
          .maybeSingle();
        return (data?.name as string | undefined) ?? "your agency";
      })(),
    ]);

    await appendAssistantMessage({ conversationId: params.id, role: "user", content });

    const gen = streamAssistantTurn({
      companyName: company,
      history,
      userMessage: content,
    });

    // Pull the first chunk eagerly so a provider failure (bad key / quota) surfaces
    // as a JSON error BEFORE we commit to a streamed 200 response.
    const first = await gen.next();

    const encoder = new TextEncoder();
    const conversationId = params.id;
    let full = "";

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          if (!first.done && first.value) {
            full += first.value;
            controller.enqueue(encoder.encode(first.value));
          }
          let next = await gen.next();
          while (!next.done) {
            full += next.value;
            controller.enqueue(encoder.encode(next.value));
            next = await gen.next();
          }
        } catch (streamErr) {
          // Mid-stream failure: we've already sent a 200, so we can't change the
          // status. Append a short note so the user isn't left hanging.
          console.error("[assistant.conversations.messages] stream", streamErr);
          const note =
            (full ? "\n\n" : "") +
            "_(Sorry — the assistant was interrupted before finishing. Please try again.)_";
          full += note;
          controller.enqueue(encoder.encode(note));
        } finally {
          controller.close();
          if (full.trim()) {
            try {
              await appendAssistantMessage({ conversationId, role: "assistant", content: full });
            } catch (persistErr) {
              console.error("[assistant.conversations.messages] persist", persistErr);
            }
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("[assistant.conversations.messages]", err);

    // Surface the underlying AI-provider failure so the chat can show something
    // useful instead of a blank "try again" (e.g. quota exhausted / rate limited).
    if (err instanceof APIError) {
      const status = err.status ?? 502;
      const reason =
        status === 429
          ? "The assistant is temporarily unavailable — the AI service quota or rate limit has been reached. Please check the OpenAI billing/usage and try again shortly."
          : status === 401
            ? "The assistant isn't configured correctly — the AI service rejected the API key."
            : "The assistant couldn't reach the AI service. Please try again shortly.";
      return NextResponse.json({ error: "ai_unavailable", reason }, { status: 503 });
    }

    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
