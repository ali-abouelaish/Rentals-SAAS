import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { token_hash, type } = await request.json();

    if (!token_hash) {
      return NextResponse.json(
        { redirectTo: "/auth/error?reason=missing_token" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();

    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type || "invite",
    });

    if (error) {
      return NextResponse.json(
        { redirectTo: "/auth/error?reason=invalid_or_expired" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { redirectTo: "/invite/set-password" },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { redirectTo: `/auth/error?reason=server_error` },
      { status: 500 }
    );
  }
}

