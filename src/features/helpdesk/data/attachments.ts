import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupportAttachment } from "../domain/types";

export const SUPPORT_BUCKET = "support-attachments";

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5 && /^[a-z0-9]+$/i.test(fromName)) return fromName.toLowerCase();
  switch (file.type) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "application/pdf":
      return "pdf";
    case "text/csv":
      return "csv";
    case "text/plain":
      return "txt";
    default:
      return "bin";
  }
}

/**
 * Upload one file into the private bucket and return its storage path.
 *
 * Path is `<tenantId>/tickets/<ticketId>/<uuid>.<ext>` — tenant id FIRST, the
 * convention every other bucket authorises on. Callers must already have proved
 * the ticket belongs to `tenantId` before calling this.
 */
export async function uploadSupportFile(
  tenantId: string,
  ticketId: string,
  file: File
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const storagePath = `${tenantId}/tickets/${ticketId}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage.from(SUPPORT_BUCKET).upload(storagePath, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) {
    console.error("[helpdesk.upload]", error.message);
    return null;
  }
  return storagePath;
}

/** Compensating delete when the attachment row could not be written. */
export async function removeSupportFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const admin = createSupabaseAdminClient();
  await admin.storage.from(SUPPORT_BUCKET).remove(paths);
}

type AttachmentRow = {
  id: string;
  message_id: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  storage_path: string;
};

/**
 * Sign URLs for attachment rows the caller has ALREADY been allowed to read
 * (via RLS on the agency side, or requireSuperAdmin on the platform side).
 * Never pass a storage path that came from user input.
 */
export async function signAttachments(rows: AttachmentRow[]): Promise<SupportAttachment[]> {
  if (rows.length === 0) return [];
  const admin = createSupabaseAdminClient();
  const { data } = await admin.storage
    .from(SUPPORT_BUCKET)
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      3600
    );
  const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return rows.map((r) => ({
    id: r.id,
    message_id: r.message_id,
    file_name: r.file_name,
    mime_type: r.mime_type,
    size_bytes: r.size_bytes,
    created_at: r.created_at,
    signed_url: byPath.get(r.storage_path) ?? null,
  }));
}

export const ATTACHMENT_COLUMNS =
  "id, message_id, file_name, mime_type, size_bytes, created_at, storage_path";
