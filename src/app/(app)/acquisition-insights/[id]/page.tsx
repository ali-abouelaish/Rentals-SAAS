import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";
import { requireModuleAccess } from "@/lib/auth/requireModuleAccess";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getEvaluationById } from "@/features/acquisition-insights/data/evaluations";
import { EvaluationDetailPage } from "@/features/acquisition-insights/ui/EvaluationDetailPage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface Props {
  params: { id: string };
}

export default async function EvaluationDetailRoute({ params }: Props) {
  await requireRole([...ADMIN_ROLES]);
  await requireModuleAccess("property_management");

  const evaluation = await getEvaluationById(params.id);
  if (!evaluation) notFound();

  // Fetch properties for the link modal
  let properties: {
    id: string;
    name: string;
    address_line_1: string;
    area: string | null;
    property_type: string;
    portfolio?: { name: string; color: string } | null;
  }[] = [];

  try {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
      .from("properties")
      .select("id, name, address_line_1, area, property_type, portfolio:portfolios(name, color)")
      .order("name", { ascending: true });
    properties = (data ?? []) as unknown as typeof properties;
  } catch {
    // If DB unavailable, pass empty list — modal will show empty state
  }

  return <EvaluationDetailPage evaluation={evaluation} properties={properties} />;
}
