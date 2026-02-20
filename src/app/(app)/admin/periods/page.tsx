"use client";

import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const MONTH_NAMES = [
  "Januari", "Februari", "Mars", "April", "Maj", "Juni",
  "Juli", "Augusti", "September", "Oktober", "November", "December",
];

export default function PeriodsPage() {
  const { data: locks, refetch } = trpc.periodLock.list.useQuery();

  const lockMutation = trpc.periodLock.lock.useMutation({
    onSuccess: () => { refetch(); toast.success("Period låst"); },
    onError: (err) => toast.error(err.message),
  });

  const unlockMutation = trpc.periodLock.unlock.useMutation({
    onSuccess: () => { refetch(); toast.success("Period upplåst"); },
    onError: (err) => toast.error(err.message),
  });

  // Generate 18-month grid
  const now = new Date();
  const months: Array<{ year: number; month: number }> = [];
  for (let i = 17; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  return (
    <div>
      <PageHeader title="Periodlåsning" description="Lås och lås upp perioder" />

      <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
        {months.map(({ year, month }) => {
          const lock = locks?.find((l) => l.year === year && l.month === month);
          const isLocked = lock && !lock.unlockedAt;

          return (
            <div
              key={`${year}-${month}`}
              className="rounded-lg border p-3 space-y-2"
            >
              <div className="text-xs text-muted-foreground">{year}</div>
              <div className="text-sm font-medium">{MONTH_NAMES[month - 1]}</div>
              <Badge variant={isLocked ? "destructive" : "secondary"}>
                {isLocked ? "Låst" : "Öppen"}
              </Badge>
              {isLocked && lock && (
                <div className="text-xs text-muted-foreground">
                  av {lock.lockedBy.name}
                </div>
              )}
              <Button
                variant={isLocked ? "outline" : "default"}
                size="sm"
                className="w-full"
                onClick={() =>
                  isLocked
                    ? unlockMutation.mutate({ year, month })
                    : lockMutation.mutate({ year, month })
                }
              >
                {isLocked ? "Lås upp" : "Lås"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
