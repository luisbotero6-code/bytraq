"use client";

import { useState } from "react";
import { format, differenceInCalendarDays } from "date-fns";
import { trpc } from "@/lib/trpc";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ABSENCE_CODES } from "@/lib/constants";
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

interface AbsenceDialogProps {
  date?: Date;
  onSaved: () => void;
}

export function AbsenceDialog({ date, onSaved }: AbsenceDialogProps) {
  const { user } = useCurrentUser();
  const employeeId = user?.employeeId;

  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [hours, setHours] = useState(8);
  const [comment, setComment] = useState("");
  const [startDate, setStartDate] = useState(() =>
    format(date ?? new Date(), "yyyy-MM-dd"),
  );
  const [endDate, setEndDate] = useState(() =>
    format(date ?? new Date(), "yyyy-MM-dd"),
  );

  const isRange = startDate !== endDate && startDate && endDate && endDate >= startDate;
  const dayCount = isRange
    ? differenceInCalendarDays(new Date(endDate), new Date(startDate)) + 1
    : null;

  const createMutation = trpc.absence.create.useMutation({
    onSuccess: () => {
      toast.success("Frånvaro registrerad");
      setOpen(false);
      resetForm();
      onSaved();
    },
    onError: (err) => toast.error(err.message),
  });

  const createRangeMutation = trpc.absence.createRange.useMutation({
    onSuccess: (result) => {
      toast.success(`Frånvaro registrerad för ${result.count} vardagar`);
      setOpen(false);
      resetForm();
      onSaved();
    },
    onError: (err) => toast.error(err.message),
  });

  const isPending = createMutation.isPending || createRangeMutation.isPending;

  function resetForm() {
    setCode("");
    setHours(8);
    setComment("");
    const d = format(date ?? new Date(), "yyyy-MM-dd");
    setStartDate(d);
    setEndDate(d);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) return;
    if (!code) {
      toast.error("Välj en registreringskod");
      return;
    }
    if (endDate < startDate) {
      toast.error("Slutdatum kan inte vara före startdatum");
      return;
    }

    if (isRange) {
      createRangeMutation.mutate({
        employeeId,
        startDate,
        endDate,
        code,
        hours,
        comment: comment || null,
      });
    } else {
      createMutation.mutate({
        employeeId,
        date: startDate,
        code,
        hours,
        comment: comment || null,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">+ Frånvaro</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrera frånvaro</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Registreringskod</Label>
            <Select value={code} onValueChange={setCode}>
              <SelectTrigger>
                <SelectValue placeholder="Välj kod" />
              </SelectTrigger>
              <SelectContent>
                {ABSENCE_CODES.map((ac) => (
                  <SelectItem key={ac.code} value={ac.code}>
                    {ac.code} — {ac.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Datum</Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            {dayCount && dayCount > 1 && (
              <p className="text-xs text-muted-foreground">
                {dayCount} dagar (helger exkluderas)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Timmar per dag</Label>
            <Input
              type="number"
              step="0.25"
              min="0"
              max="24"
              value={hours}
              onChange={(e) => setHours(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-2">
            <Label>Kommentar</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Valfri kommentar..."
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Sparar..." : "Registrera frånvaro"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
