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

export default function BudgetPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);

  const { data: entries, refetch } = trpc.budget.list.useQuery({ year, month });
  const publishMutation = trpc.budget.publish.useMutation({
    onSuccess: (result) => {
      refetch();
      setPublishDialogOpen(false);
      toast.success(`Publicerade ${result.published} poster (version ${result.version})`);
    },
    onError: (err) => toast.error(err.message),
  });

  const copyMutation = trpc.budget.copyFromPreviousMonth.useMutation({
    onSuccess: () => { refetch(); toast.success("Budget kopierad från föregående månad"); },
    onError: (err) => toast.error(err.message),
  });

  const upsertMutation = trpc.budget.upsert.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const drafts = entries?.filter((e) => e.status === "DRAFT") ?? [];
  const published = entries?.filter((e) => e.status === "PUBLISHED") ?? [];

  function handleHoursChange(entryId: string, hours: string) {
    const numHours = parseFloat(hours);
    if (isNaN(numHours)) return;
    upsertMutation.mutate({ id: entryId, year, month, customerId: "", articleId: "", hours: numHours });
  }

  return (
    <div>
      <PageHeader title="Budget" description="Hantera budgetar per kund och artikel">
        <Button variant="outline" size="sm" onClick={() => copyMutation.mutate({ year, month })}>
          Kopiera föregående månad
        </Button>
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
                  {drafts.length} poster kommer att publiceras. Detta kan inte ångras.
                </p>
                <Button
                  onClick={() => publishMutation.mutate({ year, month })}
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
              {published.map((entry) => (
                <tr key={entry.id} className="border-b">
                  <td className="p-2">{entry.customer.name}</td>
                  <td className="p-2">{entry.article.name}</td>
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
          Ingen budget för denna period. Kopiera föregående månad eller skapa ny.
        </p>
      )}
    </div>
  );
}
