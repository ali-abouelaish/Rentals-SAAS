import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");

  const baseUrl = request.nextUrl.origin;
  const redirectTo = new URL("/invite/set-password", baseUrl);

  if (!token_hash) {
    return NextResponse.redirect(
      new URL("/auth/error?reason=missing_token", baseUrl)
    );
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type: "invite",
  });

  if (error) {
    return NextResponse.redirect(
      new URL("/auth/error?reason=invalid_or_expired", baseUrl)
    );
  }

  return NextResponse.redirect(redirectTo);
}
