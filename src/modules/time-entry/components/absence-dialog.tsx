"use client";

import { useState } from "react";
import { format } from "date-fns";
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
  date: Date;
  onSaved: () => void;
}

export function AbsenceDialog({ date, onSaved }: AbsenceDialogProps) {
  const { user } = useCurrentUser();
  const employeeId = user?.employeeId;

  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [hours, setHours] = useState(8);
  const [comment, setComment] = useState("");

  const createMutation = trpc.absence.create.useMutation({
    onSuccess: () => {
      toast.success("Frånvaro registrerad");
      setOpen(false);
      resetForm();
      onSaved();
    },
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setCode("");
    setHours(8);
    setComment("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) return;
    if (!code) {
      toast.error("Välj en registreringskod");
      return;
    }

    createMutation.mutate({
      employeeId,
      date: format(date, "yyyy-MM-dd"),
      code,
      hours,
      comment: comment || null,
    });
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
            <Label>Timmar</Label>
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

          <div className="text-sm text-muted-foreground">
            Datum: {format(date, "yyyy-MM-dd")}
          </div>

          <Button type="submit" className="w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Sparar..." : "Registrera frånvaro"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
