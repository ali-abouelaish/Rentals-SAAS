import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export function createSupabaseMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers
    }
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          // Update request cookies so refreshed tokens are visible to server actions/components
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          // Rebuild response with updated request headers so cookies propagate
          response = NextResponse.next({ request });
          // Also set cookies on the response so the browser receives the new tokens
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  return { supabase, response };
}
