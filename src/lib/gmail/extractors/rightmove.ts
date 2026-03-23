import * as cheerio from "cheerio";

export type RightmoveLeadData = {
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
  let decoded = text.replace(/=\r?\n/g, "");
  decoded = decoded.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  return decoded;
}

function stripHtml(html: string): string {
  const $ = cheerio.load(html);
  $("br").replaceWith("\n");
  $("p, div, tr, li").each((_, el) => {
    $(el).append("\n");
  });
  return $.root().text();
}

const HOT_KEYWORDS = ["urgent", "asap", "immediately", "call me", "today", "tomorrow"];

/**
 * Rightmove lead extractor — stub pending a real Rightmove email sample.
 * Field label patterns will need adjusting once a sample is available.
 */
export function extractRightmoveLead(rawBody: string): RightmoveLeadData | null {
  const decoded = decodeQuotedPrintable(rawBody);
  const cleaned = stripHtml(decoded);
  const text = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  if (!text.includes("Name:") || !text.includes("Email:")) {
    return null;
  }

  const extract = (pattern: RegExp): string | null => {
    const m = text.match(pattern);
    return m ? m[1].trim() : null;
  };

  const name = extract(/Name:\s*(.+)/i);
  const email = extract(/Email(?:\s*address)?:\s*([\w.\-+]+@[\w.\-]+)/i);
  const telephone = extract(/(?:Telephone|Phone|Contact\s*number)(?:\s*number)?:\s*([\+\d\s()\-]+)/i);
  const address = extract(/(?:Address|Property\s*address):\s*(.+)/i);
  const full_address = extract(/Full address:\s*(.+)/i);
  const property_ref = extract(/(?:Property\s*ref(?:erence)?|Ref):\s*(.+)/i);

  const urlMatch = text.match(/https?:\/\/www\.rightmove\.co\.uk\/[^\s>]+/);
  const property_url = urlMatch ? urlMatch[0].trim() : null;

  if (!email || !name) return null;

  const telephone_clean = telephone ? telephone.replace(/[^\d+]/g, "") : null;

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
    message_text: null,
    is_hot,
    has_phone,
  };
}
