"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { KPICard } from "@/modules/reports/components/kpi-card";
import { CustomerMultiSelect } from "@/modules/reports/components/customer-multi-select";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

function formatSEK(amount: number): string {
  return new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(amount);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatVariance(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

type ArticleFilter = "FIXED_PRICE" | "TILLAGG" | "ALL";
type SortField = "name" | "hours" | "budgetHours" | "utilization" | "variance" | "budgetAmount" | "cost" | "tb" | "tg";
type SortDir = "asc" | "desc";

interface FixedPriceAnalysisProps {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
}

interface CustomerGroup {
  customerId: string;
  customerName: string;
  actualHours: number;
  budgetHours: number;
  varianceHours: number;
  budgetAmount: number;
  hourlyEquivalent: number;
  actualCost: number;
  tb: number;
  tgPercent: number;
  articles: ArticleRow[];
}

interface ArticleRow {
  articleId: string;
  articleName: string;
  actualHours: number;
  budgetHours: number;
  varianceHours: number;
  budgetAmount: number;
  hourlyEquivalent: number;
  actualCost: number;
  tb: number;
  tgPercent: number;
}

/** Tiny horizontal bar showing budget usage */
function BudgetBar({ actual, budget }: { actual: number; budget: number }) {
  if (budget <= 0 && actual <= 0) return null;
  const pct = budget > 0 ? Math.min((actual / budget) * 100, 150) : 100;
  const over = actual > budget;
  return (
    <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden" title={`${actual.toFixed(1)}h / ${budget.toFixed(1)}h`}>
      <div
        className={cn("h-full rounded-full transition-all", over ? "bg-red-500" : "bg-green-500")}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

export function FixedPriceAnalysis({ startYear, startMonth, endYear, endMonth }: FixedPriceAnalysisProps) {
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [articleFilter, setArticleFilter] = useState<ArticleFilter>("ALL");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { data: fixedPriceCustomers } = trpc.customer.list.useQuery();
  const fpCustomers = (fixedPriceCustomers ?? []).filter(
    c => c.customerType === "FASTPRIS" || c.customerType === "BLANDAD"
  );

  const { data, isLoading } = trpc.kpi.fixedPriceAnalysis.useQuery({
    customerIds: selectedCustomers,
    startYear,
    startMonth,
    endYear,
    endMonth,
    articleFilter,
  });

  // Group rows by customer and sort articles by absolute variance desc
  const customerGroups = useMemo<CustomerGroup[]>(() => {
    if (!data) return [];
    const map = new Map<string, CustomerGroup>();

    for (const row of data.rows) {
      let group = map.get(row.customerId);
      if (!group) {
        group = {
          customerId: row.customerId,
          customerName: row.customerName,
          actualHours: 0,
          budgetHours: 0,
          varianceHours: 0,
          budgetAmount: 0,
          hourlyEquivalent: 0,
          actualCost: 0,
          tb: 0,
          tgPercent: 0,
          articles: [],
        };
        map.set(row.customerId, group);
      }
      group.actualHours += row.actualHours;
      group.budgetHours += row.budgetHours;
      group.varianceHours += row.varianceHours;
      group.budgetAmount += row.budgetAmount;
      group.hourlyEquivalent += row.hourlyEquivalent;
      group.actualCost += row.actualCost;
      group.tb += row.tb;
      group.articles.push({
        articleId: row.articleId,
        articleName: row.articleName,
        actualHours: row.actualHours,
        budgetHours: row.budgetHours,
        varianceHours: row.varianceHours,
        budgetAmount: row.budgetAmount,
        hourlyEquivalent: row.hourlyEquivalent,
        actualCost: row.actualCost,
        tb: row.tb,
        tgPercent: row.tgPercent,
      });
    }

    // Calculate customer-level TG% and sort articles
    for (const group of map.values()) {
      group.tgPercent = group.budgetAmount > 0 ? group.tb / group.budgetAmount : 0;
      group.articles.sort((a, b) => Math.abs(b.varianceHours) - Math.abs(a.varianceHours));
    }

    const groups = Array.from(map.values());

    // Sort customer groups
    groups.sort((a, b) => {
      let cmp = 0;
      const utilA = a.budgetHours > 0 ? a.actualHours / a.budgetHours : 0;
      const utilB = b.budgetHours > 0 ? b.actualHours / b.budgetHours : 0;
      switch (sortField) {
        case "name": cmp = a.customerName.localeCompare(b.customerName, "sv"); break;
        case "hours": cmp = a.actualHours - b.actualHours; break;
        case "budgetHours": cmp = a.budgetHours - b.budgetHours; break;
        case "utilization": cmp = utilA - utilB; break;
        case "variance": cmp = a.varianceHours - b.varianceHours; break;
        case "budgetAmount": cmp = a.budgetAmount - b.budgetAmount; break;
        case "cost": cmp = a.actualCost - b.actualCost; break;
        case "tb": cmp = a.tb - b.tb; break;
        case "tg": cmp = a.tgPercent - b.tgPercent; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return groups;
  }, [data, sortField, sortDir]);

  function toggleExpand(customerId: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "name" ? "asc" : "desc");
    }
  }

  function expandAll() {
    setExpandedIds(new Set(customerGroups.map(g => g.customerId)));
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  const filterButtons: { value: ArticleFilter; label: string }[] = [
    { value: "ALL", label: "Alla" },
    { value: "FIXED_PRICE", label: "Fastpris" },
    { value: "TILLAGG", label: "Tillägg" },
  ];

  const SortHeader = ({ field, children, align = "right" }: { field: SortField; children: React.ReactNode; align?: "left" | "right" | "center" }) => (
    <th
      className={cn(
        "p-2 font-medium cursor-pointer select-none hover:bg-muted/50 transition-colors",
        align === "right" && "text-right",
        align === "left" && "text-left",
        align === "center" && "text-center",
      )}
      onClick={() => handleSort(field)}
    >
      <span className={cn("inline-flex items-center gap-1", align === "center" && "justify-center")}>
        {children}
        {sortField === field && (
          <span className="text-xs">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>
        )}
      </span>
    </th>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-4 flex-wrap">
        <CustomerMultiSelect
          customers={fpCustomers}
          selected={selectedCustomers}
          onChange={setSelectedCustomers}
        />
        <div className="flex items-center gap-1">
          {filterButtons.map(f => (
            <Button
              key={f.value}
              variant={articleFilter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => setArticleFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        {data && data.rows.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="ghost" size="sm" onClick={expandAll}>Visa alla</Button>
            <Button variant="ghost" size="sm" onClick={collapseAll}>Dölj alla</Button>
            <span className="text-sm text-muted-foreground">
              {data.customerCount} kunder &middot; {data.monthCount} mån
            </span>
          </div>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Laddar...</p>}

      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <KPICard
              title="Fastpris (budget)"
              value={formatSEK(data.totals.budgetAmount)}
              subtitle={`${data.totals.budgetHours.toFixed(0)}h budgeterat`}
            />
            <KPICard
              title="Kostnad"
              value={formatSEK(data.totals.actualCost)}
              subtitle={`${data.totals.actualHours.toFixed(0)}h arbetade`}
            />
            <KPICard
              title="TB"
              value={formatSEK(data.totals.tb)}
              trend={data.totals.tb >= 0 ? "up" : "down"}
            />
            <KPICard
              title="TG%"
              value={formatPercent(data.totals.tgPercent)}
              trend={data.totals.tgPercent >= 0.4 ? "up" : data.totals.tgPercent >= 0.2 ? "neutral" : "down"}
            />
            <KPICard
              title="Avvikelse timmar"
              value={`${formatVariance(data.totals.varianceHours)}h`}
              trend={data.totals.varianceHours <= 0 ? "up" : "down"}
              subtitle={data.totals.budgetHours > 0 ? `${((data.totals.varianceHours / data.totals.budgetHours) * 100).toFixed(0)}% av budget` : undefined}
            />
          </div>

          {/* Grouped Table */}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-8 p-2" />
                  <SortHeader field="name" align="left">Kund</SortHeader>
                  <SortHeader field="hours">Timmar</SortHeader>
                  <SortHeader field="budgetHours">Budget h</SortHeader>
                  <SortHeader field="utilization" align="center">Utnyttjande</SortHeader>
                  <SortHeader field="variance">Avvikelse h</SortHeader>
                  <SortHeader field="budgetAmount">Fastpris</SortHeader>
                  <SortHeader field="cost">Kostnad</SortHeader>
                  <SortHeader field="tb">TB</SortHeader>
                  <SortHeader field="tg">TG%</SortHeader>
                </tr>
              </thead>
              <tbody>
                {customerGroups.map((group) => {
                  const isExpanded = expandedIds.has(group.customerId);
                  return (
                    <CustomerGroupRows
                      key={group.customerId}
                      group={group}
                      isExpanded={isExpanded}
                      onToggle={() => toggleExpand(group.customerId)}
                    />
                  );
                })}
                {customerGroups.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-muted-foreground">
                      Ingen data för vald period och filter.
                    </td>
                  </tr>
                )}
              </tbody>
              {customerGroups.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 bg-muted/30 font-bold">
                    <td className="p-2" />
                    <td className="p-2">Totalt</td>
                    <td className="p-2 text-right">{data.totals.actualHours.toFixed(1)}</td>
                    <td className="p-2 text-right">{data.totals.budgetHours.toFixed(1)}</td>
                    <td className="p-2 text-center">
                      <BudgetBar actual={data.totals.actualHours} budget={data.totals.budgetHours} />
                    </td>
                    <td className={cn("p-2 text-right", data.totals.varianceHours > 0 ? "text-red-600" : "text-green-600")}>
                      {formatVariance(data.totals.varianceHours)}
                    </td>
                    <td className="p-2 text-right">{formatSEK(data.totals.budgetAmount)}</td>
                    <td className="p-2 text-right">{formatSEK(data.totals.actualCost)}</td>
                    <td className={cn("p-2 text-right", data.totals.tb < 0 && "text-red-600")}>
                      {formatSEK(data.totals.tb)}
                    </td>
                    <td className={cn(
                      "p-2 text-right",
                      data.totals.tgPercent < 0.2 && "text-red-600",
                      data.totals.tgPercent >= 0.2 && data.totals.tgPercent < 0.4 && "text-yellow-600",
                    )}>
                      {formatPercent(data.totals.tgPercent)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/** Renders one customer summary row + optionally expanded article rows */
function CustomerGroupRows({
  group,
  isExpanded,
  onToggle,
}: {
  group: CustomerGroup;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      {/* Summary row */}
      <tr
        className={cn(
          "border-b cursor-pointer transition-colors hover:bg-muted/40",
          isExpanded && "bg-muted/20",
        )}
        onClick={onToggle}
      >
        <td className="p-2 text-center">
          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              isExpanded && "rotate-90",
            )}
          />
        </td>
        <td className="p-2 font-medium">{group.customerName}</td>
        <td className="p-2 text-right">{group.actualHours.toFixed(1)}</td>
        <td className="p-2 text-right">{group.budgetHours.toFixed(1)}</td>
        <td className="p-2 flex justify-center">
          <BudgetBar actual={group.actualHours} budget={group.budgetHours} />
        </td>
        <td className={cn("p-2 text-right font-medium", group.varianceHours > 0 ? "text-red-600" : "text-green-600")}>
          {formatVariance(group.varianceHours)}
        </td>
        <td className="p-2 text-right">{formatSEK(group.budgetAmount)}</td>
        <td className="p-2 text-right">{formatSEK(group.actualCost)}</td>
        <td className={cn("p-2 text-right font-medium", group.tb < 0 && "text-red-600")}>
          {formatSEK(group.tb)}
        </td>
        <td className={cn(
          "p-2 text-right font-medium",
          group.tgPercent < 0.2 && "text-red-600",
          group.tgPercent >= 0.2 && group.tgPercent < 0.4 && "text-yellow-600",
        )}>
          {formatPercent(group.tgPercent)}
        </td>
      </tr>

      {/* Expanded article rows */}
      {isExpanded && group.articles.map((art) => (
        <tr
          key={`${group.customerId}:${art.articleId}`}
          className="border-b bg-muted/10"
        >
          <td className="p-2" />
          <td className="p-2 pl-8 text-muted-foreground">{art.articleName}</td>
          <td className="p-2 text-right text-muted-foreground">{art.actualHours.toFixed(1)}</td>
          <td className="p-2 text-right text-muted-foreground">{art.budgetHours.toFixed(1)}</td>
          <td className="p-2">
            <div className="flex justify-center">
              <BudgetBar actual={art.actualHours} budget={art.budgetHours} />
            </div>
          </td>
          <td className={cn("p-2 text-right", art.varianceHours > 0 ? "text-red-600" : "text-green-600")}>
            {formatVariance(art.varianceHours)}
          </td>
          <td className="p-2 text-right text-muted-foreground">{formatSEK(art.budgetAmount)}</td>
          <td className="p-2 text-right text-muted-foreground">{formatSEK(art.actualCost)}</td>
          <td className={cn("p-2 text-right", art.tb < 0 && "text-red-600")}>
            {formatSEK(art.tb)}
          </td>
          <td className={cn(
            "p-2 text-right",
            art.tgPercent < 0.2 && "text-red-600",
            art.tgPercent >= 0.2 && art.tgPercent < 0.4 && "text-yellow-600",
          )}>
            {formatPercent(art.tgPercent)}
          </td>
        </tr>
      ))}
    </>
  );
}
