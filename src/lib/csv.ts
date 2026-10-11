// CSV for "Descargar Excel/CSV" buttons. Some cells come from people the
// business doesn't control (a WhatsApp lead's name, a social post's caption,
// a campaign name), so a cell starting with =, +, -, @, tab or CR would run
// as a formula in Excel/Sheets: a leading apostrophe makes it plain text.
// Numbers are left alone (a negative amount is not a formula).
export function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Whole file, with the UTF-8 BOM Excel on Windows needs for accents (á, ñ). */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
