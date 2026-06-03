import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUserProfile } from "@/lib/auth/requireRole";
import type {
  ContractTemplate,
  ContractTemplateField,
  ContractTemplateWithFields,
} from "../domain/types";

export const TEMPLATE_SOURCE_BUCKET = "contract_template_sources";
const SIGNED_URL_TTL = 60 * 60; // 1 hour

export async function listContractTemplates(filters?: {
  portfolioId?: string | null;
  includeInactive?: boolean;
}): Promise<ContractTemplate[]> {
  const profile = await requireUserProfile();
  const supabase = createSupabaseServerClient();

  let query = supabase
    .from("contract_templates")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .order("updated_at", { ascending: false });

  if (!filters?.includeInactive) {
    query = query.eq("is_active", true);
  }
  if (filters?.portfolioId !== undefined) {
    if (filters.portfolioId === null) {
      query = query.is("portfolio_id", null);
    } else {
      query = query.or(`portfolio_id.is.null,portfolio_id.eq.${filters.portfolioId}`);
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ContractTemplate[];
}

export async function getContractTemplate(id: string): Promise<ContractTemplateWithFields | null> {
  const profile = await requireUserProfile();
  const supabase = createSupabaseServerClient();

  const { data: template, error } = await supabase
    .from("contract_templates")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .single();
  if (error || !template) return null;

  const { data: fields, error: fieldsError } = await supabase
    .from("contract_template_fields")
    .select("*")
    .eq("template_id", id)
    .eq("tenant_id", profile.tenant_id)
    .order("page_index", { ascending: true })
    .order("sort_order", { ascending: true });
  if (fieldsError) throw new Error(fieldsError.message);

  const signedUrl = await getTemplateSourceSignedUrl(template.source_pdf_path);

  return {
    ...(template as ContractTemplate),
    fields: (fields ?? []) as ContractTemplateField[],
    source_signed_url: signedUrl,
  };
}

export async function getTemplateSourceSignedUrl(path: string): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(TEMPLATE_SOURCE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Failed to sign template source URL");
  }
  return data.signedUrl;
}

export async function getContractTemplateFields(templateId: string): Promise<ContractTemplateField[]> {
  const profile = await requireUserProfile();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("contract_template_fields")
    .select("*")
    .eq("template_id", templateId)
    .eq("tenant_id", profile.tenant_id)
    .order("page_index", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ContractTemplateField[];
}
