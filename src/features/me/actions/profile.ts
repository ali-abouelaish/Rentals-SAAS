"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUserProfile } from "@/lib/auth/requireRole";

const AVATARS_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function updateMyProfile(formData: FormData) {
  const profile = await requireUserProfile();
  const displayName = formData.get("display_name")?.toString()?.trim();

  if (displayName === undefined || displayName === "") {
    return { error: "Display name is required." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("user_profiles")
    .update({ display_name: displayName })
    .eq("id", profile.id);

  if (error) return { error: error.message };
  revalidatePath("/me");
  revalidatePath("/");
  return { success: true };
}

export async function uploadAvatar(formData: FormData) {
  const profile = await requireUserProfile();
  const file = formData.get("avatar") as File | null;

  if (!file || file.size === 0) {
    return { error: "Please select an image." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { error: "Image must be under 2MB." };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: "Use JPEG, PNG, WebP or GIF." };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpeg", "jpg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
  const path = `${profile.tenant_id}/${profile.id}/avatar.${safeExt}`;

  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const { error: uploadError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return { error: uploadError.message };

  const { data: urlData } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
  // Append timestamp to bust CDN cache on re-upload (same path, new content)
  const publicUrl = `${urlData?.publicUrl ?? ""}?t=${Date.now()}`;

  // Use admin client to bypass RLS — agents may not have UPDATE rights on their own agent_profiles row
  const { error: updateError } = await admin
    .from("agent_profiles")
    .update({ avatar_url: publicUrl })
    .eq("user_id", profile.id);

  if (updateError) return { error: updateError.message };

  revalidatePath("/me");
  revalidatePath("/");
  return { success: true, url: publicUrl };
}

export async function updateMyPhone(formData: FormData) {
  const profile = await requireUserProfile();
  const phone = formData.get("phone")?.toString()?.trim() || null;

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("agent_profiles")
    .update({ phone })
    .eq("user_id", profile.id);

  if (error) return { error: error.message };
  revalidatePath("/me");
  return { success: true };
}

export async function updateMySocialLinks(formData: FormData) {
  const profile = await requireUserProfile();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("agent_profiles")
    .update({
      contact_email: formData.get("contact_email")?.toString()?.trim() || null,
      facebook_url: formData.get("facebook_url")?.toString()?.trim() || null,
      instagram_url: formData.get("instagram_url")?.toString()?.trim() || null,
      linkedin_url: formData.get("linkedin_url")?.toString()?.trim() || null,
    })
    .eq("user_id", profile.id);
  if (error) return { error: error.message };
  revalidatePath("/me");
  return { success: true };
}

export async function requestPasswordReset() {
  await requireUserProfile();
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "No email on your account." };

  const headersList = await headers();
  const origin = headersList.get("origin") ?? headersList.get("x-url") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const redirectTo = `${origin || "http://localhost:3000"}/auth/callback?next=/me`;

  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo
  });
  if (error) return { error: error.message };
  return { success: true };
}
