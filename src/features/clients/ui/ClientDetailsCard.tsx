"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils/formatters";
import { ClientForm } from "./ClientForm";
import { ClientStatusSelect } from "./ClientStatusSelect";
import type { ClientFormValues } from "../domain/schemas";

type Client = {
  id: string;
  full_name: string | null;
  dob: string | null;
  phone: string | null;
  email: string | null;
  nationality: string | null;
  current_address: string | null;
  company_or_university_name: string | null;
  company_address: string | null;
  occupation: string | null;
  status: string | null;
  assigned_agent_id: string | null;
  created_at: string;
  agency_name?: string | null;
  contact_number?: string | null;
  share_code?: string | null;
};

export function ClientDetailsCard({ client }: { client: Client }) {
  const [isEditing, setIsEditing] = useState(false);

  const initialValues: Partial<ClientFormValues> = {
    full_name: client.full_name ?? "",
    dob: client.dob ?? "",
    phone: client.phone ?? "",
    email: client.email ?? "",
    nationality: client.nationality ?? "",
    current_address: client.current_address ?? "",
    company_or_university_name: client.company_or_university_name ?? "",
    company_address: client.company_address ?? "",
    occupation: client.occupation ?? "",
    status: (client.status as ClientFormValues["status"]) ?? "pending",
    assigned_agent_id: client.assigned_agent_id ?? undefined,
    agency_name: client.agency_name ?? "",
    contact_number: client.contact_number ?? "",
    share_code: client.share_code ?? "",
  };

  return (
    <Card>
      <CardContent className="space-y-6 pt-5">
        <div className="flex justify-end">
          <Button
            type="button"
            variant={isEditing ? "ghost" : "secondary"}
            size="sm"
            onClick={() => setIsEditing((prev) => !prev)}
          >
            {isEditing ? "Cancel" : "Edit"}
          </Button>
        </div>

        {isEditing ? (
          <ClientForm
            clientId={client.id}
            initialValues={initialValues}
            onSuccess={() => setIsEditing(false)}
          />
        ) : (
          <>
            <div>
              <p className="text-xs font-semibold uppercase text-foreground-muted mb-3">
                Personal information
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-xs text-foreground-muted">Full name</p>
                  <p className="text-sm text-foreground">{client.full_name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">Phone</p>
                  <p className="text-sm text-foreground">{client.phone ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">Email</p>
                  <p className="text-sm text-foreground">{client.email ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">Date of birth</p>
                  <p className="text-sm text-foreground">{client.dob ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">Nationality</p>
                  <p className="text-sm text-foreground">{client.nationality ?? "—"}</p>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <p className="text-xs text-foreground-muted">Current address</p>
                  <p className="text-sm text-foreground">{client.current_address ?? "—"}</p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-foreground-muted mb-3">
                Company / University
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-xs text-foreground-muted">Company / University name</p>
                  <p className="text-sm text-foreground">
                    {client.company_or_university_name ?? "—"}
                  </p>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <p className="text-xs text-foreground-muted">Company / University address</p>
                  <p className="text-sm text-foreground">{client.company_address ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">Occupation</p>
                  <p className="text-sm text-foreground">{client.occupation ?? "—"}</p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-foreground-muted mb-3">
                Agency & contact
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-xs text-foreground-muted">Agency name</p>
                  <p className="text-sm text-foreground">{client.agency_name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">Contact number</p>
                  <p className="text-sm text-foreground">{client.contact_number ?? "—"}</p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-foreground-muted mb-3">
                Share code
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-xs text-foreground-muted">Share code</p>
                  <p className="text-sm text-foreground">{client.share_code ?? "—"}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border">
              <div>
                <p className="text-xs text-foreground-muted mb-1.5">Status</p>
                <ClientStatusSelect clientId={client.id} currentStatus={client.status} />
              </div>
              <div>
                <p className="text-xs text-foreground-muted">Created</p>
                <p className="text-sm text-foreground">{formatDate(client.created_at)}</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
