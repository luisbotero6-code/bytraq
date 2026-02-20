"use client";

import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "Maj", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dec",
];

function formatPeriod(year: number, month: number) {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

interface BudgetHistoryDialogProps {
  customerId: string;
  customerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BudgetHistoryDialog({
  customerId,
  customerName,
  open,
  onOpenChange,
}: BudgetHistoryDialogProps) {
  const { data: entries, isLoading } = trpc.budget.history.useQuery(
    { customerId },
    { enabled: open },
  );

  // Group entries by start period
  const grouped = new Map<string, typeof entries>();
  if (entries) {
    for (const entry of entries) {
      const key = `${entry.startYear}-${entry.startMonth}`;
      const group = grouped.get(key) ?? [];
      group.push(entry);
      grouped.set(key, group);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Budgethistorik &mdash; {customerName}</DialogTitle>
        </DialogHeader>

        {isLoading && <p className="text-sm text-muted-foreground">Laddar...</p>}

        {!isLoading && (!entries || entries.length === 0) && (
          <p className="text-sm text-muted-foreground">Ingen publicerad budget hittad.</p>
        )}

        {grouped.size > 0 && (
          <div className="space-y-4">
            {Array.from(grouped.entries()).map(([key, group]) => {
              const first = group![0];
              const periodLabel = formatPeriod(first.startYear, first.startMonth);
              const endLabel = first.endYear != null && first.endMonth != null
                ? formatPeriod(first.endYear, first.endMonth)
                : null;

              return (
                <div key={key}>
                  <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                    {periodLabel} &rarr; {endLabel ?? <Badge variant="default">Pågående</Badge>}
                  </h3>
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2 text-left font-medium">Artikel</th>
                        <th className="p-2 text-right font-medium">Timmar</th>
                        <th className="p-2 text-right font-medium">Belopp</th>
                        <th className="p-2 text-center font-medium">Version</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group!.map((entry) => (
                        <tr key={entry.id} className="border-b">
                          <td className="p-2">{entry.article.name}</td>
                          <td className="p-2 text-right">{Number(entry.hours)}</td>
                          <td className="p-2 text-right">{Number(entry.amount).toLocaleString("sv-SE")} kr</td>
                          <td className="p-2 text-center">
                            <Badge variant="outline">v{entry.version}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
