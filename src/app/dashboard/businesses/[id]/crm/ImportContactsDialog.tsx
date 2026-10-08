"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importContacts, type ImportContactsResult } from "@/lib/actions";
import {
  IMPORT_TEMPLATE_EXAMPLE,
  IMPORT_TEMPLATE_HEADERS,
  MAX_IMPORT_ROWS,
  rowsFromCsv,
  type ImportContactRow,
} from "@/lib/contactImport";

// Sent in chunks: a server action's request body is capped at 1MB, which a
// few thousand rows with notes could exceed.
const IMPORT_CHUNK_SIZE = 1000;

// Excel's "CSV" export on Windows is often Windows-1252, not UTF-8 — decoding
// it as UTF-8 would turn every "María" into "Mar�a". Try strict UTF-8 first,
// fall back to Windows-1252.
function decodeCsv(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

function downloadTemplate() {
  // ";" + BOM so a double-click opens it in Excel (Spanish locale) with real
  // columns and accents intact; the importer detects either separator.
  const csv = "﻿" + [IMPORT_TEMPLATE_HEADERS.join(";"), IMPORT_TEMPLATE_EXAMPLE.join(";")].join("\r\n") + "\r\n";
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla-contactos.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportContactsDialog({ businessId, stages }: { businessId: string; stages: { id: string; name: string }[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [formKey, setFormKey] = useState(0);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFormKey((k) => k + 1);
          dialogRef.current?.showModal();
        }}
        className="rounded-md border border-border-strong px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent"
      >
        ⇪ Importar
      </button>
      <dialog ref={dialogRef} className="fl-card-hero w-[calc(100%-2rem)] max-w-lg p-0">
        <ImportForm key={formKey} businessId={businessId} stages={stages} onClose={() => dialogRef.current?.close()} />
      </dialog>
    </>
  );
}

function ImportForm({
  businessId,
  stages,
  onClose,
}: {
  businessId: string;
  stages: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportContactRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [countryCode, setCountryCode] = useState("57");
  const [result, setResult] = useState<ImportContactsResult | null>(null);

  async function onFile(file: File | undefined) {
    setError(null);
    setRows([]);
    setResult(null);
    if (!file) return;
    setFileName(file.name);
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setError('Sube un archivo .csv. En Excel: Archivo → Guardar como → "CSV UTF-8". En Google Sheets: Archivo → Descargar → CSV.');
      return;
    }
    const parsed = rowsFromCsv(decodeCsv(await file.arrayBuffer()));
    if (parsed.error) setError(parsed.error);
    else setRows(parsed.rows);
  }

  function runImport() {
    setError(null);
    startTransition(async () => {
      try {
        const total: ImportContactsResult = { created: 0, updated: 0, skipped: [] };
        for (let i = 0; i < rows.length; i += IMPORT_CHUNK_SIZE) {
          const res = await importContacts(businessId, rows.slice(i, i + IMPORT_CHUNK_SIZE), {
            stageId: stageId || null,
            countryCode,
            rowOffset: i,
          });
          total.created += res.created;
          total.updated += res.updated;
          total.skipped.push(...res.skipped);
        }
        setResult(total);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo importar");
      }
    });
  }

  const inputClass =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-base text-ink outline-none focus:border-accent md:text-sm";

  if (result) {
    return (
      <div className="space-y-4 p-5">
        <h2 className="text-base font-semibold text-ink">Importación terminada</h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-xl font-bold text-accent">{result.created}</p>
            <p className="text-[13px] text-ink-muted">nuevos</p>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-xl font-bold text-ink">{result.updated}</p>
            <p className="text-[13px] text-ink-muted">actualizados</p>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <p className={`text-xl font-bold ${result.skipped.length ? "text-error" : "text-ink"}`}>{result.skipped.length}</p>
            <p className="text-[13px] text-ink-muted">con problemas</p>
          </div>
        </div>
        {result.skipped.length > 0 && (
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-background p-3 text-xs text-ink-muted">
            {result.skipped.slice(0, 50).map((s, i) => (
              <li key={i}>
                {s.row > 0 && <span className="fl-mono text-ink-faint">Fila {s.row}:</span>} {s.reason}
              </li>
            ))}
            {result.skipped.length > 50 && <li>…y {result.skipped.length - 50} más</li>}
          </ul>
        )}
        <p className="text-[13px] text-ink-faint">
          Los contactos que ya existían conservaron su etapa y sus datos; solo se completaron los campos vacíos y se sumaron etiquetas.
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
          >
            Listo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-5">
      <div>
        <h2 className="text-base font-semibold text-ink">Importar contactos</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Sube un archivo CSV con estas columnas (solo el teléfono es obligatorio, hasta {MAX_IMPORT_ROWS.toLocaleString("es-CO")} contactos):
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-surface-2 text-ink-muted">
            <tr>
              {IMPORT_TEMPLATE_HEADERS.map((h) => (
                <th key={h} className="fl-mono whitespace-nowrap px-2 py-1.5 font-semibold">
                  {h}
                  {h === "telefono" && " *"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="text-ink-faint">
              {IMPORT_TEMPLATE_EXAMPLE.map((v, i) => (
                <td key={i} className="whitespace-nowrap px-2 py-1.5">
                  {v}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <ul className="space-y-0.5 text-[13px] text-ink-faint">
        <li>• Teléfono con indicativo del país (ej. +57…). Sin indicativo se usa el de abajo.</li>
        <li>• Varias etiquetas en la misma celda, separadas por punto y coma (;).</li>
        <li>• Un teléfono que ya está en el CRM no se duplica: se completan sus datos vacíos.</li>
      </ul>
      <button type="button" onClick={downloadTemplate} className="text-xs font-semibold text-accent hover:underline">
        ↓ Descargar plantilla de ejemplo
      </button>

      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border-strong bg-background px-3 py-4 text-sm text-ink-muted transition hover:border-accent hover:text-ink">
        <input type="file" accept=".csv,text/csv,.txt" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        {fileName ? `📄 ${fileName}` : "Elegir archivo CSV"}
      </label>

      {rows.length > 0 && (
        <p className="text-xs text-accent">
          ✓ {rows.length.toLocaleString("es-CO")} contacto{rows.length === 1 ? "" : "s"} listo{rows.length === 1 ? "" : "s"} para importar
        </p>
      )}

      <div className="grid grid-cols-[1fr_auto] gap-3">
        {stages.length > 0 && (
          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink-muted">Etapa para los nuevos</span>
            <select value={stageId} onChange={(e) => setStageId(e.target.value)} className={inputClass}>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block w-24 space-y-1">
          <span className="text-xs font-medium text-ink-muted">Indicativo</span>
          <div className="flex items-center gap-1">
            <span className="text-sm text-ink-muted">+</span>
            <input
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
              inputMode="numeric"
              className={inputClass}
            />
          </div>
        </label>
      </div>

      {error && <p className="text-xs font-medium text-error">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-4 py-2 text-sm text-ink-muted transition hover:text-ink"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={runImport}
          disabled={isPending || rows.length === 0 || !countryCode}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
        >
          {isPending ? "Importando..." : "Importar"}
        </button>
      </div>
    </div>
  );
}
