"use client";

import { useState, useRef, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// --- Types ---

interface ColumnDef {
  key: string;
  label: string;
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

function parseData(text: string, columns: ColumnDef[]): Record<string, string>[] {
  const sep = detectSeparator(text);
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length === 0) return [];

  // Check if first line looks like a header (matches column labels)
  const firstCells = lines[0].split(sep).map(c => c.trim().toLowerCase());
  const colLabels = columns.map(c => c.label.toLowerCase());
  const hasHeader = colLabels.every(label => firstCells.some(cell => cell === label));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map(line => {
    const cells = line.split(sep).map(c => c.trim());
    const row: Record<string, string> = {};
    columns.forEach((col, i) => {
      row[col.key] = cells[i] ?? "";
    });
    return row;
  });
}

// --- ImportSection Component ---

function ImportSection({ columns, onImport, importLabel }: ImportSectionProps) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleParse = useCallback((value: string) => {
    setText(value);
    if (value.trim()) {
      setRows(parseData(value, columns));
    } else {
      setRows([]);
    }
  }, [columns]);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
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
          accept=".csv,.tsv,.txt"
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
  { key: "name", label: "Namn" },
  { key: "costPerHour", label: "Kostnad/h" },
  { key: "pricePerHour", label: "Pris/h" },
  { key: "weeklyHours", label: "Timmar/vecka" },
  { key: "targetUtilization", label: "Målbeläggning" },
];

const customerColumns: ColumnDef[] = [
  { key: "name", label: "Namn" },
  { key: "orgnr", label: "Orgnr" },
  { key: "customerType", label: "Typ" },
  { key: "clientManagerName", label: "Klientansvarig" },
];

const articleColumns: ColumnDef[] = [
  { key: "code", label: "Kod" },
  { key: "name", label: "Namn" },
  { key: "groupName", label: "Grupp" },
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

function parseCustomerType(value: string): "LOPANDE" | "FASTPRIS" | "BLANDAD" {
  const v = value.toLowerCase().trim();
  if (v === "fastpris" || v === "fast") return "FASTPRIS";
  if (v === "blandad" || v === "bland") return "BLANDAD";
  return "LOPANDE";
}

// --- Page ---

export default function ImportPage() {
  const importEmployees = trpc.import.importEmployees.useMutation();
  const importCustomers = trpc.import.importCustomers.useMutation();
  const importArticles = trpc.import.importArticles.useMutation();
  const importTimeEntries = trpc.import.importTimeEntries.useMutation();

  return (
    <div>
      <PageHeader title="Dataimport" description="Importera historisk data från Excel/CSV" />
      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees">Anställda</TabsTrigger>
          <TabsTrigger value="customers">Kunder</TabsTrigger>
          <TabsTrigger value="articles">Artiklar</TabsTrigger>
          <TabsTrigger value="time-entries">Tidsredovisning</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <ImportSection
            columns={employeeColumns}
            importLabel="anställda"
            onImport={async (rows) => {
              const data = rows.map(r => ({
                name: r.name,
                costPerHour: Number(r.costPerHour),
                defaultPricePerHour: Number(r.pricePerHour),
                weeklyHours: Number(r.weeklyHours),
                targetUtilization: Number(r.targetUtilization),
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
                name: r.name,
                orgnr: r.orgnr,
                customerType: parseCustomerType(r.customerType),
                clientManagerName: r.clientManagerName || undefined,
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
                code: r.code,
                name: r.name,
                groupName: r.groupName,
              }));
              const result = await importArticles.mutateAsync(data);
              if (result.skipped.length > 0) {
                toast.warning(`${result.count} artiklar importerade, ${result.skipped.length} överhoppade`, {
                  description: result.skipped.join("\n"),
                  duration: 10000,
                });
              } else {
                toast.success(`${result.count} artiklar importerade`);
              }
            }}
          />
        </TabsContent>

        <TabsContent value="time-entries">
          <ImportSection
            columns={timeEntryColumns}
            importLabel="tidsrader"
            onImport={async (rows) => {
              const data = rows
                .filter(r => parseNum(r.arbH) > 0)
                .map(r => ({
                  employeeName: r.anvandare,
                  customerName: r.kund,
                  articleCode: r.artikelNr,
                  date: r.datum,
                  hours: parseNum(r.arbH),
                  costAmount: parseNum(r.kostnad) || undefined,
                  price: parseNum(r.pris) || undefined,
                  comment: [r.fakturatext, r.anteckning].filter(Boolean).join(" | ") || undefined,
                }));
              const result = await importTimeEntries.mutateAsync(data);
              if (result.skipped.length > 0) {
                toast.warning(`${result.count} tidsrader importerade, ${result.skipped.length} överhoppade`, {
                  description: result.skipped.join("\n"),
                  duration: 10000,
                });
              } else {
                toast.success(`${result.count} tidsrader importerade`);
              }
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
