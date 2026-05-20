import { parseUkDate, toPence } from "../amount";
import type { ParsedTransaction } from "../types";
import { findHeaderLine, getRowValue, parseCsvRows } from "./common";

export function parseLloydsCsv(text: string): ParsedTransaction[] {
  const headerLine = findHeaderLine(text, (line) =>
    /transaction\s+date\s*,\s*transaction\s+type\s*,\s*sort\s+code\s*,\s*account\s+number\s*,\s*transaction\s+description/i.test(
      line,
    ),
  );
  const rows = parseCsvRows(text, headerLine);

  const transactions: ParsedTransaction[] = [];
  for (const row of rows) {
    const dateStr = getRowValue(row, "Transaction Date");
    const typeStr = getRowValue(row, "Transaction Type");
    const description = getRowValue(row, "Transaction Description");
    const debit = getRowValue(row, "Debit Amount");
    const credit = getRowValue(row, "Credit Amount");
    const balance = getRowValue(row, "Balance");

    if (!debit && !credit) continue;

    const date = parseUkDate(dateStr);
    if (!date) continue;

    const debitPence = toPence(debit);
    const creditPence = toPence(credit);

    let amount = 0;
    let txType: "credit" | "debit" = "credit";
    if (creditPence && creditPence > 0) {
      amount = creditPence;
      txType = "credit";
    } else if (debitPence && debitPence > 0) {
      amount = debitPence;
      txType = "debit";
    } else {
      continue;
    }

    transactions.push({
      transaction_date: date,
      description,
      amount_pence: amount,
      transaction_type: txType,
      balance_pence: toPence(balance) ?? undefined,
      reference: typeStr || undefined,
      raw_row: row,
    });
  }
  return transactions;
}
