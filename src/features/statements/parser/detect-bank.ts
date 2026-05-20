import type { BankDetection, BankName, FileFormat } from "./types";

interface Signature {
  bank: BankName;
  match: (text: string) => boolean;
}

const CSV_SIGNATURES: Signature[] = [
  {
    bank: "barclays",
    match: (text) => /date\s*,\s*memo\s*,\s*amount/i.test(text) || /barclays/i.test(text.slice(0, 500)),
  },
  {
    bank: "hsbc",
    match: (text) => /date\s*,\s*payee\s*,\s*amount\s+paid\s+out\s*,\s*amount\s+received/i.test(text),
  },
  {
    bank: "lloyds",
    match: (text) =>
      /transaction\s+date\s*,\s*transaction\s+type\s*,\s*sort\s+code\s*,\s*account\s+number\s*,\s*transaction\s+description\s*,\s*debit\s+amount\s*,\s*credit\s+amount/i.test(
        text,
      ),
  },
  {
    bank: "natwest",
    match: (text) =>
      /date\s*,\s*type\s*,\s*description\s*,\s*value\s*,\s*balance\s*,\s*account\s+name\s*,\s*account\s+number\s*,\s*sort\s+code/i.test(
        text,
      ),
  },
  {
    bank: "santander",
    match: (text) =>
      /santander/i.test(text.slice(0, 500)) && /date\s*,\s*description\s*,\s*amount/i.test(text),
  },
];

const PDF_BANK_HINTS: Array<{ bank: BankName; needle: RegExp }> = [
  { bank: "barclays", needle: /barclays/i },
  { bank: "hsbc", needle: /hsbc/i },
  { bank: "lloyds", needle: /lloyds/i },
  { bank: "natwest", needle: /nat\s*west|natwest/i },
  { bank: "santander", needle: /santander/i },
];

export function detectBankFromCsv(text: string): BankDetection {
  for (const sig of CSV_SIGNATURES) {
    if (sig.match(text)) {
      return { bank: sig.bank, format: "csv", confidence: "high" };
    }
  }
  return { bank: "unknown", format: "csv", confidence: "low" };
}

export function detectBankFromPdf(text: string): BankDetection {
  const head = text.slice(0, 500);
  for (const { bank, needle } of PDF_BANK_HINTS) {
    if (needle.test(head)) {
      return { bank, format: "pdf", confidence: "high" };
    }
  }
  return { bank: "unknown", format: "pdf", confidence: "low" };
}

export function detectFormatFromFilename(filename: string, mimeType: string): FileFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv") || mimeType.includes("csv")) return "csv";
  if (lower.endsWith(".pdf") || mimeType.includes("pdf")) return "pdf";
  return null;
}
