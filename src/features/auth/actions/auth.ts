"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTenantFromHost } from "@/lib/tenant";

export async function signInWithEmail(
  _prevState: { error?: string } | undefined,
  formData: FormData
) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const headersList = headers();
  const host = headersList.get("host") ?? "";
  const currentTenantFromHost = host ? getTenantFromHost(host) : null;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) {
    return { error: error.message || "Invalid email or password." };
  }

  const userId = data.user?.id;
  if (userId) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, tenant_id")
      .eq("id", userId)
      .single();

    const role = (profile?.role ?? "").toLowerCase();
    const tenantId = profile?.tenant_id as string | undefined;

    if (role === "super_admin") {
      redirect("/admin");
    }

    if (tenantId) {
      const { data: tenant } = await admin
        .from("tenants")
        .select("slug")
        .eq("id", tenantId)
        .maybeSingle();

      const slug = tenant?.slug as string | undefined;
      const portalDomainEnv = process.env.APP_PORTAL_DOMAIN;

      if (slug && portalDomainEnv) {
        const baseDomain = portalDomainEnv.replace(/^https?:\/\//, "").replace(/\/$/, "");
        const targetHost = `${slug}.${baseDomain}`;

        // If we're already on the correct tenant subdomain, just send them to dashboard.
        if (currentTenantFromHost === slug) {
          redirect("/dashboard");
        }

        const targetUrl = new URL(`https://${targetHost}`);
        targetUrl.pathname = "/dashboard";
        redirect(targetUrl.toString());
      }
    }
  }

  redirect("/dashboard");
}

export async function signUpWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password
  });
  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordResetForSignedOut(
  _prevState: { ok?: boolean; error?: string; message?: string },
  formData: FormData
) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Email is required." };
  }

  const supabase = createSupabaseServerClient();
  const headersList = headers();
  const origin =
    headersList.get("origin") ??
    headersList.get("x-url") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`
  });

  if (error) {
    return { error: error.message };
  }

  return {
    ok: true,
    message: "If this email exists, a reset link has been sent."
  };
}
