"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Plus, XCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CertificateModal } from "./CertificateModal";
import {
  CERTIFICATE_TYPES,
  CERTIFICATE_TYPE_LABELS,
  certificateStatus,
  type Certificate,
  type CertificateStatus,
  type CertificateType,
} from "../domain/types";

const SHORT_TYPE_LABELS: Record<CertificateType, string> = {
  gas_safety: "Gas",
  eicr: "EICR",
  epc: "EPC",
  fire_alarm: "Fire",
  emergency_lighting: "Em. Light",
  legionella: "Legionella",
  pat: "PAT",
  hmo_licence: "HMO",
};

const CELL_TONES: Record<CertificateStatus, string> = {
  expired: "bg-error-bg text-error-fg border-error-border",
  expiring_soon: "bg-warning-bg text-warning-fg border-warning-border",
  valid: "bg-success-bg text-success-fg border-success-border",
};

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "2-digit",
});

const LONG_DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function fmtDate(iso: string, fmt: Intl.DateTimeFormat = DATE_FMT): string {
  return fmt.format(new Date(`${iso}T00:00:00Z`));
}

interface ComplianceDashboardProps {
  certificates: Certificate[];
  properties: Array<{ id: string; name: string }>;
  suppliers: Array<{ id: string; name: string }>;
}

export function ComplianceDashboard({
  certificates,
  properties,
  suppliers,
}: ComplianceDashboardProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  const { counts, attention, matrix } = useMemo(() => {
    const counts = { expired: 0, expiring_soon: 0, valid: 0 };
    const attention: Certificate[] = [];
    // Latest certificate (max expiry) per property per type.
    const matrix = new Map<string, Partial<Record<CertificateType, Certificate>>>();

    for (const cert of certificates) {
      const status = certificateStatus(cert.expiry_date);
      counts[status] += 1;
      if (status !== "valid") attention.push(cert);

      const row = matrix.get(cert.property_id) ?? {};
      const current = row[cert.type];
      if (!current || cert.expiry_date > current.expiry_date) {
        row[cert.type] = cert;
        matrix.set(cert.property_id, row);
      }
    }
    attention.sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
    return { counts, attention, matrix };
  }, [certificates]);

  const kpis = [
    {
      key: "expired" as const,
      label: "Expired",
      icon: XCircle,
      count: counts.expired,
      tone: "text-error-fg",
      iconBg: "bg-error-bg",
      hint: "Certificates past their expiry date — the property is out of compliance.",
    },
    {
      key: "expiring_soon" as const,
      label: "Expiring within 30 days",
      icon: AlertCircle,
      count: counts.expiring_soon,
      tone: "text-warning-fg",
      iconBg: "bg-warning-bg",
      hint: "Book renewals now — expiry automations chase the issuing contractor.",
    },
    {
      key: "valid" as const,
      label: "Valid",
      icon: CheckCircle2,
      count: counts.valid,
      tone: "text-success-fg",
      iconBg: "bg-success-bg",
      hint: "Certificates in date with more than 30 days remaining.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Compliance</h1>
          <p className="text-xs text-foreground-secondary">
            Certificate status across the portfolio — red is expired, amber expires within
            30 days, green is valid. Set up expiry alerts under Automations.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setModalOpen(true)}
          title="Record a certificate; open a property page to attach one to a specific room"
        >
          <Plus className="h-3.5 w-3.5" />
          Add certificate
        </Button>
      </div>

      {/* Portfolio KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.key}
              className="rounded-bento bg-surface-card shadow-bento p-5"
              title={kpi.hint}
            >
              <div className="flex items-center gap-3">
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", kpi.iconBg)}>
                  <Icon className={cn("h-4.5 w-4.5", kpi.tone)} strokeWidth={1.8} />
                </div>
                <div>
                  <p className={cn("text-2xl font-bold leading-tight", kpi.tone)}>{kpi.count}</p>
                  <p className="text-xs text-foreground-muted">{kpi.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Needs attention */}
      {attention.length > 0 && (
        <div className="rounded-bento bg-surface-card shadow-bento p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Needs attention</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-foreground-muted border-b border-border">
                  <th className="py-2 pr-3 font-medium">Property</th>
                  <th className="py-2 pr-3 font-medium">Certificate</th>
                  <th className="py-2 pr-3 font-medium">Expires</th>
                  <th className="py-2 pr-3 font-medium">Contractor</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {attention.map((cert) => (
                  <tr key={cert.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-3">
                      <Link
                        href={`/properties/${cert.property_id}`}
                        className="font-medium text-foreground hover:text-brand transition-colors"
                        title="Open the property's Certificates tab to renew or replace"
                      >
                        {cert.property?.name ?? cert.property?.address_line_1 ?? "Property"}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3 text-foreground-secondary">
                      {CERTIFICATE_TYPE_LABELS[cert.type]}
                      {cert.reference ? ` · ${cert.reference}` : ""}
                    </td>
                    <td className="py-2.5 pr-3 text-foreground-secondary whitespace-nowrap">
                      {fmtDate(cert.expiry_date, LONG_DATE_FMT)}
                    </td>
                    <td className="py-2.5 pr-3 text-foreground-secondary">
                      {cert.contractor?.name ?? "—"}
                    </td>
                    <td className="py-2.5">
                      <StatusBadge status={certificateStatus(cert.expiry_date)} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-property matrix */}
      <div className="rounded-bento bg-surface-card shadow-bento p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">By property</h2>
        {properties.length === 0 ? (
          <p className="text-sm text-foreground-muted py-6 text-center">
            No properties yet — add properties to start compliance tracking.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-foreground-muted border-b border-border">
                  <th className="py-2 pr-3 font-medium">Property</th>
                  {CERTIFICATE_TYPES.map((t) => (
                    <th
                      key={t}
                      className="py-2 pr-3 font-medium whitespace-nowrap"
                      title={CERTIFICATE_TYPE_LABELS[t]}
                    >
                      {SHORT_TYPE_LABELS[t]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {properties.map((property) => {
                  const row = matrix.get(property.id) ?? {};
                  return (
                    <tr key={property.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        <Link
                          href={`/properties/${property.id}`}
                          className="font-medium text-foreground hover:text-brand transition-colors"
                        >
                          {property.name}
                        </Link>
                      </td>
                      {CERTIFICATE_TYPES.map((type) => {
                        const cert = row[type];
                        if (!cert) {
                          return (
                            <td
                              key={type}
                              className="py-2.5 pr-3 text-foreground-muted"
                              title={`No ${CERTIFICATE_TYPE_LABELS[type]} on record`}
                            >
                              —
                            </td>
                          );
                        }
                        const status = certificateStatus(cert.expiry_date);
                        return (
                          <td key={type} className="py-2.5 pr-3">
                            <span
                              title={`${CERTIFICATE_TYPE_LABELS[type]} — expires ${fmtDate(cert.expiry_date, LONG_DATE_FMT)}`}
                              className={cn(
                                "inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
                                CELL_TONES[status]
                              )}
                            >
                              {fmtDate(cert.expiry_date)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <CertificateModal
          properties={properties}
          suppliers={suppliers}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            setModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
