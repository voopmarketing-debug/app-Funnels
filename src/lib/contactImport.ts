// Browser-side CSV reading for "Importar contactos" (ImportContactsDialog).
// Kept dependency-free: Excel and Google Sheets both export CSV, and a
// Spanish-locale Excel uses ";" as the separator, so the delimiter is
// detected from the header row instead of assumed.

export type ImportContactRow = { phone: string; name?: string; email?: string; tags?: string; notes?: string };

export const MAX_IMPORT_ROWS = 5000;

// Column order of the downloadable template — also the "exact data we need"
// contract: only the phone is required; everything else is optional.
export const IMPORT_TEMPLATE_HEADERS = ["telefono", "nombre", "correo", "etiquetas", "notas"] as const;
export const IMPORT_TEMPLATE_EXAMPLE = ["+57 300 123 4567", "María López", "maria@correo.com", "Cliente potencial;Feria 2026", "Pidió precios del plan anual"];

const HEADER_ALIASES: Record<keyof ImportContactRow, string[]> = {
  phone: ["telefono", "teléfono", "celular", "movil", "móvil", "whatsapp", "numero", "número", "phone", "tel"],
  name: ["nombre", "nombre completo", "name", "cliente", "contacto"],
  email: ["correo", "correo electronico", "correo electrónico", "email", "e-mail", "mail"],
  tags: ["etiquetas", "etiqueta", "tags", "tag"],
  notes: ["notas", "nota", "notes", "observaciones", "comentarios"],
};

function detectDelimiter(headerLine: string): string {
  const counts = [";", ",", "\t"].map((d) => [d, headerLine.split(d).length - 1] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

/** RFC 4180-style parser: quoted fields, escaped quotes (""), newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(clean.split(/\r?\n/, 1)[0] ?? "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

export type ParsedImport = { rows: ImportContactRow[]; error: string | null };

/** Maps CSV columns to contact fields by header name (Spanish or English, any order). */
export function rowsFromCsv(text: string): ParsedImport {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], error: "El archivo está vacío." };
  const headers = table[0].map(normalizeHeader);
  const indexOf = (field: keyof ImportContactRow) => headers.findIndex((h) => HEADER_ALIASES[field].includes(h));
  const phoneIdx = indexOf("phone");
  if (phoneIdx === -1) {
    return { rows: [], error: 'No encontramos la columna del teléfono. La primera fila debe tener los títulos, por ejemplo "telefono".' };
  }
  const nameIdx = indexOf("name");
  const emailIdx = indexOf("email");
  const tagsIdx = indexOf("tags");
  const notesIdx = indexOf("notes");
  const cell = (r: string[], idx: number) => (idx >= 0 ? (r[idx] ?? "").trim() : undefined);

  const rows = table.slice(1).map((r) => ({
    phone: cell(r, phoneIdx) ?? "",
    name: cell(r, nameIdx),
    email: cell(r, emailIdx),
    tags: cell(r, tagsIdx),
    notes: cell(r, notesIdx),
  }));
  if (rows.length === 0) return { rows, error: "El archivo solo tiene la fila de títulos, sin contactos." };
  if (rows.length > MAX_IMPORT_ROWS) {
    return { rows: [], error: `El archivo tiene ${rows.length} contactos; el máximo por importación es ${MAX_IMPORT_ROWS}. Divídelo en varios archivos.` };
  }
  return { rows, error: null };
}
