import type { Agency } from "../branding";

export type EmailProviderType = "resend_default" | "graph" | "gmail" | "smtp";

export type EmailProviderStatus = "active" | "unverified" | "disabled" | "error";

/** A single outbound message, transport-agnostic. */
export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Override the From address. When omitted, the transport decides
   *  (Resend pins Harbor Ops; custom transports use their configured from_address). */
  from?: string;
  /** Override the Reply-To. When omitted, the Resend transport uses the agency contact_email. */
  replyTo?: string;
  /** pm_tenants.id — adds a List-Unsubscribe mailto (Resend transport only). */
  pmTenantId?: string;
  /** Recorded in email_log.template_key for auditing. */
  templateKey?: string;
};

/** OAuth credential blob (graph / gmail), stored encrypted. */
export type OAuthCredentials = {
  accessToken: string;
  refreshToken: string;
  /** ISO timestamp of access-token expiry. */
  expiry: string;
};

/** SMTP credential blob, stored encrypted. */
export type SmtpCredentials = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
};

/** A decrypted email_providers row. */
export type EmailProviderConfig = {
  tenantId: string;
  type: EmailProviderType;
  status: EmailProviderStatus;
  fromAddress: string | null;
  fromName: string | null;
  replyTo: string | null;
  /** Decrypted credentials, shape depends on `type`. Null for resend_default. */
  credentials: OAuthCredentials | SmtpCredentials | null;
};

export type TransportResult = { messageId: string };

/** A concrete outbound email transport. */
export interface Transport {
  readonly type: EmailProviderType;
  send(message: EmailMessage): Promise<TransportResult>;
}

/** Context shared with every transport at construction time. */
export type TransportContext = {
  agency: Agency;
  config: EmailProviderConfig | null;
};
