"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/shared/page-header";
import { PeriodSelector } from "@/components/shared/period-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const MONTH_NAMES = [
  "Januari", "Februari", "Mars", "April", "Maj", "Juni",
  "Juli", "Augusti", "September", "Oktober", "November", "December",
];

const MONTH_SHORT = ["JAN", "FEB", "MAR", "APR", "MAJ", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEC"];

const DAY_NAMES = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

// --- Year Overview ---

function YearOverview({ year }: { year: number }) {
  const { data: yearDays, isLoading } = trpc.calendar.listYear.useQuery({ year });

  // Build lookup: "M-D" → workHours, isWeekend, isHoliday
  const dayMap = useMemo(() => {
    const map = new Map<string, { workHours: number; isWeekend: boolean; isHoliday: boolean }>();
    yearDays?.forEach((d) => {
      const dt = new Date(d.date);
      const key = `${dt.getUTCMonth() + 1}-${dt.getUTCDate()}`;
      map.set(key, {
        workHours: Number(d.workHours),
        isWeekend: d.isWeekend,
        isHoliday: d.isHoliday,
      });
    });
    return map;
  }, [yearDays]);

  // Get work hours for a given day, defaulting to 8h for weekdays, 0h for weekends
  function getWorkHours(month: number, day: number): number {
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day > daysInMonth) return -1; // day doesn't exist in this month

    const entry = dayMap.get(`${month}-${day}`);
    if (entry) return entry.workHours;

    // Default: check if weekend
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    const dow = date.getUTCDay();
    if (dow === 0 || dow === 6) return 0;
    return 8;
  }

  function getCellStyle(month: number, day: number): string {
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day > daysInMonth) return "bg-muted/30";

    const entry = dayMap.get(`${month}-${day}`);
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    const dow = date.getUTCDay();
    const isWeekend = entry?.isWeekend ?? (dow === 0 || dow === 6);
    const isHoliday = entry?.isHoliday ?? false;
    const workHours = getWorkHours(month, day);

    if (isHoliday) return "bg-red-100 text-red-700";
    if (isWeekend) return "bg-red-50 text-red-300";
    if (workHours > 0 && workHours < 8) return "bg-amber-50 text-amber-700 font-medium";
    return "";
  }

  // Monthly sums
  const monthlySums = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      let sum = 0;
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const h = getWorkHours(m + 1, d);
        if (h > 0) sum += h;
      }
      return sum;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearDays, year]);

  const yearTotal = monthlySums.reduce((a, b) => a + b, 0);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-4">Laddar...</p>;
  }

  return (
    <Card>
      <CardContent className="pt-4 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground border-b w-12">D/M</th>
              {MONTH_SHORT.map((m) => (
                <th key={m} className="px-2 py-1.5 text-center font-medium text-muted-foreground border-b min-w-[70px]">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <tr key={day} className="border-b border-muted/50">
                <td className="px-2 py-1 font-medium text-muted-foreground">{day}</td>
                {Array.from({ length: 12 }, (_, m) => m + 1).map((month) => {
                  const daysInMonth = new Date(year, month, 0).getDate();
                  if (day > daysInMonth) {
                    return <td key={month} className="px-2 py-1 text-center bg-muted/20" />;
                  }
                  const hours = getWorkHours(month, day);
                  const style = getCellStyle(month, day);
                  return (
                    <td key={month} className={`px-2 py-1 text-center ${style}`}>
                      {hours === 0 ? "" : hours.toFixed(2).replace(".", ",")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2">
              <td className="px-2 py-1.5 text-left font-medium text-muted-foreground border-b">{/* spacer */}</td>
              {MONTH_SHORT.map((m) => (
                <td key={m} className="px-2 py-1.5 text-center font-medium text-muted-foreground border-b">{m}</td>
              ))}
            </tr>
            <tr className="font-semibold">
              <td className="px-2 py-1.5">Arb</td>
              {monthlySums.map((sum, i) => (
                <td key={i} className="px-2 py-1.5 text-center">{sum.toFixed(2).replace(".", ",")}</td>
              ))}
            </tr>
          </tfoot>
        </table>
        <div className="flex justify-end mt-3 gap-2 text-sm font-semibold">
          <span className="text-muted-foreground">Årstotal timmar</span>
          <span>Arbete</span>
          <span className="border px-3 py-0.5 rounded">{yearTotal.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ")}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Month View (existing) ---

function MonthView({ year, month }: { year: number; month: number }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [dayType, setDayType] = useState<"holiday" | "halfday" | "normal">("holiday");
  const [holidayName, setHolidayName] = useState("");

  const { data: calendarDays, refetch } = trpc.calendar.list.useQuery({ year, month });

  const upsertMutation = trpc.calendar.upsert.useMutation({
    onSuccess: () => { refetch(); setDialogOpen(false); toast.success("Kalenderdag uppdaterad"); },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.calendar.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Kalenderdag återställd"); },
    onError: (err) => toast.error(err.message),
  });

  const dayMap = new Map<string, NonNullable<typeof calendarDays>[number]>();
  calendarDays?.forEach((d) => {
    const dt = new Date(d.date);
    const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
    dayMap.set(key, d);
  });

  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;

  const days: Array<{ day: number; dateStr: string; isWeekend: boolean } | null> = [];
  for (let i = 0; i < startDayOfWeek; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ day: d, dateStr, isWeekend: dow === 0 || dow === 6 });
  }

  function openDayDialog(dateStr: string) {
    setSelectedDate(dateStr);
    const existing = dayMap.get(dateStr);
    if (existing) {
      if (existing.isHoliday) {
        setDayType("holiday");
        setHolidayName(existing.holidayName ?? "");
      } else if (!existing.isWeekend && Number(existing.workHours) < 8) {
        setDayType("halfday");
        setHolidayName(existing.holidayName ?? "");
      } else {
        setDayType("normal");
        setHolidayName("");
      }
    } else {
      setDayType("holiday");
      setHolidayName("");
    }
    setDialogOpen(true);
  }

  function handleSave() {
    if (dayType === "normal") {
      const existing = dayMap.get(selectedDate);
      if (existing) {
        deleteMutation.mutate(selectedDate);
      } else {
        setDialogOpen(false);
      }
      return;
    }
    upsertMutation.mutate({
      date: selectedDate,
      isHoliday: dayType === "holiday",
      holidayName: holidayName || null,
      workHours: dayType === "holiday" ? 0 : 5,
    });
  }

  function getDayStyle(dateStr: string, isWeekend: boolean) {
    const entry = dayMap.get(dateStr);
    if (entry?.isHoliday) return "bg-red-100 text-red-800 border-red-200";
    if (entry && !entry.isWeekend && Number(entry.workHours) < 8 && !entry.isHoliday) return "bg-amber-100 text-amber-800 border-amber-200";
    if (isWeekend) return "bg-muted text-muted-foreground";
    return "bg-background hover:bg-muted/50";
  }

  return (
    <>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{MONTH_NAMES[month - 1]} {year}</h2>
            <div className="flex gap-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-100 border border-red-200" />
                <span>Röd dag</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-amber-100 border border-amber-200" />
                <span>Halvdag (5h)</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground p-2">
                {d}
              </div>
            ))}
            {days.map((d, i) => {
              if (d === null) return <div key={i} />;
              const entry = dayMap.get(d.dateStr);
              return (
                <button
                  key={i}
                  className={`relative text-center text-sm p-2 rounded border cursor-pointer transition-colors ${getDayStyle(d.dateStr, d.isWeekend)}`}
                  onClick={() => openDayDialog(d.dateStr)}
                >
                  <span className="font-medium">{d.day}</span>
                  {entry?.isHoliday && (
                    <div className="text-[10px] leading-tight truncate mt-0.5">{entry.holidayName || "Röd dag"}</div>
                  )}
                  {entry && !entry.isHoliday && !entry.isWeekend && Number(entry.workHours) < 8 && (
                    <div className="text-[10px] leading-tight truncate mt-0.5">{entry.holidayName || `${Number(entry.workHours)}h`}</div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Redigera {selectedDate}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Typ</Label>
              <Select value={dayType} onValueChange={(v) => setDayType(v as typeof dayType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Vanlig arbetsdag (8h)</SelectItem>
                  <SelectItem value="halfday">Halvdag (5h)</SelectItem>
                  <SelectItem value="holiday">Röd dag (0h)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {dayType !== "normal" && (
              <div className="space-y-2">
                <Label>Namn (t.ex. &quot;Julafton&quot;)</Label>
                <Input value={holidayName} onChange={(e) => setHolidayName(e.target.value)} placeholder="Valfritt namn..." />
              </div>
            )}
            <Button className="w-full" onClick={handleSave} disabled={upsertMutation.isPending || deleteMutation.isPending}>
              Spara
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// --- Page ---

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  return (
    <div>
      <PageHeader title="Kalender" description="Helgdagar och arbetstider">
        <PeriodSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </PageHeader>

      <Tabs defaultValue="month">
        <TabsList>
          <TabsTrigger value="month">Månadsvy</TabsTrigger>
          <TabsTrigger value="year">Årsöversikt</TabsTrigger>
        </TabsList>

        <TabsContent value="month">
          <MonthView year={year} month={month} />
        </TabsContent>

        <TabsContent value="year">
          <YearOverview year={year} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
