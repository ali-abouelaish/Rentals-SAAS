import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase admin env vars.");
  }
  if (serviceKey === anonKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must be different from the anon key.");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false }
  });
}
