export type BankName = "barclays" | "hsbc" | "lloyds" | "natwest" | "santander" | "unknown";

export type FileFormat = "csv" | "pdf";

export interface BankDetection {
  bank: BankName;
  format: FileFormat;
  confidence: "high" | "low";
}

export interface ParsedTransaction {
  transaction_date: Date;
  description: string;
  amount_pence: number;
  transaction_type: "credit" | "debit";
  balance_pence?: number;
  reference?: string;
  raw_row: Record<string, string>;
}

export interface ParseResult {
  bank: BankName;
  format: FileFormat;
  transactions: ParsedTransaction[];
  statementFrom: Date | null;
  statementTo: Date | null;
}
