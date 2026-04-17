import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const MAINTENANCE_BUCKET = "maintenance-media";

const IMAGE_PREFIXES = ["image/"];
const VIDEO_PREFIXES = ["video/"];
const AUDIO_PREFIXES = ["audio/"];

export function classifyFileKind(mimeType: string): "image" | "video" | "audio" | null {
  const mt = mimeType.toLowerCase();
  if (IMAGE_PREFIXES.some((p) => mt.startsWith(p))) return "image";
  if (VIDEO_PREFIXES.some((p) => mt.startsWith(p))) return "video";
  if (AUDIO_PREFIXES.some((p) => mt.startsWith(p))) return "audio";
  return null;
}

export function extensionForMime(mimeType: string, fallbackName: string): string {
  const fromName = fallbackName.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  const mt = mimeType.toLowerCase();
  if (mt === "image/jpeg") return "jpg";
  if (mt === "image/png") return "png";
  if (mt === "image/webp") return "webp";
  if (mt === "image/heic") return "heic";
  if (mt === "video/mp4") return "mp4";
  if (mt === "video/quicktime") return "mov";
  return "bin";
}

export async function signAttachmentUrl(
  storagePath: string,
  expiresIn = 3600
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(MAINTENANCE_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  if (error || !data) return null;
  return data.signedUrl;
}

export type CreateAttachmentArgs = {
  tenantId: string;
  conversationId: string;
  file: File;
};

export type CreateAttachmentResult = {
  attachmentId: string;
  storagePath: string;
  kind: "image" | "video" | "audio";
  signedUrl: string | null;
};

export async function uploadConversationAttachment(
  args: CreateAttachmentArgs
): Promise<CreateAttachmentResult | null> {
  const admin = createSupabaseAdminClient();
  const kind = classifyFileKind(args.file.type);
  if (!kind) return null;

  const id = crypto.randomUUID();
  const ext = extensionForMime(args.file.type, args.file.name);
  const storagePath = `conversations/${args.conversationId}/${id}.${ext}`;

  const buffer = Buffer.from(await args.file.arrayBuffer());
  const { error: uploadErr } = await admin.storage
    .from(MAINTENANCE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: args.file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadErr) return null;

  const { data: row, error: rowErr } = await admin
    .from("maintenance_attachments")
    .insert({
      tenant_id: args.tenantId,
      parent_id: args.conversationId,
      parent_type: "conversation",
      kind,
      storage_path: storagePath,
    })
    .select("id")
    .single();

  if (rowErr || !row) {
    await admin.storage.from(MAINTENANCE_BUCKET).remove([storagePath]);
    return null;
  }

  const signedUrl = await signAttachmentUrl(storagePath, 3600);

  return {
    attachmentId: row.id as string,
    storagePath,
    kind,
    signedUrl,
  };
}

export async function getAttachmentsForConversation(
  tenantId: string,
  conversationId: string,
  ids: string[]
): Promise<{ id: string; kind: "image" | "video" | "audio" }[]> {
  if (ids.length === 0) return [];
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("maintenance_attachments")
    .select("id, kind, parent_id, parent_type, tenant_id")
    .in("id", ids)
    .eq("tenant_id", tenantId)
    .eq("parent_id", conversationId)
    .eq("parent_type", "conversation");

  return (data ?? []).map((a) => ({
    id: a.id as string,
    kind: a.kind as "image" | "video" | "audio",
  }));
}
