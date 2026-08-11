"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { deleteCertificate } from "../actions/certificates";
import { CertificateModal } from "./CertificateModal";
import {
  CERTIFICATE_TYPE_LABELS,
  certificateStatus,
  type Certificate,
} from "../domain/types";

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function fmtDate(iso: string): string {
  return DATE_FMT.format(new Date(`${iso}T00:00:00Z`));
}

interface CertificatesPanelProps {
  property: { id: string; name: string };
  certificates: Certificate[];
  units: Array<{ id: string; label: string }>;
  suppliers: Array<{ id: string; name: string }>;
}

export function CertificatesPanel({
  property,
  certificates,
  units,
  suppliers,
}: CertificatesPanelProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Certificate | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(cert: Certificate) {
    const label = CERTIFICATE_TYPE_LABELS[cert.type];
    if (!window.confirm(`Delete the ${label} certificate? This also removes its document.`)) {
      return;
    }
    setDeletingId(cert.id);
    try {
      const result = await deleteCertificate(cert.id);
      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success("Certificate deleted");
        router.refresh();
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rounded-bento bg-surface-card shadow-bento p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 pb-1 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10">
            <ShieldCheck className="h-4 w-4 text-brand" strokeWidth={1.8} />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Compliance certificates</h2>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          title="Record a new certificate for this property"
        >
          <Plus className="h-3.5 w-3.5" />
          Add certificate
        </Button>
      </div>

      {certificates.length === 0 ? (
        <p className="text-sm text-foreground-muted py-6 text-center">
          No certificates recorded yet. Add the gas safety, EICR, and EPC certificates to
          start compliance tracking.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-foreground-muted border-b border-border">
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Unit</th>
                <th className="py-2 pr-3 font-medium">Reference</th>
                <th className="py-2 pr-3 font-medium">Contractor</th>
                <th className="py-2 pr-3 font-medium">Issued</th>
                <th className="py-2 pr-3 font-medium">Expires</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {certificates.map((cert) => (
                <tr key={cert.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-foreground">
                    {CERTIFICATE_TYPE_LABELS[cert.type]}
                  </td>
                  <td className="py-2.5 pr-3 text-foreground-secondary">
                    {cert.unit?.room_number
                      ? `Room ${cert.unit.room_number}`
                      : cert.unit_id
                        ? "Unit"
                        : "Whole property"}
                  </td>
                  <td className="py-2.5 pr-3 text-foreground-secondary">
                    {cert.reference || "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-foreground-secondary">
                    {cert.contractor?.name ?? "—"}
                  </td>
                  <td className="py-2.5 pr-3 text-foreground-secondary whitespace-nowrap">
                    {fmtDate(cert.issue_date)}
                  </td>
                  <td className="py-2.5 pr-3 text-foreground-secondary whitespace-nowrap">
                    {fmtDate(cert.expiry_date)}
                  </td>
                  <td className="py-2.5 pr-3">
                    <StatusBadge status={certificateStatus(cert.expiry_date)} size="sm" />
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {cert.document_url && (
                        <a
                          href={`/api/certificates/download?path=${encodeURIComponent(cert.document_url)}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Download the certificate document"
                          className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-inset transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(cert);
                          setModalOpen(true);
                        }}
                        title="Edit this certificate"
                        className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-inset transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cert)}
                        disabled={deletingId === cert.id}
                        title="Delete this certificate and its document"
                        className="p-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <CertificateModal
          certificate={editing}
          property={property}
          units={units}
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
