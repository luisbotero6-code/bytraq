"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { parseData, parseNum, type ColumnDef } from "@/lib/parse-csv";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const bulkColumns: ColumnDef[] = [
  { key: "startmanad", label: "Startmånad", aliases: ["Startmanad", "Start"] },
  { key: "slutmanad", label: "Slutmånad", aliases: ["Slutmanad", "Slut"] },
  { key: "radattladda", label: "Rad att ladda", aliases: ["Rad att ladda", "Ladda"] },
  { key: "laddmanad", label: "Laddmånad", aliases: ["Laddmanad"] },
  { key: "kundnummer", label: "Kundnummer", aliases: ["Kundnr", "Kund nr"] },
  { key: "kund", label: "Kund", aliases: ["Kundnamn"] },
  { key: "artikelnummer", label: "Artikelnummer", aliases: ["Artikelnr", "Artikelkod", "Article Code"] },
  { key: "artikel", label: "Artikel", aliases: ["Artikelnamn", "Beskrivning", "Benämning"] },
  { key: "fastpris", label: "Fastpris", aliases: ["Budget fastpris", "Belopp", "Nytt budget fastpris"] },
  { key: "budget", label: "Budget", aliases: ["Timmar", "Budget tid", "Ny budget tid", "Tid"] },
  { key: "kundtyp", label: "Kundtyp", aliases: ["Typ"] },
];

