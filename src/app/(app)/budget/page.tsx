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
  const [historyCustomer, setHistoryCustomer] = useState<{ id: string; name: string } | null>(null);

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

  const drafts = entries?.filter((e) => e.status === "DRAFT") ?? [];
  const published = entries?.filter((e) => e.status === "PUBLISHED") ?? [];

  // Get unique customers from published entries for action buttons
  const publishedCustomers = new Map<string, string>();
  for (const entry of published) {
    if (!publishedCustomers.has(entry.customerId)) {
      publishedCustomers.set(entry.customerId, entry.customer.name);
    }
  }

  function handleHoursChange(entryId: string, hours: string) {
    const numHours = parseFloat(hours);
    if (isNaN(numHours)) return;
    upsertMutation.mutate({ id: entryId, startYear: year, startMonth: month, customerId: "", articleId: "", hours: numHours });
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

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left font-medium">Kund</th>
                  <th className="p-2 text-left font-medium">Artikel</th>
                  <th className="p-2 text-right font-medium">Timmar</th>
                  <th className="p-2 text-right font-medium">Belopp</th>
                  <th className="p-2 text-center font-medium">Version</th>
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
                        className="w-20 h-7 text-right text-xs ml-auto"
                        defaultValue={Number(entry.hours)}
                        onBlur={(e) => handleHoursChange(entry.id, e.target.value)}
                      />
                    </td>
                    <td className="p-2 text-right">{Number(entry.amount).toLocaleString("sv-SE")} kr</td>
                    <td className="p-2 text-center">
                      <Badge variant="outline">v{entry.version}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {published.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            Publicerad <Badge>{published.length}</Badge>
          </h2>

          {/* Per-customer action buttons */}
          <div className="flex flex-wrap gap-2 mb-3">
            {Array.from(publishedCustomers.entries()).map(([id, name]) => (
              <div key={id} className="flex items-center gap-1">
                <span className="text-sm font-medium">{name}:</span>
                <Button variant="outline" size="sm" onClick={() => setHistoryCustomer({ id, name })}>
                  Historik
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setEndDialogCustomer({ id, name })}>
                  Avsluta
                </Button>
              </div>
            ))}
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left font-medium">Kund</th>
                <th className="p-2 text-left font-medium">Artikel</th>
                <th className="p-2 text-left font-medium">Giltig från</th>
                <th className="p-2 text-left font-medium">Giltig till</th>
                <th className="p-2 text-right font-medium">Timmar</th>
                <th className="p-2 text-right font-medium">Belopp</th>
                <th className="p-2 text-center font-medium">Version</th>
              </tr>
            </thead>
            <tbody>
              {published.map((entry) => (
                <tr key={entry.id} className="border-b">
                  <td className="p-2">{entry.customer.name}</td>
                  <td className="p-2">{entry.article.name}</td>
                  <td className="p-2">{formatPeriod(entry.startYear, entry.startMonth)}</td>
                  <td className="p-2">
                    {entry.endYear != null && entry.endMonth != null
                      ? formatPeriod(entry.endYear, entry.endMonth)
                      : <Badge variant="default">Pågående</Badge>
                    }
                  </td>
                  <td className="p-2 text-right">{Number(entry.hours)}</td>
                  <td className="p-2 text-right">{Number(entry.amount).toLocaleString("sv-SE")} kr</td>
                  <td className="p-2 text-center">
                    <Badge variant="secondary">v{entry.version}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
            Alla pågående budgetposter för <strong>{endDialogCustomer?.name}</strong> avslutas per {formatPeriod(year, month)}.
          </p>
          <Button
            variant="destructive"
            onClick={() => {
              if (endDialogCustomer) {
                endBudgetMutation.mutate({
                  customerId: endDialogCustomer.id,
                  endYear: year,
                  endMonth: month,
                });
              }
            }}
            disabled={endBudgetMutation.isPending}
          >
            {endBudgetMutation.isPending ? "Avslutar..." : "Bekräfta avslut"}
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
