"use client";

import { useEffect } from "react";
import { useRecentEntities } from "../hooks/useRecentEntities";
import type { SearchResultKind } from "../domain/types";

type Props = {
  tenantId: string;
  kind: SearchResultKind;
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
};

/**
 * Drop into a detail page to record the visit in the recent-entities
 * store. Renders nothing.
 *
 *   <TrackEntityVisit
 *     tenantId={profile.tenant_id}
 *     kind="property"
 *     id={property.id}
 *     title={property.address_line_1}
 *     subtitle={property.postcode}
 *     href={`/properties/${property.id}`}
 *   />
 */
export function TrackEntityVisit({
  tenantId,
  kind,
  id,
  title,
  subtitle = null,
  href,
}: Props) {
  const { push } = useRecentEntities(tenantId);

  useEffect(() => {
    if (!id || !title) return;
    push({ kind, id, title, subtitle, href });
  }, [push, kind, id, title, subtitle, href]);

  return null;
}
