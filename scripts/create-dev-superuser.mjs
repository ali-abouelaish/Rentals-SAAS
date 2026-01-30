import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.env.DEV_SUPERUSER_EMAIL;
const PASSWORD = process.env.DEV_SUPERUSER_PASSWORD;
const TENANT_NAME = process.env.DEV_TENANT_NAME || "Dev Agency";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !EMAIL || !PASSWORD) {
  console.error("Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEV_SUPERUSER_EMAIL, DEV_SUPERUSER_PASSWORD.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function ensureTenant() {
  const { data: existing, error } = await supabase
    .from("tenants")
    .select("id")
    .eq("name", TENANT_NAME)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing.id;

  const { data: created, error: createError } = await supabase
    .from("tenants")
    .insert({ name: TENANT_NAME })
    .select("id")
    .single();
  if (createError) throw createError;
  return created.id;
}

async function getUserIdByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;
  const match = data.users.find((user) => user.email === email);
  return match?.id ?? null;
}

async function main() {
  const tenantId = await ensureTenant();

  let userId = null;
  const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true
  });

  if (createError) {
    if (createError.message?.includes("registered")) {
      userId = await getUserIdByEmail(EMAIL);
    } else {
      throw createError;
    }
  } else {
    userId = createdUser?.user?.id ?? null;
  }

  if (!userId) {
    throw new Error("Unable to resolve user ID.");
  }

  const { error: profileError } = await supabase
    .from("user_profiles")
    .upsert({
      id: userId,
      tenant_id: tenantId,
      role: "admin",
      display_name: "Super Admin"
    });
  if (profileError) throw profileError;

  const { error: agentError } = await supabase
    .from("agent_profiles")
    .upsert({
      user_id: userId,
      tenant_id: tenantId,
      commission_percent: 25,
      marketing_fee: 50,
      role_flags: { is_agent: true, is_marketing: true }
    });
  if (agentError) throw agentError;

  console.log(`Super user ready: ${EMAIL}`);
}

main().catch((error) => {
  console.error("Failed:", error.message);
  process.exit(1);
});
