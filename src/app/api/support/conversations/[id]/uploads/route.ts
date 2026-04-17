import { NextRequest, NextResponse } from "next/server";
import { resolveSupportTenantFromRequest } from "@/features/support/data/resolveTenant";
import { loadConversationContext } from "@/features/support/data/conversations";
import {
  classifyFileKind,
  uploadConversationAttachment,
} from "@/features/support/data/attachments";

export const runtime = "nodejs";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenant = await resolveSupportTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  const bundle = await loadConversationContext({
    conversationId: params.id,
    tenantId: tenant.id,
  });
  if (!bundle) {
    return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }
  if (!classifyFileKind(file.type)) {
    return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  }

  try {
    const result = await uploadConversationAttachment({
      tenantId: tenant.id,
      conversationId: params.id,
      file,
    });
    if (!result) {
      return NextResponse.json({ error: "upload_failed" }, { status: 500 });
    }

    return NextResponse.json({
      attachmentId: result.attachmentId,
      kind: result.kind,
      signedUrl: result.signedUrl,
    });
  } catch (err) {
    console.error("[support.conversations.uploads]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
