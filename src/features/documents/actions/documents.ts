"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserProfile } from "@/lib/auth/requireRole";
import type { DocumentSetType } from "../domain/types";

const REQUIRED_COUNTS: Record<DocumentSetType, number> = {
  sourcing_agreement: 4,
  client_id: 1,
  payment_proof: 1
};

export async function uploadDocuments(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const rentalCodeId = String(formData.get("rental_code_id") ?? "");
  const setType = String(formData.get("document_set_type") ?? "") as DocumentSetType;
  const files = formData.getAll("files") as File[];

  if (!rentalCodeId || !setType) {
    throw new Error("Missing rental code or document set type.");
  }

  const minCount = REQUIRED_COUNTS[setType];
  const isPdf =
    files.length === 1 &&
    files[0] &&
    files[0].type === "application/pdf";
  if (setType === "sourcing_agreement") {
    if (!isPdf && files.length !== minCount) {
      throw new Error("Sourcing agreement requires 4 images or a single PDF.");
    }
  } else if (files.length < minCount) {
    throw new Error("Please upload at least one document.");
  }

  const { data: setData, error: setError } = await supabase
    .from("document_sets")
    .insert({
      tenant_id: profile.tenant_id,
      rental_code_id: rentalCodeId,
      set_type: setType
    })
    .select("*")
    .single();
  if (setError) throw new Error(setError.message);

  for (const file of files) {
    const filePath = `${profile.tenant_id}/${rentalCodeId}/${setType}/${crypto.randomUUID()}-${
      file.name
    }`;

    const { error: uploadError } = await supabase.storage
      .from("rental_docs")
      .upload(filePath, file);
    if (uploadError) throw new Error(uploadError.message);

    const { error: docError } = await supabase.from("documents").insert({
      tenant_id: profile.tenant_id,
      document_set_id: setData.id,
      file_path: filePath,
      file_name: file.name
    });
    if (docError) throw new Error(docError.message);
  }

  await supabase.from("activity_log").insert({
    tenant_id: profile.tenant_id,
    actor_user_id: profile.id,
    action: "documents_uploaded",
    entity_type: "rental",
    entity_id: rentalCodeId,
    metadata: { set_type: setType, count: files.length }
  });

  revalidatePath(`/rentals/${rentalCodeId}`);
  return { ok: true };
}
