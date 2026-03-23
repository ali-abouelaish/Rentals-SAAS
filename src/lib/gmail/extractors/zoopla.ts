import * as cheerio from "cheerio";

export type ZooplaLeadData = {
  name: string;
  email: string;
  telephone: string | null;
  telephone_clean: string | null;
  address: string | null;
  full_address: string | null;
  property_ref: string | null;
  property_url: string | null;
  message_text: string | null;
  is_hot: boolean;
  has_phone: boolean;
};

function decodeQuotedPrintable(text: string): string {
  // Remove soft line breaks
  let decoded = text.replace(/=\r?\n/g, "");
  // Decode =XX hex sequences
  decoded = decoded.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  return decoded;
}

function stripHtml(html: string): string {
  const $ = cheerio.load(html);
  // Replace block-level elements with newlines before extracting text
  $("br").replaceWith("\n");
  $("p, div, tr, li").each((_, el) => {
    $(el).append("\n");
  });
  return $.root().text();
}

const HOT_KEYWORDS = ["urgent", "asap", "immediately", "call me", "today", "tomorrow"];

export function extractZooplaLead(rawBody: string): ZooplaLeadData | null {
  // Step 1: Remove soft line breaks and decode quoted-printable
  const decoded = decodeQuotedPrintable(rawBody);

  // Step 2: Strip HTML using cheerio
  const cleaned = stripHtml(decoded);

  // Step 3: Normalize line endings
  const text = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Step 4: Quick structure check
  if (!text.includes("Name:") || !text.includes("Email:")) {
    return null;
  }

  // Step 5: Extract multi-line message (stops before address/footer fields)
  let message_text: string | null = null;
  const msgMatch = text.match(
    /Message:\s*([\s\S]*?)(?=\n(?:Address:|Full address:|Your property ref:|---|$))/i
  );
  if (msgMatch) {
    message_text = msgMatch[1].trim().replace(/\n{3,}/g, "\n\n") || null;
  }

  // Step 6: Extract simple fields
  const extract = (pattern: RegExp): string | null => {
    const m = text.match(pattern);
    return m ? m[1].trim() : null;
  };

  const name = extract(/Name:\s*(.+)/i);
  const email = extract(/Email(?:\s*address)?:\s*([\w.\-+]+@[\w.\-]+)/i);
  const telephone = extract(/(?:Telephone|Phone)(?:\s*number)?:\s*([\+\d\s()\-]+)/i);
  const address = extract(/Address:\s*(.+)/i);
  const full_address = extract(/Full address:\s*(.+)/i);
  const property_ref = extract(/Your property ref:\s*(.+)/i);

  // Step 7: Extract Zoopla property link
  const urlMatch = text.match(/https?:\/\/www\.zoopla\.co\.uk\/[^\s>]+/);
  const property_url = urlMatch ? urlMatch[0].trim() : null;

  // Step 8: Validate — must have at least name and email
  if (!email || !name) return null;

  // Step 9: Clean telephone
  const telephone_clean = telephone ? telephone.replace(/[^\d+]/g, "") : null;

  // Step 10: Enrichment
  const lowerText = text.toLowerCase();
  const is_hot = HOT_KEYWORDS.some((kw) => lowerText.includes(kw));
  const has_phone = !!telephone;

  return {
    name,
    email,
    telephone,
    telephone_clean,
    address,
    full_address,
    property_ref,
    property_url,
    message_text,
    is_hot,
    has_phone,
  };
}
