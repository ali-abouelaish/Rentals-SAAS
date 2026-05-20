import { parseUkDate, toPence } from "../amount";
import type { ParsedTransaction } from "../types";
import { findHeaderLine, getRowValue, parseCsvRows } from "./common";

export function parseHsbcCsv(text: string): ParsedTransaction[] {
  const headerLine = findHeaderLine(text, (line) =>
    /date\s*,\s*payee\s*,\s*amount\s+paid\s+out\s*,\s*amount\s+received/i.test(line),
  );
  const rows = parseCsvRows(text, headerLine);

  const transactions: ParsedTransaction[] = [];
  for (const row of rows) {
    const dateStr = getRowValue(row, "Date");
    const payee = getRowValue(row, "Payee");
    const paidOut = getRowValue(row, "Amount Paid out", "Amount Paid Out");
    const received = getRowValue(row, "Amount Received");
    const balance = getRowValue(row, "Balance");

    const date = parseUkDate(dateStr);
    if (!date) continue;

    const paidOutPence = toPence(paidOut);
    const receivedPence = toPence(received);

    let amount = 0;
    let type: "credit" | "debit" = "credit";
    if (receivedPence && receivedPence > 0) {
      amount = receivedPence;
      type = "credit";
    } else if (paidOutPence && paidOutPence > 0) {
      amount = paidOutPence;
      type = "debit";
    } else {
      continue;
    }

    transactions.push({
      transaction_date: date,
      description: payee,
      amount_pence: amount,
      transaction_type: type,
      balance_pence: toPence(balance) ?? undefined,
      raw_row: row,
    });
  }
  return transactions;
}
