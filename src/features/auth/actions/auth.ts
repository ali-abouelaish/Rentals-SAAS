"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) {
    return { error: error.message };
  }

  const userId = data.user?.id;
  if (userId) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if ((profile?.role ?? "").toLowerCase() === "super_admin") {
      redirect("/admin");
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