/** Parse a date like "2023-03-01" into { year, month } */
function parseDatePeriod(dateStr: string): { year: number; month: number } | null {
  if (!dateStr || !dateStr.trim()) return null;
  const match = dateStr.trim().match(/^(\d{4})-(\d{1,2})/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return null;
  return { year, month };
}

interface ParsedRow {
  startYear: number;
  startMonth: number;
  endYear: number | null;
  endMonth: number | null;
  shouldLoad: boolean;
  customerNumber: string;
  customerName: string;
  articleCode: string;
  articleName: string;
  amount: number;
  hours: number;
  customerType: string;
}

function parseRows(rawRows: Record<string, string>[]): ParsedRow[] {
  return rawRows
    .map((r) => {
      const start = parseDatePeriod(r.startmanad);
      if (!start) return null;
      const end = parseDatePeriod(r.slutmanad);
      const shouldLoad = (r.radattladda ?? "").trim().toUpperCase() === "SANT";
      const customerNumber = (r.kundnummer ?? "").trim();
      if (!customerNumber) return null;
      const articleCode = (r.artikelnummer ?? "").trim();
      if (!articleCode) return null;

      return {
        startYear: start.year,
        startMonth: start.month,
        endYear: end?.year ?? null,
        endMonth: end?.month ?? null,
        shouldLoad,
        customerNumber,
        customerName: (r.kund ?? "").trim(),
        articleCode,
        articleName: (r.artikel ?? "").trim(),
        amount: parseNum(r.fastpris ?? ""),
        hours: parseNum(r.budget ?? ""),
        customerType: (r.kundtyp ?? "").trim(),
      };
    })
    .filter((r): r is ParsedRow => r !== null);
}

interface BudgetUploadDialogProps {
  onImported: () => void;
}

export function BudgetUploadDialog({ onImported }: BudgetUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [onlyLoadable, setOnlyLoadable] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: customers } = trpc.customer.list.useQuery(undefined, { enabled: open });
  const { data: articles } = trpc.article.list.useQuery(undefined, { enabled: open });

  const importBulkMutation = trpc.budget.importBulk.useMutation();

  // Maps for matching
  const customerNumberSet = useMemo(() => {
    if (!customers) return new Set<string>();
    return new Set(customers.filter(c => c.customerNumber).map(c => c.customerNumber!));
  }, [customers]);

  const articleCodeSet = useMemo(() => {
    if (!articles) return new Set<string>();
    return new Set(articles.map(a => a.code.toLowerCase()));
  }, [articles]);

  // Parse raw rows into structured data
  const allParsed = useMemo(() => parseRows(rawRows), [rawRows]);
  const displayRows = useMemo(
    () => (onlyLoadable ? allParsed.filter((r) => r.shouldLoad) : allParsed),
    [allParsed, onlyLoadable],
  );

  // Stats
  const loadableCount = allParsed.filter((r) => r.shouldLoad).length;
  const historicalCount = allParsed.length - loadableCount;
  const matchedCustomers = new Set(displayRows.filter(r => customerNumberSet.has(r.customerNumber)).map(r => r.customerNumber));
  const unmatchedCustomers = new Set(displayRows.filter(r => !customerNumberSet.has(r.customerNumber)).map(r => r.customerNumber));
  const matchedArticles = new Set(displayRows.filter(r => articleCodeSet.has(r.articleCode.toLowerCase())).map(r => r.articleCode));
  const unmatchedArticles = new Set(displayRows.filter(r => !articleCodeSet.has(r.articleCode.toLowerCase())).map(r => r.articleCode));

  // Group by customer for preview
  const grouped = useMemo(() => {
    const map = new Map<string, ParsedRow[]>();
    for (const row of displayRows) {
      const key = row.customerNumber;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return Array.from(map.entries());
  }, [displayRows]);

  const handleParse = useCallback((value: string) => {
    setText(value);
    if (value.trim()) {
      const result = parseData(value, bulkColumns);
      setRawRows(result.rows);
    } else {
      setRawRows([]);
    }
  }, []);

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
    if (displayRows.length === 0) return;
    setImporting(true);
    try {
      const mapped = displayRows.map((r) => ({
        customerNumber: r.customerNumber,
        articleCode: r.articleCode,
        hours: r.hours,
        amount: r.amount,
        startYear: r.startYear,
        startMonth: r.startMonth,
        endYear: r.endYear,
        endMonth: r.endMonth,
      }));

      const result = await importBulkMutation.mutateAsync({ rows: mapped });

      const msgs: string[] = [];
      if (result.count > 0) msgs.push(`${result.count} budgetposter importerade`);
      if (result.skippedCustomers.length > 0 || result.skippedArticles.length > 0) {
        const parts: string[] = [];
        if (result.skippedCustomers.length > 0) parts.push(`Kunder: ${result.skippedCustomers.join(", ")}`);
        if (result.skippedArticles.length > 0) parts.push(`Artiklar: ${result.skippedArticles.join(", ")}`);
        toast.warning(msgs.join(", ") || "Inga poster importerade", {
          description: `Överhoppade — ${parts.join("; ")}`,
          duration: 8000,
        });
      } else {
        toast.success(msgs.join(", "));
      }

      onImported();
      setOpen(false);
      setText("");
      setRawRows([]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Kunde inte importera";
      toast.error(message);
    } finally {
      setImporting(false);
    }
  };

  function formatPeriod(year: number, month: number) {
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-1" />
          Importera budget
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importera budget</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File input */}
          <div>
            <label className="text-sm font-medium mb-1 block">Ladda upp fil</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.xls"
              onChange={handleFile}
              className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
          </div>

          {/* Paste area */}
          <div>
            <label className="text-sm font-medium mb-1 block">Eller klistra in data</label>
            <textarea
              className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground"
              placeholder="Klistra in tab-separerade rader med kolumner: Startmånad, Slutmånad, Rad att ladda, Kundnummer, Kund, Artikelnummer, Artikel, Fastpris, Budget, Kundtyp"
              value={text}
              onChange={(e) => handleParse(e.target.value)}
            />
          </div>

          {/* Stats & filter */}
          {allParsed.length > 0 && (
            <>
              <div className="flex items-center gap-4 text-sm flex-wrap">
                <span>{allParsed.length} rader tolkade</span>
                <span className="text-green-600">{loadableCount} aktiva (SANT)</span>
                <span className="text-muted-foreground">{historicalCount} historiska (FALSKT)</span>
                <span className="text-muted-foreground">|</span>
                {customers && (
                  <>
                    <span className="text-green-600">{matchedCustomers.size} kunder matchade</span>
                    {unmatchedCustomers.size > 0 && (
                      <span className="text-red-600">{unmatchedCustomers.size} kunder omatchade</span>
                    )}
                  </>
                )}
                {articles && (
                  <>
                    <span className="text-green-600">{matchedArticles.size} artiklar matchade</span>
                    {unmatchedArticles.size > 0 && (
                      <span className="text-red-600">{unmatchedArticles.size} artiklar omatchade</span>
                    )}
                  </>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={onlyLoadable}
                  onChange={(e) => setOnlyLoadable(e.target.checked)}
                  className="rounded border-input"
                />
                Visa bara aktiva rader (Rad att ladda = SANT)
              </label>

              {/* Preview table grouped by customer */}
              <div className="rounded-md border overflow-auto max-h-[400px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground w-8"></th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Kund</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Artikelnr</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Artikel</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Från</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Till</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Fastpris</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Timmar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped.map(([custNum, rows]) => {
                      const custMatched = customerNumberSet.has(custNum);
                      return rows.map((row, i) => {
                        const artMatched = articleCodeSet.has(row.articleCode.toLowerCase());
                        const rowOk = custMatched && artMatched;
                        return (
                          <tr key={`${custNum}-${i}`} className="border-t">
                            <td className="px-3 py-1.5 text-center">
                              <span className={rowOk ? "text-green-600" : "text-red-600"}>
                                {rowOk ? "\u2713" : "\u2717"}
                              </span>
                            </td>
                            <td className="px-3 py-1.5">
                              {i === 0 ? (
                                <span className={custMatched ? "" : "text-red-600 font-medium"}>
                                  {row.customerName}
                                  <span className="text-muted-foreground text-xs ml-1">#{custNum}</span>
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-1.5">
                              <span className={artMatched ? "" : "text-red-600"}>{row.articleCode}</span>
                            </td>
                            <td className="px-3 py-1.5">{row.articleName}</td>
                            <td className="px-3 py-1.5">{formatPeriod(row.startYear, row.startMonth)}</td>
                            <td className="px-3 py-1.5">
                              {row.endYear && row.endMonth
                                ? formatPeriod(row.endYear, row.endMonth)
                                : <Badge variant="default" className="text-xs">Pågående</Badge>
                              }
                            </td>
                            <td className="px-3 py-1.5 text-right">{row.amount.toLocaleString("sv-SE")} kr</td>
                            <td className="px-3 py-1.5 text-right">{row.hours.toLocaleString("sv-SE")}</td>
                          </tr>
                        );
                      });
                    })}
                    {/* Summary row */}
                    <tr className="border-t bg-muted/50 font-semibold">
                      <td className="px-3 py-1.5" />
                      <td className="px-3 py-1.5">{grouped.length} kunder</td>
                      <td className="px-3 py-1.5" />
                      <td className="px-3 py-1.5 text-right">Summa</td>
                      <td className="px-3 py-1.5" />
                      <td className="px-3 py-1.5" />
                      <td className="px-3 py-1.5 text-right">
                        {displayRows.reduce((sum, r) => sum + r.amount, 0).toLocaleString("sv-SE")} kr
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {displayRows.reduce((sum, r) => sum + r.hours, 0).toLocaleString("sv-SE")}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <Button
                onClick={handleImport}
                disabled={importing || displayRows.length === 0}
              >
                {importing ? "Importerar..." : `Importera ${displayRows.length} rader som publicerad budget`}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
