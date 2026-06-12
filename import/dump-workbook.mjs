// Diagnostic dump of the portfolio workbook: every tab, every cell, plus hyperlinks.
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";

const file = process.argv[2] ?? "import/source/PORTFOLIO AVAILIABILITY.xlsx";
const wb = XLSX.read(readFileSync(file), { cellDates: true, cellNF: true, cellText: true });

console.log("SheetNames:", JSON.stringify(wb.SheetNames));

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const ref = ws["!ref"] ?? "(empty)";
  console.log(`\n===== TAB: ${name} | ref=${ref} =====`);
  if (!ws["!ref"]) continue;
  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let r = range.s.r; r <= range.e.r; r++) {
    const cells = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;
      let v = cell.w ?? cell.v;
      if (v instanceof Date) v = v.toISOString();
      let s = `${XLSX.utils.encode_col(c)}=${JSON.stringify(v)}`;
      if (cell.t && cell.t !== "s") s += `(t:${cell.t})`;
      if (cell.l) s += `[LINK:${JSON.stringify(cell.l.Target ?? cell.l)}]`;
      cells.push(s);
    }
    if (cells.length) console.log(`row ${r + 1}: ${cells.join(" | ")}`);
  }
}
