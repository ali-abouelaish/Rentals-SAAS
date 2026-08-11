export type SheetRunStatus = "running" | "success" | "failed";

/** `{ "<sheet header>": "<listing field key>" }` — unmapped headers are absent. */
export type ColumnMap = Record<string, string>;

/** The spreadsheet-related slice of a landlord record. */
export type LandlordSheet = {
  id: string;
  name: string;
  spreadsheet_url: string | null;
  spreadsheet_header_row: number | null;
  spreadsheet_column_map: ColumnMap | null;
  /**
   * Sheet header names combined to identify a row across reads. Empty means
   * fall back to the default chain (mapped reference column → listing URL →
   * title/address/price fingerprint).
   */
  spreadsheet_key_columns: string[] | null;
  spreadsheet_last_run_at: string | null;
  spreadsheet_last_status: SheetRunStatus | null;
  spreadsheet_last_error: string | null;
  spreadsheet_last_row_count: number | null;
};

export type LandlordSheetRun = {
  id: string;
  tenant_id: string;
  landlord_id: string;
  started_at: string;
  finished_at: string | null;
  status: SheetRunStatus;
  trigger: "schedule" | "manual";
  rows_seen: number;
  rows_created: number;
  rows_updated: number;
  rows_skipped: number;
  error_message: string | null;
  notes: string[];
};

/** A parsed sheet, before any mapping is applied. */
export type SheetGrid = {
  /** Every cell as a string, including the rows above the header. */
  rows: string[][];
  /** Zero-based index of the row that looks like the header. */
  headerRow: number;
  /** Trimmed cells of `rows[headerRow]`, de-duplicated. */
  headers: string[];
  /** Data rows below the header, keyed by header. */
  records: Record<string, string>[];
  /**
   * Real hyperlink targets per data row, keyed by header — only populated when
   * the sheet was read through the Sheets API. CSV export discards them, which
   * is why a cell linked to a Drive folder but labelled "Pictures" arrives as
   * just that word.
   */
  links: Record<string, string>[];
  /** Sheet/tab name where the parser could determine one. */
  sheetName: string | null;
};

/** One auto-detected header → field guess, surfaced on the review screen. */
export type MappingSuggestion = {
  header: string;
  field: string | null;
  /** 0–1. Anything below `AUTO_ACCEPT_CONFIDENCE` renders as "please check". */
  confidence: number;
  /** Up to 3 non-empty values from the column, shown as evidence. */
  samples: string[];
};

/** What the mapping-review dialog loads when it opens. */
export type SheetPreview = {
  sheet_name: string | null;
  /** 1-based, to match spreadsheet row numbers. */
  header_row: number;
  headers: string[];
  suggestions: MappingSuggestion[];
  total_rows: number;
  /** The mapping currently stored on the landlord, if any. */
  saved_column_map: ColumnMap;
  /** The row-identity columns currently stored on the landlord. */
  saved_key_columns: string[];
};

export type SheetRunSummary = {
  ok: boolean;
  rows_seen: number;
  rows_created: number;
  rows_updated: number;
  rows_skipped: number;
  error?: string;
  /** True when this read detected the mapping rather than replaying a saved one. */
  auto_mapped?: boolean;
};
