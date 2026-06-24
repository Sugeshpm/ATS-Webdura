import Papa from "papaparse";

/** Convert an array of plain objects into a CSV string. Columns inferred from `headers`. */
export function toCsv<T extends Record<string, unknown>>(rows: T[], headers: (keyof T)[]): string {
  return Papa.unparse({
    fields: headers.map(String),
    data: rows.map((r) => headers.map((h) => normalise(r[h])))
  });
}

function normalise(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(";");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Parse a CSV buffer/string into rows. Returns an array of objects keyed by header. */
export function parseCsv<T = Record<string, string>>(content: string): { rows: T[]; errors: string[] } {
  const result = Papa.parse<T>(content, { header: true, skipEmptyLines: true, dynamicTyping: false });
  return {
    rows: (result.data ?? []).filter((r): r is T => !!r),
    errors: (result.errors ?? []).map((e) => `Row ${e.row ?? "?"}: ${e.message}`)
  };
}

/** Build a Response that downloads a CSV file. */
export function csvDownloadResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
}

/** Parse common truthy strings. */
export function bool(v: string | undefined | null): boolean {
  if (!v) return false;
  return /^(1|true|yes|y)$/i.test(v.trim());
}

/** Coerce string to number or undefined. */
export function num(v: string | undefined | null): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
