import Papa from "papaparse";

export function parseCsvRows(text: string, skipLines = 0): Record<string, string>[] {
  let body = text;
  if (skipLines > 0) {
    const lines = text.split(/\r?\n/);
    body = lines.slice(skipLines).join("\n");
  }

  const result = Papa.parse<Record<string, string>>(body, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  return result.data.filter((row) => row && Object.keys(row).length > 0);
}

export function findHeaderLine(text: string, predicate: (line: string) => boolean): number {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (predicate(lines[i])) return i;
  }
  return 0;
}

export function getRowValue(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const matched = Object.keys(row).find((k) => k.toLowerCase() === key.toLowerCase());
    if (matched && row[matched] !== undefined && row[matched] !== null) {
      return String(row[matched]).trim();
    }
  }
  return "";
}
