"use client";

import { useState } from "react";
import { format, addDays, subDays } from "date-fns";
import { sv } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "@/lib/trpc";
import { useCurrentUser } from "@/hooks/use-current-user";
import { timeEntrySchema, type TimeEntryFormData } from "../schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { AbsenceDialog } from "./absence-dialog";
import { ABSENCE_CODES } from "@/lib/constants";

function calcHoursFromRange(from: string, to: string): number | null {
  if (!from || !to) return null;
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const diff = (th * 60 + tm - (fh * 60 + fm)) / 60;
  return diff > 0 ? Math.round(diff * 100) / 100 : null;
}

export function DayView() {
  const { user } = useCurrentUser();
  const employeeId = user?.employeeId;
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const dateStr = format(currentDate, "yyyy-MM-dd");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [fromTime, setFromTime] = useState("");
  const [toTime, setToTime] = useState("");

  const { data: entries, refetch } = trpc.timeEntry.getDay.useQuery(
    { employeeId: employeeId!, date: dateStr },
    { enabled: !!employeeId }
  );

  const { data: absences, refetch: refetchAbsences } = trpc.absence.getDay.useQuery(
    { employeeId: employeeId!, date: dateStr },
    { enabled: !!employeeId }
  );

  const deleteAbsenceMutation = trpc.absence.delete.useMutation({
    onSuccess: () => { refetchAbsences(); toast.success("Frånvaro borttagen"); },
    onError: (err) => toast.error(err.message),
  });

  const { data: customers } = trpc.customer.list.useQuery();
  const { data: articles } = trpc.article.list.useQuery();

  const upsertMutation = trpc.timeEntry.upsert.useMutation({
    onSuccess: () => {
      refetch();
      setDialogOpen(false);
      reset();
      toast.success("Tidrapport sparad");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.timeEntry.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Rad borttagen"); },
    onError: (err) => toast.error(err.message),
  });

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<TimeEntryFormData>({
    resolver: zodResolver(timeEntrySchema),
    defaultValues: {
      employeeId: employeeId ?? "",
      date: dateStr,
      hours: 0,
    },
  });

  function onSubmit(data: TimeEntryFormData) {
    upsertMutation.mutate({ ...data, id: editingId, employeeId: employeeId! });
  }

  function openEdit(entry: NonNullable<typeof entries>[number]) {
    setEditingId(entry.id);
    setValue("customerId", entry.customerId);
    setValue("articleId", entry.articleId);
    setValue("hours", Number(entry.hours));
    setValue("comment", entry.comment);
    setValue("invoiceText", entry.invoiceText);
    setValue("date", dateStr);
    setFromTime("");
    setToTime("");
    setDialogOpen(true);
  }

  function openNew() {
    reset({ employeeId: employeeId ?? "", date: dateStr, hours: 0, customerId: "", articleId: "" });
    setEditingId(undefined);
    setFromTime("");
    setToTime("");
    setDialogOpen(true);
  }

  function handleFromChange(value: string) {
    setFromTime(value);
    const h = calcHoursFromRange(value, toTime);
    if (h !== null) setValue("hours", h);
  }

  function handleToChange(value: string) {
    setToTime(value);
    const h = calcHoursFromRange(fromTime, value);
    if (h !== null) setValue("hours", h);
  }

  const totalHours = entries?.reduce((sum, e) => sum + Number(e.hours), 0) ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setCurrentDate(subDays(currentDate, 1))}>
          &larr;
        </Button>
        <span className="min-w-[180px] text-center text-sm font-medium">
          {format(currentDate, "EEEE d MMMM yyyy", { locale: sv })}
        </span>
        <Button variant="outline" size="sm" onClick={() => setCurrentDate(addDays(currentDate, 1))}>
          &rarr;
        </Button>
      </div>

      <div className="space-y-2">
        {entries?.map((entry) => (
          <Card key={entry.id} className="cursor-pointer hover:bg-accent/50" onClick={() => openEdit(entry)}>
            <CardContent className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-medium">{entry.customer.name}</div>
                <div className="text-xs text-muted-foreground">
                  {entry.article.code} - {entry.article.name}
                </div>
                {entry.comment && (
                  <div className="text-xs text-muted-foreground italic mt-1">{entry.comment}</div>
                )}
                {entry.invoiceText && (
                  <div className="text-xs text-muted-foreground mt-1">Faktura: {entry.invoiceText}</div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{Number(entry.hours).toFixed(1)}h</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(entry.id); }}
                >
                  Ta bort
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Absence entries */}
        {absences?.map((absence) => {
          const codeInfo = ABSENCE_CODES.find((ac) => ac.code === absence.code);
          return (
            <Card key={absence.id} className="border-dashed">
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium">
                    {absence.code ? `${absence.code} — ${codeInfo?.label ?? absence.reason}` : absence.reason}
                  </div>
                  {absence.comment && (
                    <div className="text-xs text-muted-foreground italic mt-1">{absence.comment}</div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{Number(absence.hours).toFixed(1)}h</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteAbsenceMutation.mutate(absence.id)}
                  >
                    Ta bort
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {entries?.length === 0 && (!absences || absences.length === 0) && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Inga tidrapporter för denna dag
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Total: {totalHours.toFixed(1)}h</span>
        <div className="flex items-center gap-2">
          <AbsenceDialog date={currentDate} onSaved={refetchAbsences} />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew}>+ Ny tidrapport</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Redigera" : "Ny"} tidrapport</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Kund</Label>
                <Select onValueChange={(val) => setValue("customerId", val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj kund" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.customerId && <p className="text-xs text-destructive">{errors.customerId.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Artikel</Label>
                <Select onValueChange={(val) => setValue("articleId", val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj artikel" />
                  </SelectTrigger>
                  <SelectContent>
                    {articles?.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.articleId && <p className="text-xs text-destructive">{errors.articleId.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Tidsperiod</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={fromTime}
                    onChange={(e) => handleFromChange(e.target.value)}
                    placeholder="Från"
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="time"
                    value={toTime}
                    onChange={(e) => handleToChange(e.target.value)}
                    placeholder="Till"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Timmar</Label>
                <Input type="number" step="0.25" min="0" max="24" {...register("hours", { valueAsNumber: true })} />
                {fromTime && toTime && calcHoursFromRange(fromTime, toTime) !== null && (
                  <p className="text-xs text-muted-foreground">
                    Beräknat från {fromTime}–{toTime}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Kommentar</Label>
                <Textarea {...register("comment")} placeholder="Intern notering — syns inte på fakturan" />
              </div>

              <div className="space-y-2">
                <Label>Fakturatext</Label>
                <Textarea {...register("invoiceText")} placeholder="Text som skickas vidare till fakturering" />
              </div>

              <Button type="submit" className="w-full" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? "Sparar..." : "Spara"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </div>
  );
}
