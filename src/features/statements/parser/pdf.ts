import { parseUkDate, toPence } from "./amount";
import type { BankName, ParsedTransaction } from "./types";

type PdfParse = (data: Buffer) => Promise<{ text: string }>;

export async function extractPdfText(buffer: Buffer): Promise<string> {
  // pdf-parse only runs its debug block when it's the entry module
  // (require.main === module), so a normal dynamic import is safe.
  const mod = (await import("pdf-parse")) as unknown as { default: PdfParse } | PdfParse;
  const pdfParse: PdfParse = typeof mod === "function" ? mod : mod.default;
  const result = await pdfParse(buffer);
  return result.text || "";
}

const DATE_PATTERN = /(\d{1,2}[\/\-.\s][A-Za-z]{3,9}[\/\-.\s]\d{2,4}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/;
const AMOUNT_PATTERN = /([£]?-?[\d,]+\.\d{2})(\s*(CR|DR))?/i;

interface LineTokens {
  date: string;
  amounts: Array<{ value: string; isCredit: boolean }>;
  description: string;
}

function tokenizeLine(line: string): LineTokens | null {
  const dateMatch = line.match(DATE_PATTERN);
  if (!dateMatch) return null;

  const amounts: Array<{ value: string; isCredit: boolean }> = [];
  const amountRegex = /([£]?-?[\d,]+\.\d{2})(\s*(CR|DR))?/gi;
  let m: RegExpExecArray | null;
  while ((m = amountRegex.exec(line)) !== null) {
    amounts.push({ value: m[1], isCredit: /CR/i.test(m[3] ?? "") });
  }

  const withoutDate = line.replace(dateMatch[0], " ").trim();
  const description = withoutDate.replace(/([£]?-?[\d,]+\.\d{2})(\s*(CR|DR))?/gi, " ").replace(/\s+/g, " ").trim();

  return { date: dateMatch[0], amounts, description };
}

export function parsePdfText(text: string, bank: BankName): ParsedTransaction[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const transactions: ParsedTransaction[] = [];

  for (const line of lines) {
    const tokens = tokenizeLine(line);
    if (!tokens || tokens.amounts.length === 0) continue;

    const date = parseUkDate(tokens.date);
    if (!date) continue;

    // First amount is the transaction; if a CR suffix is present anywhere, treat as credit.
    const primary = tokens.amounts[0];
    const balance = tokens.amounts.length > 1 ? tokens.amounts[tokens.amounts.length - 1] : null;

    const pence = toPence(primary.value);
    if (pence === null) continue;

    const isCredit = primary.isCredit || (!AMOUNT_PATTERN.test(primary.value) ? false : !primary.value.includes("-"));
    // Heuristic: if the raw token has a leading minus, it's a debit; otherwise the CR/DR suffix decides.
    const hasMinus = primary.value.includes("-");
    const type: "credit" | "debit" = hasMinus
      ? "debit"
      : primary.isCredit
        ? "credit"
        : isCredit
          ? "credit"
          : "debit";

    transactions.push({
      transaction_date: date,
      description: tokens.description || `${bank} transaction`,
      amount_pence: Math.abs(pence),
      transaction_type: type,
      balance_pence: balance ? toPence(balance.value) ?? undefined : undefined,
      raw_row: { line },
    });
  }

  return transactions;
}
