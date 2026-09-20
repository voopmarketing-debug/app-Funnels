"use client";

// A .csv, not a real .xlsx — Excel (and Sheets, Numbers) opens it natively
// with one double-click, no plugin or extra library needed, so this covers
// "descargar en Excel" without adding a binary spreadsheet dependency for
// what's ultimately a flat table. The UTF-8 BOM is required for Excel on
// Windows to render Spanish accents (á, é, ñ, …) correctly instead of
// garbling them — Sheets/Numbers ignore the BOM harmlessly.
function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escapeCell = (value: string | number): string => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  return "﻿" + lines.join("\r\n");
}

export function DownloadCsvButton({
  filename,
  headers,
  rows,
  label = "Descargar Excel",
  className,
}: {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  label?: string;
  className?: string;
}) {
  function handleDownload() {
    const blob = new Blob([toCsv(headers, rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={rows.length === 0}
      className={
        className ??
        "flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
      }
    >
      <DownloadIcon /> {label}
    </button>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 3.5v12M12 15.5 8 11.5M12 15.5l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 17v2.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
