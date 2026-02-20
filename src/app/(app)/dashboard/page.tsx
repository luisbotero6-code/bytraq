"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PeriodSelector } from "@/components/shared/period-selector";
import { PageHeader } from "@/components/shared/page-header";
import { KPICard } from "@/modules/reports/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function formatSEK(amount: number): string {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function DashboardPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const { user } = useCurrentUser();

  const { data: kpi, isLoading } = trpc.kpi.dashboard.useQuery({
    year,
    month,
    ...(user?.role === "MEDARBETARE" && user.employeeId
      ? { employeeId: user.employeeId }
      : {}),
  });

  const chartData = kpi
    ? [
        { name: "Intäkt", value: kpi.totalRevenue },
        { name: "Kostnad", value: kpi.totalCost },
        { name: "TB", value: kpi.tb },
      ]
    : [];

  return (
    <div>
      <PageHeader title="Dashboard" description="Översikt av KPI:er och nyckeltal">
        <PeriodSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </PageHeader>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Laddar...</div>
      ) : kpi ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Täckningsbidrag"
              value={formatSEK(kpi.tb)}
              subtitle={`Intäkt: ${formatSEK(kpi.totalRevenue)}`}
              trend={kpi.tb > 0 ? "up" : "down"}
            />
            <KPICard
              title="Täckningsgrad"
              value={formatPercent(kpi.tgPercent)}
              subtitle={`Kostnad: ${formatSEK(kpi.totalCost)}`}
              trend={kpi.tgPercent >= 0.5 ? "up" : kpi.tgPercent >= 0.3 ? "neutral" : "down"}
            />
            <KPICard
              title="Beläggning"
              value={formatPercent(kpi.utilization)}
              subtitle={`${kpi.debitableHours.toFixed(0)}h av ${kpi.totalCapacityHours.toFixed(0)}h`}
              trend={kpi.utilization >= 0.7 ? "up" : "down"}
            />
            <KPICard
              title="Budgetavvikelse"
              value={`${kpi.budgetVarianceHours > 0 ? "+" : ""}${kpi.budgetVarianceHours.toFixed(0)}h`}
              subtitle={formatSEK(kpi.budgetVarianceAmount)}
              trend={kpi.budgetVarianceHours <= 0 ? "up" : "down"}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Intäkt / Kostnad / TB</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => formatSEK(Number(v))} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sammanfattning</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Totala timmar</span>
                  <span className="font-medium">{kpi.totalHours.toFixed(1)}h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Debiterbara timmar</span>
                  <span className="font-medium">{kpi.debitableHours.toFixed(1)}h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Budgettimmar</span>
                  <span className="font-medium">{kpi.budgetHours.toFixed(1)}h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Antal medarbetare</span>
                  <span className="font-medium">{kpi.employeeCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Kapacitet</span>
                  <span className="font-medium">{kpi.totalCapacityHours.toFixed(0)}h</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
