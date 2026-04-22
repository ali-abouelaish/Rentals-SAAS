import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSharedCookieDomain } from "./cookie-domain";

export function createSupabaseMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers
    }
  });

  const sharedDomain = getSharedCookieDomain();

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
          // Also set cookies on the response so the browser receives the new tokens.
          // Domain=.<apex> makes the session visible across every tenant subdomain
          // so apex-login → tenant-subdomain handoff doesn't lose the session.
          cookiesToSet.forEach(({ name, value, options }) => {
            const finalOptions = sharedDomain
              ? { ...options, domain: sharedDomain }
              : options;
            response.cookies.set(name, value, finalOptions);
          });
        }
      }
    }
  );

  return { supabase, response };
}
