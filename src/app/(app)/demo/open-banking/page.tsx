import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  OpenBankingDemoView,
  type OpenBankingAccount,
  type OpenBankingConnection,
  type Portfolio
} from "./view";

export const dynamic = "force-dynamic";

type SearchParams = { connected?: string; error?: string };

export default async function OpenBankingDemoPage({
  searchParams
}: {
  searchParams?: SearchParams;
}) {
  await requireRole([...ADMIN_ROLES]);

  const supabase = createSupabaseServerClient();

  const [portfoliosRes, connectionsRes, accountsRes] = await Promise.all([
    supabase.from("portfolios").select("id, name, color").order("name", { ascending: true }),
    supabase
      .from("ob_connections")
      .select("id, aspsp_name, aspsp_country, status, valid_until, created_at, portfolio_id")
      .order("created_at", { ascending: false }),
    supabase
      .from("ob_accounts")
      .select("id, connection_id, eb_account_uid, iban, account_name, currency, last_synced_at")
  ]);

  return (
    <OpenBankingDemoView
      portfolios={(portfoliosRes.data ?? []) as Portfolio[]}
      connections={(connectionsRes.data ?? []) as OpenBankingConnection[]}
      accounts={(accountsRes.data ?? []) as OpenBankingAccount[]}
      connectedFlag={searchParams?.connected === "true"}
      errorFlag={searchParams?.error ?? null}
    />
  );
}
