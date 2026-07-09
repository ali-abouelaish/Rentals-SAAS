import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { requireModuleAccess } from "@/lib/auth/requireModuleAccess";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getEntitlements } from "@/lib/entitlements/getEntitlements";
import {
  getConnection,
  listProtections,
  listReleaseRequests,
} from "@/features/mydeposits/data/protections";
import { listTdsDeposits, getTdsConnectionSummary } from "@/features/tds/data/deposits";
import { listDpsDeposits, getDpsConnectionSummary } from "@/features/dps/data/deposits";
import {
  DepositsHub,
  type MdProviderData,
  type TdsProviderData,
  type DpsProviderData,
  type ProviderError,
} from "@/features/deposits/ui/DepositsHub";

function toProviderError(err: unknown): ProviderError {
  const message = err instanceof Error ? err.message : "Unknown error";
  const missingTable = message.includes("schema cache") || message.includes("does not exist");
  return { message, missingTable };
}

async function loadMd(): Promise<MdProviderData> {
  try {
    const [connection, protections, releaseRequests] = await Promise.all([
      getConnection(),
      listProtections(),
      listReleaseRequests(),
    ]);
    return { ok: true, connection, protections, releaseRequests };
  } catch (err) {
    return { ok: false, error: toProviderError(err) };
  }
}

async function loadTds(): Promise<TdsProviderData> {
  try {
    const [deposits, connection] = await Promise.all([
      listTdsDeposits(),
      getTdsConnectionSummary(),
    ]);
    return { ok: true, deposits, connection };
  } catch (err) {
    return { ok: false, error: toProviderError(err) };
  }
}

async function loadDps(): Promise<DpsProviderData> {
  try {
    const [deposits, connection] = await Promise.all([
      listDpsDeposits(),
      getDpsConnectionSummary(),
    ]);
    return { ok: true, deposits, connection };
  } catch (err) {
    return { ok: false, error: toProviderError(err) };
  }
}

export default async function DepositsRoute() {
  await requireRole([...ADMIN_ROLES]);
  await requireModuleAccess("property_management");

  const entitlements = await getEntitlements();
  const hasMd = entitlements.has("mydeposits");
  const hasTds = entitlements.has("tds");
  const hasDps = entitlements.has("dps");
  if (!hasMd && !hasTds && !hasDps) {
    redirect("/dashboard?view=pm");
  }

  const [md, tds, dps] = await Promise.all([
    hasMd ? loadMd() : Promise.resolve(null),
    hasTds ? loadTds() : Promise.resolve(null),
    hasDps ? loadDps() : Promise.resolve(null),
  ]);

  return <DepositsHub md={md} tds={tds} dps={dps} />;
}
