"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { startOfWeek, addDays, addWeeks, subWeeks, format } from "date-fns";
import { sv } from "date-fns/locale";
import { trpc } from "@/lib/trpc";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AbsenceDialog } from "./absence-dialog";
import { TimeEntryDialog } from "./time-entry-dialog";
import { ABSENCE_CODES } from "@/lib/constants";

interface WeekRow {
  customerId: string;
  articleId: string;
  hours: (number | null)[];
  entryIds: (string | undefined)[];
}

export function WeekView() {
  const { user } = useCurrentUser();
  const employeeId = user?.employeeId;

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, "yyyy-MM-dd");

  const [rows, setRows] = useState<WeekRow[]>([]);
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data: weekEntries, refetch } = trpc.timeEntry.getWeek.useQuery(
    { employeeId: employeeId!, weekStart: weekStartStr },
    { enabled: !!employeeId }
  );

  const { data: weekAbsences, refetch: refetchAbsences } = trpc.absence.getWeek.useQuery(
    { employeeId: employeeId!, weekStart: weekStartStr },
    { enabled: !!employeeId }
  );

  const deleteAbsenceMutation = trpc.absence.delete.useMutation({
    onSuccess: () => { refetchAbsences(); toast.success("Frånvaro borttagen"); },
    onError: (err) => toast.error(err.message),
  });

  const { data: customers } = trpc.customer.list.useQuery();
  const { data: articles } = trpc.article.list.useQuery();

  const upsertMutation = trpc.timeEntry.upsert.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.timeEntry.delete.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => toast.error(err.message),
  });

  const copyPrevWeekMutation = trpc.timeEntry.copyPreviousWeek.useMutation({
    onSuccess: () => { refetch(); toast.success("Föregående vecka kopierad"); },
    onError: (err) => toast.error(err.message),
  });

  // Sync rows from fetched entries
  useEffect(() => {
    if (!weekEntries) return;

    const rowMap = new Map<string, WeekRow>();
    for (const entry of weekEntries) {
      const key = `${entry.customerId}-${entry.articleId}`;
      if (!rowMap.has(key)) {
        rowMap.set(key, {
          customerId: entry.customerId,
          articleId: entry.articleId,
          hours: Array(7).fill(null),
          entryIds: Array(7).fill(undefined),
        });
      }
      const row = rowMap.get(key)!;
      const dayIndex = Math.round(
        (new Date(entry.date).getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (dayIndex >= 0 && dayIndex < 7) {
        row.hours[dayIndex] = Number(entry.hours);
        row.entryIds[dayIndex] = entry.id;
      }
    }

    const existingRows = Array.from(rowMap.values());
    // Keep empty rows user may have added
    setRows((prev) => {
      const newRows = [...existingRows];
      for (const r of prev) {
        const key = `${r.customerId}-${r.articleId}`;
        if (!rowMap.has(key) && (r.customerId || r.articleId)) {
          newRows.push(r);
        }
      }
      return newRows;
    });
  }, [weekEntries, weekStartStr]);

  function addRow() {
    setRows((prev) => [
      ...prev,
      { customerId: "", articleId: "", hours: Array(7).fill(null), entryIds: Array(7).fill(undefined) },
    ]);
  }

  const handleHoursChange = useCallback(
    (rowIndex: number, dayIndex: number, value: string) => {
      const numValue = value === "" ? null : parseFloat(value);

      setRows((prev) => {
        const updated = [...prev];
        updated[rowIndex] = { ...updated[rowIndex], hours: [...updated[rowIndex].hours] };
        updated[rowIndex].hours[dayIndex] = numValue;
        return updated;
      });

      // Debounced save
      const key = `${rowIndex}-${dayIndex}`;
      const existing = debounceTimers.current.get(key);
      if (existing) clearTimeout(existing);

      debounceTimers.current.set(
        key,
        setTimeout(() => {
          const row = rows[rowIndex] || { customerId: "", articleId: "" };
          if (!row.customerId || !row.articleId || !employeeId) return;

          const hours = numValue ?? 0;
          const entryId = rows[rowIndex]?.entryIds?.[dayIndex];
          const date = format(days[dayIndex], "yyyy-MM-dd");

          if (hours === 0 && entryId) {
            deleteMutation.mutate(entryId);
          } else if (hours > 0) {
            upsertMutation.mutate(
              { id: entryId, employeeId, customerId: row.customerId, articleId: row.articleId, date, hours },
              { onSuccess: (result) => {
                setRows((prev) => {
                  const updated = [...prev];
                  if (updated[rowIndex]) {
                    updated[rowIndex] = { ...updated[rowIndex], entryIds: [...updated[rowIndex].entryIds] };
                    updated[rowIndex].entryIds[dayIndex] = result.id;
                  }
                  return updated;
                });
              }}
            );
          }
        }, 500)
      );
    },
    [rows, employeeId, days, upsertMutation, deleteMutation]
  );

  function handleKeyDown(e: React.KeyboardEvent, rowIndex: number, dayIndex: number) {
    let nextRow = rowIndex;
    let nextDay = dayIndex;

    if (e.key === "Tab" || e.key === "ArrowRight") {
      e.preventDefault();
      nextDay = dayIndex + 1;
      if (nextDay >= 7) { nextDay = 0; nextRow = rowIndex + 1; }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      nextDay = dayIndex - 1;
      if (nextDay < 0) { nextDay = 6; nextRow = rowIndex - 1; }
    } else if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      nextRow = rowIndex + 1;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      nextRow = rowIndex - 1;
    } else {
      return;
    }

    const ref = inputRefs.current.get(`${nextRow}-${nextDay}`);
    ref?.focus();
    ref?.select();
  }

  const rowTotals = rows.map((r) =>
    r.hours.reduce<number>((sum, h) => sum + (h ?? 0), 0)
  );
  const absenceDayTotals = days.map((_, di) =>
    (weekAbsences ?? [])
      .filter((a) => {
        const idx = Math.round((new Date(a.date).getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
        return idx === di;
      })
      .reduce((sum, a) => sum + Number(a.hours), 0)
  );
  const dayTotals = days.map((_, di) =>
    rows.reduce((sum, r) => sum + (r.hours[di] ?? 0), 0) + absenceDayTotals[di]
  );
  const grandTotal = dayTotals.reduce((sum, t) => sum + t, 0);

  // Group absences by code for display in the table
  const absenceRows = (() => {
    if (!weekAbsences?.length) return [];
    const map = new Map<string, { code: string; label: string; hours: (number | null)[]; ids: (string | undefined)[] }>();
    for (const a of weekAbsences) {
      const key = a.code ?? a.reason;
      if (!map.has(key)) {
        const codeInfo = ABSENCE_CODES.find((ac) => ac.code === a.code);
        map.set(key, {
          code: a.code ?? a.reason,
          label: codeInfo?.label ?? a.reason,
          hours: Array(7).fill(null),
          ids: Array(7).fill(undefined),
        });
      }
      const row = map.get(key)!;
      const dayIndex = Math.round(
        (new Date(a.date).getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (dayIndex >= 0 && dayIndex < 7) {
        row.hours[dayIndex] = Number(a.hours);
        row.ids[dayIndex] = a.id;
      }
    }
    return Array.from(map.values());
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}>
          &larr; Förra veckan
        </Button>
        <span className="min-w-[200px] text-center text-sm font-medium">
          v.{format(weekStart, "w")} — {format(weekStart, "d MMM", { locale: sv })} - {format(addDays(weekStart, 6), "d MMM yyyy", { locale: sv })}
        </span>
        <Button variant="outline" size="sm" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}>
          Nästa vecka &rarr;
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            employeeId && copyPrevWeekMutation.mutate({ employeeId, targetWeekStart: weekStartStr })
          }
        >
          Kopiera förra veckan
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left font-medium w-40">Kund</th>
              <th className="p-2 text-left font-medium w-40">Artikel</th>
              {days.map((d, i) => (
                <th key={i} className="p-2 text-center font-medium w-20">
                  {format(d, "EEE d/M", { locale: sv })}
                </th>
              ))}
              <th className="p-2 text-center font-medium w-16">Summa</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b">
                <td className="p-1">
                  <Select
                    value={row.customerId}
                    onValueChange={(val) =>
                      setRows((prev) => {
                        const updated = [...prev];
                        updated[ri] = { ...updated[ri], customerId: val };
                        return updated;
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Välj kund" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-1">
                  <Select
                    value={row.articleId}
                    onValueChange={(val) =>
                      setRows((prev) => {
                        const updated = [...prev];
                        updated[ri] = { ...updated[ri], articleId: val };
                        return updated;
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Välj artikel" />
                    </SelectTrigger>
                    <SelectContent>
                      {articles?.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                {days.map((_, di) => (
                  <td key={di} className="p-1">
                    <Input
                      ref={(el) => {
                        if (el) inputRefs.current.set(`${ri}-${di}`, el);
                      }}
                      type="number"
                      step="0.25"
                      min="0"
                      max="24"
                      className="h-8 w-full text-center text-xs"
                      value={row.hours[di] ?? ""}
                      onChange={(e) => handleHoursChange(ri, di, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, ri, di)}
                    />
                  </td>
                ))}
                <td className="p-2 text-center text-xs font-medium">
                  {rowTotals[ri]?.toFixed(1)}
                </td>
              </tr>
            ))}
            {absenceRows.map((aRow, ai) => (
              <tr key={`abs-${ai}`} className="border-b border-dashed bg-muted/30">
                <td colSpan={2} className="p-2 text-xs text-muted-foreground">
                  {aRow.code} — {aRow.label}
                </td>
                {days.map((_, di) => (
                  <td key={di} className="p-2 text-center text-xs text-muted-foreground">
                    {aRow.hours[di] != null ? (
                      <span className="inline-flex items-center gap-1">
                        {aRow.hours[di]!.toFixed(1)}
                        <button
                          className="text-muted-foreground/50 hover:text-destructive text-[10px]"
                          onClick={() => aRow.ids[di] && deleteAbsenceMutation.mutate(aRow.ids[di]!)}
                          title="Ta bort"
                        >
                          &times;
                        </button>
                      </span>
                    ) : ""}
                  </td>
                ))}
                <td className="p-2 text-center text-xs text-muted-foreground font-medium">
                  {aRow.hours.reduce<number>((s, h) => s + (h ?? 0), 0).toFixed(1)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 font-medium">
              <td colSpan={2} className="p-2 text-right text-xs">
                Summa
              </td>
              {dayTotals.map((t, i) => (
                <td key={i} className="p-2 text-center text-xs">
                  {t.toFixed(1)}
                </td>
              ))}
              <td className="p-2 text-center text-xs font-bold">
                {grandTotal.toFixed(1)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <TimeEntryDialog onSaved={() => refetch()} />
        <AbsenceDialog onSaved={() => refetchAbsences()} />
        <Button variant="outline" size="sm" onClick={addRow}>
          + Ny rad
        </Button>
      </div>
    </div>
  );
}
