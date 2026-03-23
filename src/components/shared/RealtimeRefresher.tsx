"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Mounts an invisible Supabase Realtime subscription on the given table.
 * On any INSERT / UPDATE / DELETE it calls router.refresh() so the
 * parent server component re-fetches and the UI stays in sync.
 */
export function RealtimeRefresher({ table }: { table: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel(`realtime:${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, router]);

  return null;
}
