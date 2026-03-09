"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ClientForm } from "./ClientForm";
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
  agency_name?: string | null;
  contact_number?: string | null;
  share_code?: string | null;
};

export function ClientEditCard({ client }: { client: Client }) {
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-brand">Edit client</p>
        <Button
          type="button"
          variant={isEditing ? "ghost" : "secondary"}
          size="sm"
          onClick={() => setIsEditing((prev) => !prev)}
        >
          {isEditing ? "Cancel" : "Edit"}
        </Button>
      </div>

      {isEditing && (
        <ClientForm
          clientId={client.id}
          initialValues={initialValues}
          onSuccess={() => setIsEditing(false)}
        />
      )}
    </div>
  );
}
