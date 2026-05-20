import { parseBarclaysCsv } from "./csv/barclays";
import { parseGenericCsv } from "./csv/generic";
import { parseHsbcCsv } from "./csv/hsbc";
import { parseLloydsCsv } from "./csv/lloyds";
import { parseNatwestCsv } from "./csv/natwest";
import { parseSantanderCsv } from "./csv/santander";
import { detectBankFromCsv, detectBankFromPdf, detectFormatFromFilename } from "./detect-bank";
import { extractPdfText, parsePdfText } from "./pdf";
import type { BankName, ParseResult, ParsedTransaction } from "./types";

const CSV_PARSERS: Record<BankName, (text: string) => ParsedTransaction[]> = {
  barclays: parseBarclaysCsv,
  hsbc: parseHsbcCsv,
  lloyds: parseLloydsCsv,
  natwest: parseNatwestCsv,
  santander: parseSantanderCsv,
  unknown: parseGenericCsv,
};

export async function parseStatement(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<ParseResult> {
  const format = detectFormatFromFilename(filename, mimeType);
  if (!format) {
    throw new Error("Unsupported file type. Upload a CSV or PDF.");
  }

  let bank: BankName;
  let transactions: ParsedTransaction[] = [];

  if (format === "csv") {
    const text = fileBuffer.toString("utf-8");
    const detection = detectBankFromCsv(text);
    bank = detection.bank;
    transactions = CSV_PARSERS[bank](text);
  } else {
    const text = await extractPdfText(fileBuffer);
    const detection = detectBankFromPdf(text);
    bank = detection.bank;
    transactions = parsePdfText(text, bank);
  }

  let statementFrom: Date | null = null;
  let statementTo: Date | null = null;
  for (const tx of transactions) {
    if (!statementFrom || tx.transaction_date < statementFrom) statementFrom = tx.transaction_date;
    if (!statementTo || tx.transaction_date > statementTo) statementTo = tx.transaction_date;
  }

  return { bank, format, transactions, statementFrom, statementTo };
}

export { detectBankFromCsv, detectBankFromPdf } from "./detect-bank";
export type { BankName, ParseResult, ParsedTransaction } from "./types";
