"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { certificateInputSchema, type CertificateInput } from "../domain/types";

const BUCKET = "certificate_docs";
const MAX_FILE_BYTES = 20 * 1024 * 1024;

type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateCertificatePages(propertyId: string) {
  revalidatePath("/compliance");
  revalidatePath(`/properties/${propertyId}`);
}

/** Upload via the admin client (private bucket has no insert policy) after the role check. */
async function uploadDocument(
  tenantId: string,
  propertyId: string,
  file: File
): Promise<{ path: string } | { error: string }> {
  if (file.size > MAX_FILE_BYTES) {
    return { error: "Document must be 20 MB or smaller." };
  }
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
  const path = `${tenantId}/${propertyId}/${crypto.randomUUID()}-${safeName}`;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type || "application/pdf",
    });
  if (error) return { error: error.message };
  return { path };
}

async function removeDocument(path: string | null) {
  if (!path) return;
  const admin = createSupabaseAdminClient();
  // Best-effort: an orphaned file must never block the row mutation.
  await admin.storage.from(BUCKET).remove([path]).catch(() => undefined);
}

export async function createCertificate(
  input: CertificateInput,
  formData?: FormData
): Promise<ActionResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const parsed = certificateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  let documentPath: string | null = null;
  const file = formData?.get("document");
  if (file instanceof File && file.size > 0) {
    const uploaded = await uploadDocument(profile.tenant_id, parsed.data.propertyId, file);
    if ("error" in uploaded) return { ok: false, error: uploaded.error };
    documentPath = uploaded.path;
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("certificates").insert({
    tenant_id: profile.tenant_id,
    property_id: parsed.data.propertyId,
    unit_id: parsed.data.unitId,
    type: parsed.data.type,
    issue_date: parsed.data.issueDate,
    expiry_date: parsed.data.expiryDate,
    contractor_id: parsed.data.contractorId,
    reference: parsed.data.reference || null,
    notes: parsed.data.notes || null,
    document_url: documentPath,
  });
  if (error) {
    await removeDocument(documentPath);
    return { ok: false, error: error.message };
  }

  revalidateCertificatePages(parsed.data.propertyId);
  return { ok: true };
}

export async function updateCertificate(
  id: string,
  input: CertificateInput,
  formData?: FormData
): Promise<ActionResult> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const parsed = certificateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const supabase = createSupabaseServerClient();
  const { data: existing, error: fetchErr } = await supabase
    .from("certificates")
    .select("id, property_id, document_url")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!existing) return { ok: false, error: "Certificate not found" };

  let documentPath = existing.document_url as string | null;
  const file = formData?.get("document");
  if (file instanceof File && file.size > 0) {
    const uploaded = await uploadDocument(profile.tenant_id, parsed.data.propertyId, file);
    if ("error" in uploaded) return { ok: false, error: uploaded.error };
    await removeDocument(existing.document_url as string | null);
    documentPath = uploaded.path;
  }

  const { error } = await supabase
    .from("certificates")
    .update({
      property_id: parsed.data.propertyId,
      unit_id: parsed.data.unitId,
      type: parsed.data.type,
      issue_date: parsed.data.issueDate,
      expiry_date: parsed.data.expiryDate,
      contractor_id: parsed.data.contractorId,
      reference: parsed.data.reference || null,
      notes: parsed.data.notes || null,
      document_url: documentPath,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidateCertificatePages(parsed.data.propertyId);
  if (existing.property_id !== parsed.data.propertyId) {
    revalidatePath(`/properties/${existing.property_id}`);
  }
  return { ok: true };
}

export async function deleteCertificate(id: string): Promise<ActionResult> {
  await requireRole([...ADMIN_ROLES]);

  const supabase = createSupabaseServerClient();
  const { data: existing, error: fetchErr } = await supabase
    .from("certificates")
    .select("id, property_id, document_url")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!existing) return { ok: false, error: "Certificate not found" };

  const { error } = await supabase.from("certificates").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await removeDocument(existing.document_url as string | null);
  revalidateCertificatePages(existing.property_id as string);
  return { ok: true };
}
