import type { RawRow } from "../types";

export interface ParsedWorkbook {
  headers: string[];
  rows: RawRow[];
}

/** Reads an .xlsx/.xls/.csv file entirely in-browser (no upload) and returns the first sheet's rows. */
export async function parseExcelFile(file: File): Promise<ParsedWorkbook> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("The file has no sheets.");
  }
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null, raw: true });
  if (json.length === 0) {
    throw new Error("The first sheet is empty.");
  }
  const headers = Object.keys(json[0]);
  return { headers, rows: json };
}

/** Normalizes an Excel cell value (Date object, serial number, or string) to an ISO yyyy-mm-dd date, or null. */
export function toIsoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return isoFromParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return isoFromParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
    }
    return null;
  }
  if (typeof value === "number") {
    // Excel serial date: days since 1899-12-30 (handles the 1900 leap-year bug).
    const epoch = Date.UTC(1899, 11, 30);
    const date = new Date(epoch + value * 86_400_000);
    return isoFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  return null;
}

function isoFromParts(y: number, m: number, d: number): string {
  return `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
}

/** Coerces a percent-complete cell (0-1 fraction, 0-100 number, or "50%" string) to a 0-100 number. */
export function toPercent(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return value <= 1 ? Math.round(value * 100) : Math.round(value);
  }
  if (typeof value === "string") {
    const cleaned = value.replace("%", "").trim();
    const num = Number(cleaned);
    if (Number.isNaN(num)) return null;
    return value.includes("%") || num > 1 ? Math.round(num) : Math.round(num * 100);
  }
  return null;
}

/** Coerces a duration-like cell (plain number, or a string like "5 days"/"-3 edays") to a number. */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const match = value.trim().match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : null;
  }
  return null;
}

export function toBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "yes" || v === "1";
  }
  return false;
}
