"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/shared/page-header";
import { PeriodSelector } from "@/components/shared/period-selector";
import { PeriodRangeSelector } from "@/components/shared/period-range-selector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { FixedPriceAnalysis } from "@/modules/reports/components/fixed-price-analysis";

function formatSEK(amount: number): string {
  return new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(amount);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

type CustomerSortField = "article" | "hours" | "budgetHours" | "revenue" | "cost" | "tg";
type SortDir = "asc" | "desc";

function SortHeader({ active, dir, onClick, children, align = "right" }: {
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "p-2 font-medium cursor-pointer select-none hover:bg-muted/50 transition-colors",
        align === "right" ? "text-right" : "text-left",
      )}
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active && <span className="text-xs">{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

function CustomerReport({ year, month }: { year: number; month: number }) {
  const [customerId, setCustomerId] = useState("");
  const [sortField, setSortField] = useState<CustomerSortField>("article");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const { data: customers } = trpc.customer.list.useQuery();
  const { data: report } = trpc.kpi.customerReport.useQuery(
    { customerId, year, month },
    { enabled: !!customerId }
  );

  function handleSort(field: CustomerSortField) {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "article" ? "asc" : "desc");
    }
  }

  const sortedArticles = useMemo(() => {
    if (!report) return [];
    return [...report.articles].sort((a, b) => {
      let cmp = 0;
      const tgA = a.revenue > 0 ? (a.revenue - a.cost) / a.revenue : 0;
      const tgB = b.revenue > 0 ? (b.revenue - b.cost) / b.revenue : 0;
      switch (sortField) {
        case "article": cmp = a.articleName.localeCompare(b.articleName, "sv"); break;
        case "hours": cmp = a.hours - b.hours; break;
        case "budgetHours": cmp = a.budgetHours - b.budgetHours; break;
        case "revenue": cmp = a.revenue - b.revenue; break;
        case "cost": cmp = a.cost - b.cost; break;
        case "tg": cmp = tgA - tgB; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [report, sortField, sortDir]);

  return (
    <div className="space-y-4">
      <Select value={customerId} onValueChange={setCustomerId}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Välj kund..." />
        </SelectTrigger>
        <SelectContent>
          {customers?.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {report && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Intäkt</div>
                <div className="text-xl font-bold">{formatSEK(report.totals.revenue)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">TB</div>
                <div className="text-xl font-bold">{formatSEK(report.totals.tb)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">TG%</div>
                <div className="text-xl font-bold">{formatPercent(report.totals.tgPercent)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">Kunde debiterat mer</div>
                <div className="text-xl font-bold">{formatSEK(report.totals.couldHaveBilledDiff)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <SortHeader active={sortField === "article"} dir={sortDir} onClick={() => handleSort("article")} align="left">Artikel</SortHeader>
                  <SortHeader active={sortField === "hours"} dir={sortDir} onClick={() => handleSort("hours")}>Timmar</SortHeader>
                  <SortHeader active={sortField === "budgetHours"} dir={sortDir} onClick={() => handleSort("budgetHours")}>Budget h</SortHeader>
                  <SortHeader active={sortField === "revenue"} dir={sortDir} onClick={() => handleSort("revenue")}>Intäkt</SortHeader>
                  <SortHeader active={sortField === "cost"} dir={sortDir} onClick={() => handleSort("cost")}>Kostnad</SortHeader>
                  <SortHeader active={sortField === "tg"} dir={sortDir} onClick={() => handleSort("tg")}>TG%</SortHeader>
                </tr>
              </thead>
              <tbody>
                {sortedArticles.map((a) => (
                  <tr key={a.articleId} className="border-b">
                    <td className="p-2">{a.articleName}</td>
                    <td className="p-2 text-right">{a.hours.toFixed(1)}</td>
                    <td className="p-2 text-right">{a.budgetHours.toFixed(1)}</td>
                    <td className="p-2 text-right">{formatSEK(a.revenue)}</td>
                    <td className="p-2 text-right">{formatSEK(a.cost)}</td>
                    <td className="p-2 text-right">
                      {a.revenue > 0 ? formatPercent((a.revenue - a.cost) / a.revenue) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

type PortfolioSortField = "name" | "hours" | "budgetHours" | "revenue" | "tg" | "status";

const statusOrder = { green: 0, yellow: 1, red: 2 };

function PortfolioView({ year, month }: { year: number; month: number }) {
  const [managerId, setManagerId] = useState("");
  const [sortField, setSortField] = useState<PortfolioSortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const { data: employees } = trpc.employee.list.useQuery();
  const { data: portfolio } = trpc.kpi.portfolio.useQuery(
    { clientManagerId: managerId, year, month },
    { enabled: !!managerId }
  );

  function handleSort(field: PortfolioSortField) {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "name" ? "asc" : "desc");
    }
  }

  const sortedPortfolio = useMemo(() => {
    if (!portfolio) return [];
    return [...portfolio].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = a.customer.name.localeCompare(b.customer.name, "sv"); break;
        case "hours": cmp = a.hours - b.hours; break;
        case "budgetHours": cmp = a.budgetHours - b.budgetHours; break;
        case "revenue": cmp = a.revenue - b.revenue; break;
        case "tg": cmp = a.tgPercent - b.tgPercent; break;
        case "status": cmp = statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder]; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [portfolio, sortField, sortDir]);

  return (
    <div className="space-y-4">
      <Select value={managerId} onValueChange={setManagerId}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Välj klientansvarig..." />
        </SelectTrigger>
        <SelectContent>
          {employees?.map((e) => (
            <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {portfolio && (
        <>
          {portfolio.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Inga kunder för denna klientansvarig</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <SortHeader active={sortField === "name"} dir={sortDir} onClick={() => handleSort("name")} align="left">Kund</SortHeader>
                    <SortHeader active={sortField === "hours"} dir={sortDir} onClick={() => handleSort("hours")}>Timmar</SortHeader>
                    <SortHeader active={sortField === "budgetHours"} dir={sortDir} onClick={() => handleSort("budgetHours")}>Budget h</SortHeader>
                    <SortHeader active={sortField === "revenue"} dir={sortDir} onClick={() => handleSort("revenue")}>Intäkt</SortHeader>
                    <SortHeader active={sortField === "tg"} dir={sortDir} onClick={() => handleSort("tg")}>TG%</SortHeader>
                    <SortHeader active={sortField === "status"} dir={sortDir} onClick={() => handleSort("status")}>Status</SortHeader>
                  </tr>
                </thead>
                <tbody>
                  {sortedPortfolio.map((item) => (
                    <tr key={item.customer.id} className="border-b">
                      <td className="p-2 font-medium">{item.customer.name}</td>
                      <td className="p-2 text-right">{item.hours.toFixed(1)}</td>
                      <td className="p-2 text-right">{item.budgetHours.toFixed(1)}</td>
                      <td className="p-2 text-right">{formatSEK(item.revenue)}</td>
                      <td className="p-2 text-right">{formatPercent(item.tgPercent)}</td>
                      <td className="p-2 text-right">
                        <Badge
                          className={cn(
                            item.status === "green" && "bg-green-100 text-green-800",
                            item.status === "yellow" && "bg-yellow-100 text-yellow-800",
                            item.status === "red" && "bg-red-100 text-red-800"
                          )}
                        >
                          {item.status === "green" ? "OK" : item.status === "yellow" ? "Varning" : "Kritisk"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmployeeReport({ year, month }: { year: number; month: number }) {
  const [employeeId, setEmployeeId] = useState("");
  const { data: employees } = trpc.employee.list.useQuery();
  const { data: report } = trpc.kpi.employeeReport.useQuery(
    { employeeId, year, month },
    { enabled: !!employeeId }
  );

  return (
    <div className="space-y-4">
      <Select value={employeeId} onValueChange={setEmployeeId}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Välj medarbetare..." />
        </SelectTrigger>
        <SelectContent>
          {employees?.map((e) => (
            <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {report && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Beläggning</div>
              <div className="text-xl font-bold">{formatPercent(report.utilization)}</div>
              <div className="text-xs text-muted-foreground">Mål: {formatPercent(report.targetUtilization)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Debiterbara timmar</div>
              <div className="text-xl font-bold">{report.debitableHours.toFixed(1)}h</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Icke-debiterbar tid</div>
              <div className="text-xl font-bold">{report.nonDebitableHours.toFixed(1)}h</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">Frånvaro</div>
              <div className="text-xl font-bold">{report.absenceHours.toFixed(1)}h</div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [activeTab, setActiveTab] = useState("customer");

  // Period range state for Fastprisanalys
  const [startYear, setStartYear] = useState(now.getFullYear());
  const [startMonth, setStartMonth] = useState(1);
  const [endYear, setEndYear] = useState(now.getFullYear());
  const [endMonth, setEndMonth] = useState(now.getMonth() + 1);

  const isFixedPriceTab = activeTab === "fixed-price";

  return (
    <div>
      <PageHeader title="Rapporter" description="KPI-rapporter och analyser">
        {isFixedPriceTab ? (
          <PeriodRangeSelector
            startYear={startYear}
            startMonth={startMonth}
            endYear={endYear}
            endMonth={endMonth}
            onChange={(sy, sm, ey, em) => {
              setStartYear(sy);
              setStartMonth(sm);
              setEndYear(ey);
              setEndMonth(em);
            }}
          />
        ) : (
          <PeriodSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
        )}
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="customer">Kundrapport</TabsTrigger>
          <TabsTrigger value="portfolio">Portföljvy</TabsTrigger>
          <TabsTrigger value="employee">Medarbetare</TabsTrigger>
          <TabsTrigger value="fixed-price">Fastprisanalys</TabsTrigger>
        </TabsList>
        <TabsContent value="customer" className="mt-4">
          <CustomerReport year={year} month={month} />
        </TabsContent>
        <TabsContent value="portfolio" className="mt-4">
          <PortfolioView year={year} month={month} />
        </TabsContent>
        <TabsContent value="employee" className="mt-4">
          <EmployeeReport year={year} month={month} />
        </TabsContent>
        <TabsContent value="fixed-price" className="mt-4">
          <FixedPriceAnalysis
            startYear={startYear}
            startMonth={startMonth}
            endYear={endYear}
            endMonth={endMonth}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
