import { parseUkDate, toPence } from "../amount";
import type { ParsedTransaction } from "../types";
import { findHeaderLine, getRowValue, parseCsvRows } from "./common";

export function parseSantanderCsv(text: string): ParsedTransaction[] {
  const headerLine = findHeaderLine(text, (line) =>
    /date\s*,\s*description\s*,\s*amount/i.test(line),
  );
  const rows = parseCsvRows(text, headerLine);

  const transactions: ParsedTransaction[] = [];
  for (const row of rows) {
    const dateStr = getRowValue(row, "Date");
    const description = getRowValue(row, "Description");
    const amountStr = getRowValue(row, "Amount");
    if (!dateStr || !amountStr) continue;

    const date = parseUkDate(dateStr);
    const pence = toPence(amountStr);
    if (!date || pence === null) continue;

    transactions.push({
      transaction_date: date,
      description,
      amount_pence: Math.abs(pence),
      transaction_type: pence < 0 ? "debit" : "credit",
      raw_row: row,
    });
  }
  return transactions;
}
