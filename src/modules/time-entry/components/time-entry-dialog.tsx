"use client";

import { useState } from "react";
import { format } from "date-fns";
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
import { toast } from "sonner";

function calcHoursFromRange(from: string, to: string): number | null {
  if (!from || !to) return null;
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const diff = (th * 60 + tm - (fh * 60 + fm)) / 60;
  return diff > 0 ? Math.round(diff * 100) / 100 : null;
}

interface TimeEntryDialogProps {
  date?: Date;
  onSaved: () => void;
}

export function TimeEntryDialog({ date, onSaved }: TimeEntryDialogProps) {
  const { user } = useCurrentUser();
  const employeeId = user?.employeeId;

  const [open, setOpen] = useState(false);
  const [fromTime, setFromTime] = useState("");
  const [toTime, setToTime] = useState("");
  const [selectedDate, setSelectedDate] = useState(() =>
    format(date ?? new Date(), "yyyy-MM-dd"),
  );

  const { data: customers } = trpc.customer.list.useQuery();
  const { data: articles } = trpc.article.list.useQuery();

  const upsertMutation = trpc.timeEntry.upsert.useMutation({
    onSuccess: () => {
      toast.success("Tidrapport sparad");
      setOpen(false);
      resetForm();
      onSaved();
    },
    onError: (err) => toast.error(err.message),
  });

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<TimeEntryFormData>({
    resolver: zodResolver(timeEntrySchema),
    defaultValues: {
      employeeId: employeeId ?? "",
      date: format(date ?? new Date(), "yyyy-MM-dd"),
      hours: 0,
    },
  });

  function resetForm() {
    const dateStr = format(date ?? new Date(), "yyyy-MM-dd");
    reset({ employeeId: employeeId ?? "", date: dateStr, hours: 0, customerId: "", articleId: "" });
    setFromTime("");
    setToTime("");
    setSelectedDate(dateStr);
  }

  function onSubmit(data: TimeEntryFormData) {
    if (!employeeId) return;
    upsertMutation.mutate({ ...data, date: selectedDate, employeeId });
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

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm">+ Ny tidrapport</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ny tidrapport</DialogTitle>
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
            <Label>Datum</Label>
            {date ? (
              <div className="text-sm text-muted-foreground">
                {format(date, "yyyy-MM-dd")}
              </div>
            ) : (
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Tidsperiod</Label>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={fromTime}
                onChange={(e) => handleFromChange(e.target.value)}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="time"
                value={toTime}
                onChange={(e) => handleToChange(e.target.value)}
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
  );
}
