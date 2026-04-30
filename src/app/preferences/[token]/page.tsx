import { verifyPreferenceToken } from "@/lib/preferences/token";
import { loadPreferenceContext, loadRequestsForPmTenant } from "@/features/preferences/data/queries";
import { InvalidLink } from "./InvalidLink";
import { PreferencesView } from "./PreferencesView";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { token: string };
type SearchParams = { done?: string; err?: string };

export default async function PreferencesPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const claims = verifyPreferenceToken(params.token);
  if (!claims) return <InvalidLink />;

  const ctx = await loadPreferenceContext(claims.pmTenantId);
  if (!ctx) return <InvalidLink />;

  const requests = await loadRequestsForPmTenant(claims.pmTenantId);

  return (
    <PreferencesView
      ctx={ctx}
      requests={requests}
      token={params.token}
      doneCode={searchParams.done ?? null}
      errorCode={searchParams.err ?? null}
    />
  );
}
