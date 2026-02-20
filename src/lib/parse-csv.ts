export interface ColumnDef {
  key: string;
  label: string;
  /** Alternative header names to match against (case-insensitive) */
  aliases?: string[];
}

export interface ParseResult {
  headers: string[];
  rows: Record<string, string>[];
}

export function detectSeparator(text: string): string {
  const firstLine = text.split("\n")[0] ?? "";
  if (firstLine.includes("\t")) return "\t";
  if (firstLine.includes(";")) return ";";
  return ",";
}

/** Split a CSV/TSV line respecting quoted fields (handles separators inside quotes) */
export function splitLine(line: string, sep: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === sep) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

/** Normalize header text for matching: lowercase, trim, collapse spaces */
export function norm(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Check if an actual header exactly matches a column definition */
export function headerMatchesExact(actual: string, col: ColumnDef): boolean {
  const a = norm(actual);
  const candidates = [col.label, ...(col.aliases ?? [])].map(norm);
  return candidates.some(c => a === c);
}

/** Check if an actual header fuzzy-matches a column definition (prefix) */
export function headerMatchesFuzzy(actual: string, col: ColumnDef): boolean {
  const a = norm(actual);
  const candidates = [col.label, ...(col.aliases ?? [])].map(norm);
  return candidates.some(c => a.startsWith(c) || c.startsWith(a));
}

export function parseData(text: string, columns: ColumnDef[]): ParseResult {
  const sep = detectSeparator(text);
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };

  const firstCells = splitLine(lines[0], sep);

  // Two-pass matching: exact first, then fuzzy on remaining unmatched
  const headerMap = new Map<string, number>(); // column key → index in actual data
  const usedIndices = new Set<number>();

  // Pass 1: exact matches
  for (const col of columns) {
    const idx = firstCells.findIndex((cell, i) => !usedIndices.has(i) && headerMatchesExact(cell, col));
    if (idx !== -1) {
      headerMap.set(col.key, idx);
      usedIndices.add(idx);
    }
  }

  // Pass 2: fuzzy matches for unmatched columns against unmatched headers
  for (const col of columns) {
    if (headerMap.has(col.key)) continue;
    const idx = firstCells.findIndex((cell, i) => !usedIndices.has(i) && headerMatchesFuzzy(cell, col));
    if (idx !== -1) {
      headerMap.set(col.key, idx);
      usedIndices.add(idx);
    }
  }

  // If we matched at least half the columns by header name, use header-based mapping
  const useHeaders = headerMap.size >= Math.ceil(columns.length / 2);

  if (useHeaders) {
    const dataLines = lines.slice(1);
    const rows = dataLines.map(line => {
      const cells = splitLine(line, sep);
      const row: Record<string, string> = {};
      for (const col of columns) {
        const idx = headerMap.get(col.key);
        row[col.key] = idx !== undefined ? (cells[idx] ?? "") : "";
      }
      return row;
    });
    return { headers: firstCells, rows };
  }

  // Fallback: positional mapping, no header row detected
  const rows = lines.map(line => {
    const cells = splitLine(line, sep);
    const row: Record<string, string> = {};
    columns.forEach((col, i) => {
      row[col.key] = cells[i] ?? "";
    });
    return row;
  });
  return { headers: [], rows };
}

/** Parse a number that may use comma as decimal separator (Swedish locale) */
export function parseNum(value: string): number {
  if (!value || !value.trim()) return 0;
  return Number(value.replace(/\s/g, "").replace(",", "."));
}
