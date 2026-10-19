"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { propertySchema, propertyEditSchema, type PropertyFormValues } from "../domain/schemas";
import {
  CONTRACTS_BUCKET,
  isMissingColumnError,
  propertyContractDocumentRoute,
} from "@/lib/storage/contractDocuments";

export async function createProperty(values: PropertyFormValues) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  const payload = propertySchema.parse(values);

  const { data: property, error } = await supabase
    .from("properties")
    .insert({ ...payload, tenant_id: profile.tenant_id })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (property.property_type === "hmo") {
    // Auto-create N room units from total_rooms
    const count = payload.total_rooms ?? 0;
    if (count > 0) {
      const rooms = Array.from({ length: count }, () => ({
        tenant_id: profile.tenant_id,
        property_id: property.id,
        unit_type: "room" as const,
        status: "available" as const,
        furnishings: (payload.furnished ? "furnished" : "unfurnished") as "furnished" | "unfurnished",
      }));
      await supabase.from("units").insert(rooms);
    }
  } else {
    // Auto-create one unit for studio/whole_flat
    const unitType = property.property_type as "studio" | "whole_flat";
    await supabase.from("units").insert({
      tenant_id: profile.tenant_id,
      property_id: property.id,
      unit_type: unitType,
      status: "available",
      furnishings: payload.furnished ? "furnished" : "unfurnished",
    });
  }

  revalidatePath("/properties");
  return property;
}

export async function updateProperty(id: string, values: Partial<PropertyFormValues>) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();
  // Edit path: no validations, all fields nullable; null/undefined values are
  // dropped so existing DB values are preserved when the user leaves a field blank.
  const parsed = propertyEditSchema.parse(values);
  const payload = Object.fromEntries(
    Object.entries(parsed).filter(([, v]) => v !== null && v !== undefined)
  );

  const { data, error } = await supabase
    .from("properties")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  // Keep room records in sync when an HMO's room count is raised. We only ever
  // create the shortfall — never auto-delete, since removing a room cascades to
  // its tenancy history. Reducing the count is handled by deleting specific
  // rooms from the "Manage rooms" page.
  if (data.property_type === "hmo" && typeof payload.total_rooms === "number") {
    const { count } = await supabase
      .from("units")
      .select("id", { count: "exact", head: true })
      .eq("property_id", id)
      .eq("tenant_id", profile.tenant_id);
    const existing = count ?? 0;
    const shortfall = payload.total_rooms - existing;
    if (shortfall > 0) {
      const rooms = Array.from({ length: shortfall }, () => ({
        tenant_id: profile.tenant_id,
        property_id: id,
        unit_type: "room" as const,
        status: "available" as const,
        furnishings: (data.furnished ? "furnished" : "unfurnished") as "furnished" | "unfurnished",
      }));
      await supabase.from("units").insert(rooms);
    }
  }

  revalidatePath("/properties");
  return data;
}

export async function deleteProperty(id: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { error } = await supabase
    .from("properties")
    .delete()
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id);
  if (error) throw new Error(error.message);

  revalidatePath("/properties");
}

const LANDLORD_CONTRACT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const LANDLORD_CONTRACT_MAX_BYTES = 20 * 1024 * 1024;

/**
 * Upload the landlord contract for a property into private storage.
 *
 * Previously the browser uploaded straight to the (then public) bucket and
 * stored the public URL. The file now lives under the agency's own prefix and
 * contract_document_url is a stable route that signs a short-lived link per
 * click, after checking the caller can see the property.
 */
export async function uploadPropertyContractDocument(
  propertyId: string,
  formData: FormData
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file to upload." };
  if (file.size > LANDLORD_CONTRACT_MAX_BYTES) return { ok: false, error: "File too large (max 20MB)." };
  if (!LANDLORD_CONTRACT_TYPES.includes(file.type)) {
    return { ok: false, error: "Upload the contract as a PDF or Word document." };
  }

  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (!property) return { ok: false, error: "Property not found." };

  const ext = (file.name.split(".").pop() ?? "pdf").toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
  const path = `${profile.tenant_id}/properties/${propertyId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(CONTRACTS_BUCKET)
    .upload(path, file, { contentType: file.type });
  if (uploadError) {
    console.error("[properties] landlord contract upload failed", uploadError);
    return { ok: false, error: "The contract couldn't be uploaded. Please try again." };
  }

  const url = propertyContractDocumentRoute(propertyId);
  const { error: urlError } = await supabase
    .from("properties")
    .update({ contract_document_url: url, updated_at: new Date().toISOString() })
    .eq("id", propertyId)
    .eq("tenant_id", profile.tenant_id);
  if (urlError) return { ok: false, error: "The contract uploaded but couldn't be linked. Please try again." };

  const { error: pathError } = await supabase
    .from("properties")
    .update({ contract_document_path: path })
    .eq("id", propertyId)
    .eq("tenant_id", profile.tenant_id);
  if (pathError && !isMissingColumnError(pathError)) {
    return { ok: false, error: "The contract uploaded but couldn't be linked. Please try again." };
  }

  revalidatePath("/properties");
  revalidatePath(`/properties/${propertyId}`);
  return { ok: true, url };
}
