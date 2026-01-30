export type DocumentSetType = "sourcing_agreement" | "client_id" | "payment_proof";

export type Document = {
  id: string;
  tenant_id: string;
  document_set_id: string;
  file_path: string;
  file_name: string;
  created_at: string;
};
