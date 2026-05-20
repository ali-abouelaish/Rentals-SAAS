import { parseUkDate, toPence } from "../amount";
import type { ParsedTransaction } from "../types";
import { findHeaderLine, getRowValue, parseCsvRows } from "./common";

export function parseNatwestCsv(text: string): ParsedTransaction[] {
  const headerLine = findHeaderLine(text, (line) =>
    /date\s*,\s*type\s*,\s*description\s*,\s*value\s*,\s*balance/i.test(line),
  );
  const rows = parseCsvRows(text, headerLine);

  const transactions: ParsedTransaction[] = [];
  for (const row of rows) {
    const dateStr = getRowValue(row, "Date");
    const typeStr = getRowValue(row, "Type");
    const description = getRowValue(row, "Description");
    const value = getRowValue(row, "Value");
    const balance = getRowValue(row, "Balance");
    if (!dateStr || !value) continue;

    const date = parseUkDate(dateStr);
    const pence = toPence(value);
    if (!date || pence === null) continue;

    transactions.push({
      transaction_date: date,
      description,
      amount_pence: Math.abs(pence),
      transaction_type: pence < 0 ? "debit" : "credit",
      balance_pence: toPence(balance) ?? undefined,
      reference: typeStr || undefined,
      raw_row: row,
    });
  }
  return transactions;
}
