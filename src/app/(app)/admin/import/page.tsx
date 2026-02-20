"use client";

import { useState, useRef, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import * as XLSX from "xlsx";

// --- Types ---

interface ColumnDef {
  key: string;
  label: string;
  /** Alternative header names to match against (case-insensitive) */
  aliases?: string[];
}

interface ParseResult {
  headers: string[];
  rows: Record<string, string>[];
}

interface ImportSectionProps {
  columns: ColumnDef[];
  onImport: (rows: Record<string, string>[]) => Promise<void>;
  importLabel: string;
}

// --- Parser ---

function detectSeparator(text: string): string {
  const firstLine = text.split("\n")[0] ?? "";
  if (firstLine.includes("\t")) return "\t";
  if (firstLine.includes(";")) return ";";
  return ",";
}

/** Split a CSV/TSV line respecting quoted fields (handles separators inside quotes) */
function splitLine(line: string, sep: string): string[] {
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
function norm(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Check if an actual header exactly matches a column definition */
function headerMatchesExact(actual: string, col: ColumnDef): boolean {
  const a = norm(actual);
  const candidates = [col.label, ...(col.aliases ?? [])].map(norm);
  return candidates.some(c => a === c);
}

/** Check if an actual header fuzzy-matches a column definition (prefix) */
function headerMatchesFuzzy(actual: string, col: ColumnDef): boolean {
  const a = norm(actual);
  const candidates = [col.label, ...(col.aliases ?? [])].map(norm);
  return candidates.some(c => a.startsWith(c) || c.startsWith(a));
}

function parseData(text: string, columns: ColumnDef[]): ParseResult {
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

// --- ImportSection Component ---

function ImportSection({ columns, onImport, importLabel }: ImportSectionProps) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleParse = useCallback((value: string) => {
    setText(value);
    if (value.trim()) {
      const result = parseData(value, columns);
      setRows(result.rows);
      setDetectedHeaders(result.headers);
    } else {
      setRows([]);
      setDetectedHeaders([]);
    }
  }, [columns]);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    let content: string;

    if (isExcel) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true, cellText: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      content = XLSX.utils.sheet_to_csv(sheet, { FS: "\t", rawNumbers: false });
    } else {
      content = await file.text();
    }

    handleParse(content);
    if (fileRef.current) fileRef.current.value = "";
  }, [handleParse]);

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      await onImport(rows);
      setText("");
      setRows([]);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <textarea
          className="flex-1 min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground"
          placeholder={`Klistra in tab-separerade rader eller CSV...\nKolumner: ${columns.map(c => c.label).join(", ")}`}
          value={text}
          onChange={e => handleParse(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,.xls"
          onChange={handleFile}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
        />
        {rows.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {rows.length} rader tolkade
          </span>
        )}
      </div>

      {rows.length > 0 && (
        <>
          <div className="rounded-md border overflow-auto max-h-[400px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                  {columns.map(col => (
                    <th key={col.key} className="px-3 py-2 text-left font-medium text-muted-foreground">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                    {columns.map(col => (
                      <td key={col.key} className="px-3 py-1.5">{row[col.key]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button onClick={handleImport} disabled={importing}>
            {importing ? "Importerar..." : `Importera ${rows.length} ${importLabel}`}
          </Button>
        </>
      )}
    </div>
  );
}

// --- Column definitions ---

const employeeColumns: ColumnDef[] = [
  { key: "anstId", label: "Anst. ID", aliases: ["Anst.ID", "AnstID"] },
  { key: "fornamn", label: "Förnamn" },
  { key: "efternamn", label: "Efternamn" },
  { key: "personnummer", label: "Personnummer" },
  { key: "kostnadH", label: "Kostnad/h" },
  { key: "malbelaggning", label: "Målbeläggning", aliases: ["målbeläggning"] },
  { key: "timmarVecka", label: "Timmar/vecka", aliases: ["timmar/vecka"] },
];

const customerColumns: ColumnDef[] = [
  { key: "kundnr", label: "Kundnr" },
  { key: "namn", label: "Namn" },
  { key: "orgnr", label: "Org-/Persnr" },
  { key: "postnr", label: "Postnr" },
  { key: "ort", label: "Ort" },
  { key: "land", label: "Land" },
  { key: "telefon", label: "Telefon" },
];

const articleColumns: ColumnDef[] = [
  { key: "artikelnr", label: "Artikelnr", aliases: ["Artikelnummer"] },
  { key: "benamning", label: "Benämning" },
  { key: "utpris", label: "Utpris Prislista A", aliases: ["Utpris"] },
  { key: "grupp", label: "Grupp" },
  { key: "status", label: "Status", aliases: ["Aktiv"] },
];

const timeEntryColumns: ColumnDef[] = [
  { key: "datum", label: "Datum" },
  { key: "kundNr", label: "KundNr" },
  { key: "kund", label: "Kund" },
  { key: "projektNr", label: "ProjektNr" },
  { key: "projekt", label: "Projekt" },
  { key: "artikelNr", label: "ArtikelNr" },
  { key: "artikel", label: "Artikel" },
  { key: "kostnadsstalleKod", label: "Kostnadställskod" },
  { key: "kostnadsstalle", label: "Kostnadsställe" },
  { key: "regKod", label: "Reg. Kod" },
  { key: "registrering", label: "Registrering" },
  { key: "starttid", label: "Starttid" },
  { key: "sluttid", label: "Sluttid" },
  { key: "arbH", label: "Arb. h" },
  { key: "franvH", label: "Frånv. h" },
  { key: "antOvr", label: "Ant. Övr." },
  { key: "kostnad", label: "Kostnad" },
  { key: "debH", label: "Deb. h" },
  { key: "pris", label: "Pris" },
  { key: "fastpris", label: "Fastpris" },
  { key: "fakturatext", label: "Fakturatext" },
  { key: "anteckning", label: "Anteckning" },
  { key: "underlagsNr", label: "UnderlagsNr" },
  { key: "fakturaOrder", label: "Faktura/Order" },
  { key: "anvandare", label: "Användare" },
];

// --- Helpers ---

/** Parse a number that may use comma as decimal separator (Swedish locale) */
function parseNum(value: string): number {
  if (!value || !value.trim()) return 0;
  return Number(value.replace(/\s/g, "").replace(",", "."));
}

// --- Import History ---

const typeLabels: Record<string, string> = {
  EMPLOYEE: "Anställda",
  CUSTOMER: "Kunder",
  ARTICLE: "Artiklar",
  TIME_ENTRY: "Tidsredovisning",
  ABSENCE: "Frånvaro",
};

function ImportHistory() {
  const utils = trpc.useUtils();
  const { data: batches, isLoading } = trpc.import.listBatches.useQuery();
  const deleteBatch = trpc.import.deleteBatch.useMutation({
    onSuccess: () => {
      utils.import.listBatches.invalidate();
    },
  });

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Är du säker? Alla poster som skapades i denna import kommer att raderas.")) return;
    setDeletingId(id);
    try {
      const result = await deleteBatch.mutateAsync({ id });
      toast.success(`${result.deleted} poster raderade`);
    } catch {
      toast.error("Kunde inte radera importbatch");
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-4">Laddar...</p>;
  }

  if (!batches || batches.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Inga importer registrerade ännu.</p>;
  }

  return (
    <div className="rounded-md border overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Typ</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Antal</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Importerad av</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Datum</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground"></th>
          </tr>
        </thead>
        <tbody>
          {batches.map(batch => (
            <tr key={batch.id} className="border-t">
              <td className="px-3 py-2">{typeLabels[batch.type] ?? batch.type}</td>
              <td className="px-3 py-2">{batch.count}</td>
              <td className="px-3 py-2">{batch.createdBy.name}</td>
              <td className="px-3 py-2">
                {format(new Date(batch.createdAt), "d MMM yyyy HH:mm", { locale: sv })}
              </td>
              <td className="px-3 py-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deletingId === batch.id}
                  onClick={() => handleDelete(batch.id)}
                >
                  {deletingId === batch.id ? "Raderar..." : "Ta bort"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Page ---

export default function ImportPage() {
  const utils = trpc.useUtils();
  const importEmployees = trpc.import.importEmployees.useMutation({
    onSuccess: () => utils.import.listBatches.invalidate(),
  });
  const importCustomers = trpc.import.importCustomers.useMutation({
    onSuccess: () => utils.import.listBatches.invalidate(),
  });
  const importArticles = trpc.import.importArticles.useMutation({
    onSuccess: () => utils.import.listBatches.invalidate(),
  });
  const importTimeEntries = trpc.import.importTimeEntries.useMutation({
    onSuccess: () => utils.import.listBatches.invalidate(),
  });

  return (
    <div>
      <PageHeader title="Dataimport" description="Importera historisk data från Excel/CSV" />
      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees">Anställda</TabsTrigger>
          <TabsTrigger value="customers">Kunder</TabsTrigger>
          <TabsTrigger value="articles">Artiklar</TabsTrigger>
          <TabsTrigger value="time-entries">Tidsredovisning</TabsTrigger>
          <TabsTrigger value="history">Importhistorik</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <ImportSection
            columns={employeeColumns}
            importLabel="anställda"
            onImport={async (rows) => {
              const data = rows.map(r => ({
                employeeNumber: r.anstId || undefined,
                name: [r.fornamn, r.efternamn].filter(Boolean).join(" "),
                personalNumber: r.personnummer || undefined,
                costPerHour: parseNum(r.kostnadH) || 0,
                defaultPricePerHour: parseNum(r.kostnadH) || 0,
                weeklyHours: parseNum(r.timmarVecka) || 40,
                targetUtilization: (() => {
                  const v = parseNum(r.malbelaggning);
                  if (!v || isNaN(v)) return 0.75;
                  return v > 1 ? v / 100 : v;
                })(),
              }));
              const result = await importEmployees.mutateAsync(data);
              toast.success(`${result.count} anställda importerade`);
            }}
          />
        </TabsContent>

        <TabsContent value="customers">
          <ImportSection
            columns={customerColumns}
            importLabel="kunder"
            onImport={async (rows) => {
              const data = rows.map(r => ({
                customerNumber: r.kundnr || undefined,
                name: r.namn,
                orgnr: r.orgnr || undefined,
                postalCode: r.postnr || undefined,
                city: r.ort || undefined,
                country: r.land || undefined,
                phone: r.telefon || undefined,
              }));
              const result = await importCustomers.mutateAsync(data);
              toast.success(`${result.count} kunder importerade`);
            }}
          />
        </TabsContent>

        <TabsContent value="articles">
          <ImportSection
            columns={articleColumns}
            importLabel="artiklar"
            onImport={async (rows) => {
              const data = rows.map(r => ({
                code: r.artikelnr,
                name: r.benamning,
                defaultPrice: parseNum(r.utpris) || undefined,
                groupName: r.grupp,
              }));
              const result = await importArticles.mutateAsync(data);
              let msg = `${result.count} artiklar importerade`;
              if (result.createdGroups.length > 0) {
                msg += ` (nya grupper: ${result.createdGroups.join(", ")})`;
              }
              toast.success(msg);
            }}
          />
        </TabsContent>

        <TabsContent value="time-entries">
          <ImportSection
            columns={timeEntryColumns}
            importLabel="tidsrader"
            onImport={async (rows) => {
              const data = rows.map(r => ({
                  employeeName: r.anvandare || "",
                  customerNumber: r.kundNr || undefined,
                  customerName: r.kund || "",
                  articleCode: r.artikelNr || "",
                  date: r.datum || "",
                  hours: parseNum(r.arbH) || parseNum(r.franvH) || parseNum(r.debH) || parseNum(r.antOvr),
                  regKod: r.regKod || undefined,
                  costAmount: parseNum(r.kostnad) || undefined,
                  price: parseNum(r.pris) || undefined,
                  comment: [r.fakturatext, r.anteckning].filter(Boolean).join(" | ") || undefined,
                }));
              const result = await importTimeEntries.mutateAsync(data);
              const msgs: string[] = [];
              if (result.count > 0) msgs.push(`${result.count} tidsrader`);
              if (result.absenceCount > 0) msgs.push(`${result.absenceCount} frånvaroposter`);
              if (result.skipped.length > 0) {
                toast.warning(`${msgs.join(" + ")} importerade, ${result.skipped.length} överhoppade`, {
                  description: result.skipped.join("\n"),
                  duration: 10000,
                });
              } else {
                toast.success(`${msgs.join(" + ")} importerade`);
              }
            }}
          />
        </TabsContent>

        <TabsContent value="history">
          <ImportHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
