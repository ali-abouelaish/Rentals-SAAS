import { parseUkDate, toPence } from "../amount";
import type { ParsedTransaction } from "../types";
import { findHeaderLine, parseCsvRows } from "./common";

function findKey(row: Record<string, string>, needles: string[]): string | null {
  const lower = Object.keys(row).map((k) => ({ key: k, lower: k.toLowerCase() }));
  for (const needle of needles) {
    const hit = lower.find((entry) => entry.lower.includes(needle));
    if (hit) return hit.key;
  }
  return null;
}

export function parseGenericCsv(text: string): ParsedTransaction[] {
  const headerLine = findHeaderLine(text, (line) => /date/i.test(line) && /amount|credit|debit|value/i.test(line));
  const rows = parseCsvRows(text, headerLine);

  if (rows.length === 0) return [];

  const sample = rows[0];
  const dateKey = findKey(sample, ["date"]);
  const descKey = findKey(sample, ["description", "memo", "payee", "narrative", "details"]);
  const amountKey = findKey(sample, ["amount", "value"]);
  const creditKey = findKey(sample, ["credit"]);
  const debitKey = findKey(sample, ["debit"]);
  const balanceKey = findKey(sample, ["balance"]);

  if (!dateKey) return [];

  const transactions: ParsedTransaction[] = [];
  for (const row of rows) {
    const dateStr = row[dateKey];
    const date = parseUkDate(dateStr);
    if (!date) continue;

    let amount = 0;
    let type: "credit" | "debit" = "credit";

    if (creditKey && debitKey) {
      const creditPence = toPence(row[creditKey]);
      const debitPence = toPence(row[debitKey]);
      if (creditPence && creditPence > 0) {
        amount = creditPence;
        type = "credit";
      } else if (debitPence && debitPence > 0) {
        amount = debitPence;
        type = "debit";
      } else {
        continue;
      }
    } else if (amountKey) {
      const pence = toPence(row[amountKey]);
      if (pence === null) continue;
      amount = Math.abs(pence);
      type = pence < 0 ? "debit" : "credit";
    } else {
      continue;
    }

    transactions.push({
      transaction_date: date,
      description: descKey ? row[descKey] || "" : "",
      amount_pence: amount,
      transaction_type: type,
      balance_pence: balanceKey ? toPence(row[balanceKey]) ?? undefined : undefined,
      raw_row: row,
    });
  }
  return transactions;
}
