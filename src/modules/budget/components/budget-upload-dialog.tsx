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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload } from "lucide-react";

const budgetColumns: ColumnDef[] = [
  { key: "artikelnr", label: "Artikelnummer", aliases: ["Artikelnr", "Article Code"] },
  { key: "beskrivning", label: "Artikelbeskrivning", aliases: ["Benämning", "Beskrivning"] },
  { key: "fastpris", label: "Nytt budget fastpris", aliases: ["Fastpris", "Budget fastpris", "Belopp"] },
  { key: "timmar", label: "Ny budget tid", aliases: ["Timmar", "Budget tid", "Tid"] },
];

interface BudgetUploadDialogProps {
  year: number;
  month: number;
  onImported: () => void;
}

export function BudgetUploadDialog({ year, month, onImported }: BudgetUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: customers } = trpc.customer.list.useQuery(undefined, { enabled: open });
  const { data: articles } = trpc.article.list.useQuery(undefined, { enabled: open });

  const importMutation = trpc.budget.importFile.useMutation();

  // Build a set of known article codes (lowercase) for match checking
  const articleCodeSet = useMemo(() => {
    if (!articles) return new Set<string>();
    return new Set(articles.map(a => a.code.toLowerCase()));
  }, [articles]);

  const handleParse = useCallback((value: string) => {
    setText(value);
    if (value.trim()) {
      const result = parseData(value, budgetColumns);
      setRows(result.rows);
    } else {
      setRows([]);
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
    if (rows.length === 0 || !customerId) return;
    setImporting(true);
    try {
      const mapped = rows
        .filter(r => r.artikelnr?.trim())
        .map(r => ({
          articleCode: r.artikelnr.trim(),
          hours: parseNum(r.timmar),
          amount: parseNum(r.fastpris),
        }));

      const result = await importMutation.mutateAsync({
        startYear: year,
        startMonth: month,
        customerId,
        rows: mapped,
      });

      const msgs: string[] = [];
      if (result.count > 0) msgs.push(`${result.count} budgetposter importerade`);
      if (result.skipped.length > 0) {
        toast.warning(msgs.join(", ") || "Inga poster importerade", {
          description: `${result.skipped.length} överhoppade (okänd artikel): ${result.skipped.join(", ")}`,
          duration: 8000,
        });
      } else {
        toast.success(msgs.join(", "));
      }

      onImported();
      setOpen(false);
      setText("");
      setRows([]);
      setCustomerId("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Kunde inte importera";
      toast.error(message);
    } finally {
      setImporting(false);
    }
  };

  const matchedCount = rows.filter(r => articleCodeSet.has(r.artikelnr?.toLowerCase())).length;
  const unmatchedCount = rows.filter(r => r.artikelnr?.trim() && !articleCodeSet.has(r.artikelnr?.toLowerCase())).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-1" />
          Importera budget
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importera budget</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer selector */}
          <div>
            <label className="text-sm font-medium mb-1 block">Kund</label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Välj kund..." />
              </SelectTrigger>
              <SelectContent>
                {customers?.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
              placeholder={`Klistra in tab-separerade rader eller CSV...\nKolumner: ${budgetColumns.map(c => c.label).join(", ")}`}
              value={text}
              onChange={e => handleParse(e.target.value)}
            />
          </div>

          {/* Preview table */}
          {rows.length > 0 && (
            <>
              <div className="flex items-center gap-3 text-sm">
                <span>{rows.length} rader tolkade</span>
                {articles && (
                  <>
                    <span className="text-green-600">{matchedCount} matchade</span>
                    {unmatchedCount > 0 && (
                      <span className="text-red-600">{unmatchedCount} omatchade</span>
                    )}
                  </>
                )}
              </div>

              <div className="rounded-md border overflow-auto max-h-[300px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground w-8"></th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Artikelnr</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Beskrivning</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Fastpris</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Timmar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const code = row.artikelnr?.trim() ?? "";
                      const matched = code ? articleCodeSet.has(code.toLowerCase()) : false;
                      return (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-1.5 text-center">
                            {code && (
                              <span className={matched ? "text-green-600" : "text-red-600"}>
                                {matched ? "\u2713" : "\u2717"}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5">{row.artikelnr}</td>
                          <td className="px-3 py-1.5">{row.beskrivning}</td>
                          <td className="px-3 py-1.5 text-right">{row.fastpris}</td>
                          <td className="px-3 py-1.5 text-right">{row.timmar}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Button
                onClick={handleImport}
                disabled={importing || !customerId || rows.length === 0}
              >
                {importing ? "Importerar..." : `Importera ${rows.length} rader`}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
