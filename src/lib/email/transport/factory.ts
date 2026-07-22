import type { Agency } from "../branding";
import { ResendTransport } from "./resend";
import { GraphTransport } from "./graph";
import { GmailTransport } from "./gmail";
import { SmtpTransport } from "./smtp";
import type { EmailProviderConfig, Transport } from "./types";

/**
 * Resolve the transport for an agency. Anything that isn't an active custom
 * provider — no config, resend_default, or a non-active status — falls back to
 * the central Resend mailer, so agencies that configure nothing behave exactly
 * as before.
 */
export function getTransport(agency: Agency, config: EmailProviderConfig | null): Transport {
  if (!config || config.status !== "active" || config.type === "resend_default") {
    return new ResendTransport(agency);
  }

  switch (config.type) {
    case "graph":
      return new GraphTransport(agency, config);
    case "gmail":
      return new GmailTransport(agency, config);
    case "smtp":
      return new SmtpTransport(agency, config);
    default:
      return new ResendTransport(agency);
  }
}
