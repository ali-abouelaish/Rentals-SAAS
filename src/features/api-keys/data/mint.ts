import "server-only";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateApiKey } from "@/lib/api-keys/hash";
import type { ApiScope } from "@/lib/api-keys/scopes";

/**
 * Create a public API key and return its plaintext. This is the only moment
 * the plaintext exists server-side; only sha256(key) is stored.
 *
 * Deliberately not a server action: every export of a "use server" file is a
 * callable endpoint, and this one takes the tenant and scopes as arguments.
 * Callers are server actions that have already checked the role and the
 * entitlement. The insert still runs as the signed-in user, so RLS (admins of
 * the same tenant only) applies on top. Omitting `scopes` keeps the column
 * default, a listings-read key.
 */
export async function mintPublicApiKey(input: {
  tenantId: string;
  createdBy: string;
  label: string;
  scopes?: readonly ApiScope[];
}): Promise<{ id: string; plaintext: string }> {
  const { plaintext, hash, prefix } = generateApiKey();

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("public_api_keys")
    .insert({
      tenant_id: input.tenantId,
      label: input.label,
      key_hash: hash,
      key_prefix: prefix,
      created_by: input.createdBy,
      ...(input.scopes ? { scopes: [...input.scopes] } : {}),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { id: data.id as string, plaintext };
}

/** Keys are listed on both pages, so a change made from either refreshes both. */
export function revalidateApiKeyPages() {
  revalidatePath("/settings/api-keys");
  revalidatePath("/leads/settings");
}
