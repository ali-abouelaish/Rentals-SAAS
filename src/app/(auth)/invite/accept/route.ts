import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const baseUrl = request.nextUrl.origin;
  const redirectTo = new URL("/invite/set-password", baseUrl);

  if (!token_hash || !type) {
    return NextResponse.redirect(
      new URL("/auth/error?reason=missing_token", baseUrl)
    );
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type,
  });

  if (error) {
    return NextResponse.redirect(
      new URL("/auth/error?reason=invalid_or_expired", baseUrl)
    );
  }

  return NextResponse.redirect(redirectTo);
}
