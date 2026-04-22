import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSharedCookieDomain } from "./cookie-domain";

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  const sharedDomain = getSharedCookieDomain();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          try {
            cookiesToSet.forEach((cookie) => {
              const options = sharedDomain
                ? { ...cookie.options, domain: sharedDomain }
                : cookie.options;
              cookieStore.set(cookie.name, cookie.value, options);
            });
          } catch {
            // Called from a Server Component — middleware handles token refresh
          }
        }
      }
    }
  );
}
