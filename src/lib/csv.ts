/** F60: RFC 4180 CSV yazımı. Excel'in Türkçe karakterleri doğru açması için UTF-8 BOM eklenir. */
export type CsvValue = string | number | null | undefined;

function cell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  return "﻿" + [headers, ...rows].map((r) => r.map(cell).join(",")).join("\n") + "\n";
}
