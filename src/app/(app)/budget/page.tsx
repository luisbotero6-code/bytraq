"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/shared/page-header";
import { PeriodSelector } from "@/components/shared/period-selector";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, Search } from "lucide-react";
import { BudgetUploadDialog } from "@/modules/budget/components/budget-upload-dialog";
import { BudgetHistoryDialog } from "@/modules/budget/components/budget-history-dialog";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "Maj", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dec",
];

function formatPeriod(year: number, month: number) {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export default function BudgetPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [endDialogCustomer, setEndDialogCustomer] = useState<{ id: string; name: string } | null>(null);
  const [endYear, setEndYear] = useState(now.getFullYear());
  const [endMonth, setEndMonth] = useState(now.getMonth() + 1);
  const [historyCustomer, setHistoryCustomer] = useState<{ id: string; name: string } | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [deleteCustomer, setDeleteCustomer] = useState<{ id: string; name: string; status?: "DRAFT" | "PUBLISHED" } | null>(null);
  const [search, setSearch] = useState("");

  const { data: entries, refetch } = trpc.budget.list.useQuery({ year, month });
  const publishMutation = trpc.budget.publish.useMutation({
    onSuccess: (result) => {
      refetch();
      setPublishDialogOpen(false);
      toast.success(`Publicerade ${result.published} poster (version ${result.version})`);
    },
    onError: (err) => toast.error(err.message),
  });

  const endBudgetMutation = trpc.budget.endBudget.useMutation({
    onSuccess: (result) => {
      refetch();
      setEndDialogCustomer(null);
      toast.success(`${result.closed} budgetposter avslutade`);
    },
    onError: (err) => toast.error(err.message),
  });

  const upsertMutation = trpc.budget.upsert.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.budget.delete.useMutation({
    onSuccess: () => {
      refetch();
      setDeleteEntryId(null);
      toast.success("Budgetpost borttagen");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteByCustomerMutation = trpc.budget.deleteByCustomer.useMutation({
    onSuccess: (result) => {
      refetch();
      setDeleteCustomer(null);
      toast.success(`${result.deleted} budgetposter borttagna`);
    },
    onError: (err) => toast.error(err.message),
  });

  const drafts = entries?.filter((e) => e.status === "DRAFT") ?? [];
  const published = entries?.filter((e) => e.status === "PUBLISHED") ?? [];

  // Get unique customers from published entries for action buttons
  const publishedCustomers = new Map<string, string>();
  for (const entry of published) {
    if (!publishedCustomers.has(entry.customerId)) {
      publishedCustomers.set(entry.customerId, entry.customer.name);
    }
  }

  function handleFieldChange(entryId: string, field: "hours" | "amount", value: string, currentHours: number, currentAmount: number) {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    upsertMutation.mutate({
      id: entryId,
      startYear: year,
      startMonth: month,
      customerId: "",
      articleId: "",
      hours: field === "hours" ? num : currentHours,
      amount: field === "amount" ? num : currentAmount,
    });
  }

  return (
    <div>
      <PageHeader title="Budget" description="Hantera budgetar per kund och artikel">
        <BudgetUploadDialog year={year} month={month} onImported={() => refetch()} />
        <PeriodSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </PageHeader>

      {drafts.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              Utkast <Badge variant="secondary">{drafts.length}</Badge>
            </h2>
            <div className="flex items-center gap-2">
              {(() => {
                const draftCustomers = new Map<string, string>();
                for (const d of drafts) {
                  if (!draftCustomers.has(d.customerId)) draftCustomers.set(d.customerId, d.customer.name);
                }
                return Array.from(draftCustomers.entries()).map(([id, name]) => (
                  <Button
                    key={id}
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteCustomer({ id, name, status: "DRAFT" })}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    {name}
                  </Button>
                ));
              })()}
            <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">Publicera</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Publicera budget?</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  {drafts.length} poster kommer att publiceras. Eventuella öppna budgetar för samma kund/artikel stängs automatiskt.
                </p>
                <Button
                  onClick={() => publishMutation.mutate({ startYear: year, startMonth: month })}
                  disabled={publishMutation.isPending}
                >
                  {publishMutation.isPending ? "Publicerar..." : "Bekräfta publicering"}
                </Button>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left font-medium">Kund</th>
                  <th className="p-2 text-left font-medium">Artikel</th>
                  <th className="p-2 text-right font-medium">Timmar</th>
                  <th className="p-2 text-right font-medium">Belopp</th>
                  <th className="p-2 text-center font-medium">Version</th>
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((entry) => (
                  <tr key={entry.id} className="border-b">
                    <td className="p-2">{entry.customer.name}</td>
                    <td className="p-2">{entry.article.name}</td>
                    <td className="p-2 text-right">
                      <Input
                        type="number"
                        className="h-7 text-right text-xs w-full"
                        defaultValue={Number(entry.hours)}
                        onBlur={(e) => handleFieldChange(entry.id, "hours", e.target.value, Number(entry.hours), Number(entry.amount))}
                      />
                    </td>
                    <td className="p-2 text-right">
                      <Input
                        type="number"
                        className="h-7 text-right text-xs w-full"
                        defaultValue={Number(entry.amount)}
                        onBlur={(e) => handleFieldChange(entry.id, "amount", e.target.value, Number(entry.hours), Number(entry.amount))}
                      />
                    </td>
                    <td className="p-2 text-center">
                      <Badge variant="outline">v{entry.version}</Badge>
                    </td>
                    <td className="p-2 text-center">
                      <button
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        onClick={() => setDeleteEntryId(entry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {published.length > 0 && (() => {
        const q = search.toLowerCase();
        const filtered = q ? published.filter((e) => e.customer.name.toLowerCase().includes(q)) : published;

        // Group by customer preserving order
        const groups: Array<{ id: string; name: string; entries: typeof filtered }> = [];
        const seen = new Set<string>();
        for (const entry of filtered) {
          if (!seen.has(entry.customerId)) {
            seen.add(entry.customerId);
            groups.push({ id: entry.customerId, name: entry.customer.name, entries: [] });
          }
          groups.find((g) => g.id === entry.customerId)!.entries.push(entry);
        }

        return (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                Publicerad <Badge>{published.length}</Badge>
              </h2>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Sök kund..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 w-64 text-sm"
                />
              </div>
            </div>

            {groups.length === 0 && search && (
              <p className="text-sm text-muted-foreground py-4">Inga kunder matchar &quot;{search}&quot;</p>
            )}

            <div className="space-y-1">
              {groups.map((group) => (
                <div key={group.id} className="rounded-lg border">
                  {/* Customer header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/50">
                    <span className="text-sm font-semibold">{group.name}</span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setHistoryCustomer({ id: group.id, name: group.name })}>
                        Historik
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => { setEndYear(year); setEndMonth(month); setEndDialogCustomer({ id: group.id, name: group.name }); }}>
                        Avsluta
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteCustomer({ id: group.id, name: group.name, status: "PUBLISHED" })}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Article rows */}
                  <table className="w-full table-fixed border-collapse text-sm">
                    <colgroup>
                      <col className="w-[30%]" />
                      <col className="w-[12%]" />
                      <col className="w-[12%]" />
                      <col className="w-[14%]" />
                      <col className="w-[16%]" />
                      <col className="w-[8%]" />
                      <col className="w-[8%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="px-3 py-1.5 text-left font-medium text-xs">Artikel</th>
                        <th className="px-3 py-1.5 text-left font-medium text-xs">Giltig från</th>
                        <th className="px-3 py-1.5 text-left font-medium text-xs">Giltig till</th>
                        <th className="px-3 py-1.5 text-right font-medium text-xs">Timmar</th>
                        <th className="px-3 py-1.5 text-right font-medium text-xs">Belopp</th>
                        <th className="px-3 py-1.5 text-center font-medium text-xs">Ver</th>
                        <th className="px-3 py-1.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.entries.map((entry) => (
                        <tr key={entry.id} className="border-t">
                          <td className="px-3 py-1.5 truncate">{entry.article.name}</td>
                          <td className="px-3 py-1.5">{formatPeriod(entry.startYear, entry.startMonth)}</td>
                          <td className="px-3 py-1.5">
                            {entry.endYear != null && entry.endMonth != null
                              ? formatPeriod(entry.endYear, entry.endMonth)
                              : <Badge variant="default" className="text-xs">Pågående</Badge>
                            }
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <Input
                              type="number"
                              className="h-7 text-right text-xs w-full"
                              defaultValue={Number(entry.hours)}
                              onBlur={(e) => handleFieldChange(entry.id, "hours", e.target.value, Number(entry.hours), Number(entry.amount))}
                            />
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <Input
                              type="number"
                              className="h-7 text-right text-xs w-full"
                              defaultValue={Number(entry.amount)}
                              onBlur={(e) => handleFieldChange(entry.id, "amount", e.target.value, Number(entry.hours), Number(entry.amount))}
                            />
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <Badge variant="secondary" className="text-xs">v{entry.version}</Badge>
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <button
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              onClick={() => setDeleteEntryId(entry.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {/* Summary row */}
                      <tr className="border-t bg-muted/30 font-semibold">
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">Summa</td>
                        <td className="px-3 py-1.5" />
                        <td className="px-3 py-1.5" />
                        <td className="px-3 py-1.5 text-right text-xs">
                          {group.entries.reduce((s, e) => s + Number(e.hours), 0).toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-1.5 text-right text-xs">
                          {group.entries.reduce((s, e) => s + Number(e.amount), 0).toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr
                        </td>
                        <td className="px-3 py-1.5" />
                        <td className="px-3 py-1.5" />
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {(!entries || entries.length === 0) && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Ingen budget för denna period. Importera en ny budget.
        </p>
      )}

      {/* End budget confirmation dialog */}
      <Dialog open={!!endDialogCustomer} onOpenChange={(open) => !open && setEndDialogCustomer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avsluta budget?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Alla pågående budgetposter för <strong>{endDialogCustomer?.name}</strong> avslutas per vald period.
          </p>
          <div>
            <label className="text-sm font-medium mb-1 block">Giltig till och med</label>
            <PeriodSelector year={endYear} month={endMonth} onChange={(y, m) => { setEndYear(y); setEndMonth(m); }} />
          </div>
          <Button
            variant="destructive"
            onClick={() => {
              if (endDialogCustomer) {
                endBudgetMutation.mutate({
                  customerId: endDialogCustomer.id,
                  endYear,
                  endMonth,
                });
              }
            }}
            disabled={endBudgetMutation.isPending}
          >
            {endBudgetMutation.isPending ? "Avslutar..." : `Avsluta per ${formatPeriod(endYear, endMonth)}`}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Delete single entry confirmation dialog */}
      <Dialog open={!!deleteEntryId} onOpenChange={(open) => !open && setDeleteEntryId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ta bort budgetpost?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Denna budgetpost kommer att tas bort permanent.
          </p>
          <Button
            variant="destructive"
            onClick={() => {
              if (deleteEntryId) deleteMutation.mutate({ id: deleteEntryId });
            }}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Tar bort..." : "Bekräfta borttagning"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Delete by customer confirmation dialog */}
      <Dialog open={!!deleteCustomer} onOpenChange={(open) => !open && setDeleteCustomer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ta bort budgetposter?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Alla {deleteCustomer?.status === "DRAFT" ? "utkast" : "publicerade"} budgetposter för{" "}
            <strong>{deleteCustomer?.name}</strong> i {formatPeriod(year, month)} kommer att tas bort permanent.
          </p>
          <Button
            variant="destructive"
            onClick={() => {
              if (deleteCustomer) {
                deleteByCustomerMutation.mutate({
                  customerId: deleteCustomer.id,
                  startYear: year,
                  startMonth: month,
                  status: deleteCustomer.status,
                });
              }
            }}
            disabled={deleteByCustomerMutation.isPending}
          >
            {deleteByCustomerMutation.isPending ? "Tar bort..." : "Bekräfta borttagning"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      {historyCustomer && (
        <BudgetHistoryDialog
          customerId={historyCustomer.id}
          customerName={historyCustomer.name}
          open={!!historyCustomer}
          onOpenChange={(open) => !open && setHistoryCustomer(null)}
        />
      )}
    </div>
  );
}
