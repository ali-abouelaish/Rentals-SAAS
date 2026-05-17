import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OpenBankingDemoView, type OpenBankingAccount, type OpenBankingConnection } from "./view";

export const dynamic = "force-dynamic";

type SearchParams = { connected?: string; error?: string };

export default async function OpenBankingDemoPage({
  searchParams
}: {
  searchParams?: SearchParams;
}) {
  await requireRole([...ADMIN_ROLES]);

  const supabase = createSupabaseServerClient();
  const { data: connections } = await supabase
    .from("ob_connections")
    .select("id, aspsp_name, aspsp_country, status, valid_until, created_at")
    .order("created_at", { ascending: false });

  const { data: accounts } = await supabase
    .from("ob_accounts")
    .select("id, connection_id, eb_account_uid, iban, account_name, currency, last_synced_at");

  return (
    <OpenBankingDemoView
      connections={(connections ?? []) as OpenBankingConnection[]}
      accounts={(accounts ?? []) as OpenBankingAccount[]}
      connectedFlag={searchParams?.connected === "true"}
      errorFlag={searchParams?.error ?? null}
    />
  );
}
