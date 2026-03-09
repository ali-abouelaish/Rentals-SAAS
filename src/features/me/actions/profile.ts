"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAgentOnly } from "@/lib/auth/requireRole";

const AVATARS_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function updateMyProfile(formData: FormData) {
  const profile = await requireAgentOnly();
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
  const profile = await requireAgentOnly();
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

  const { error: uploadError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return { error: uploadError.message };

  const { data: urlData } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
  const publicUrl = urlData?.publicUrl ?? "";

  const { error: updateError } = await supabase
    .from("agent_profiles")
    .update({ avatar_url: publicUrl })
    .eq("user_id", profile.id);

  if (updateError) return { error: updateError.message };

  revalidatePath("/me");
  revalidatePath("/");
  return { success: true, url: publicUrl };
}

export async function requestPasswordReset() {
  await requireAgentOnly();
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
