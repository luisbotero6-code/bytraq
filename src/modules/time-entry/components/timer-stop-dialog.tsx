"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { TIMER_STORAGE_KEYS, TIMER_ROUNDING_INCREMENT } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface TimerStopDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  elapsedSeconds: number;
  onSaved: () => void;
  onDiscard: () => void;
}

function secondsToHours(seconds: number): number {
  return seconds / 3600;
}

function calcHoursFromRange(from: string, to: string): number | null {
  if (!from || !to) return null;
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const diff = (th * 60 + tm - (fh * 60 + fm)) / 60;
  return diff > 0 ? Math.round(diff * 100) / 100 : null;
}

function roundToNearest(hours: number, increment: number): number {
  return Math.round(hours / increment) * increment;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TimerStopDialog({
  open,
  onOpenChange,
  elapsedSeconds,
  onSaved,
  onDiscard,
}: TimerStopDialogProps) {
  const { user } = useCurrentUser();
  const employeeId = user?.employeeId;

  const [lastCustomer, setLastCustomer] = useLocalStorage<string>(
    TIMER_STORAGE_KEYS.LAST_CUSTOMER,
    "",
  );
  const [lastArticle, setLastArticle] = useLocalStorage<string>(
    TIMER_STORAGE_KEYS.LAST_ARTICLE,
    "",
  );

  const [customerId, setCustomerId] = useState("");
  const [articleId, setArticleId] = useState("");
  const [comment, setComment] = useState("");
  const [invoiceText, setInvoiceText] = useState("");
  const [roundUp, setRoundUp] = useState(true);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [fromTime, setFromTime] = useState("");
  const [toTime, setToTime] = useState("");

  // Pre-fill with last used values when dialog opens
  useEffect(() => {
    if (open) {
      setCustomerId(lastCustomer);
      setArticleId(lastArticle);
      setComment("");
      setInvoiceText("");
      setRoundUp(true);
      setConfirmDiscard(false);
      setFromTime("");
      setToTime("");
    }
  }, [open, lastCustomer, lastArticle]);

  const { data: customers } = trpc.customer.list.useQuery();
  const { data: articles } = trpc.article.list.useQuery();

  const upsertMutation = trpc.timeEntry.upsert.useMutation({
    onSuccess: () => {
      toast.success("Tidrapport sparad");
      setLastCustomer(customerId);
      setLastArticle(articleId);
      onSaved();
    },
    onError: (err) => toast.error(err.message),
  });

  const rangeHours = calcHoursFromRange(fromTime, toTime);
  const usingRange = rangeHours !== null;
  const rawHours = usingRange ? rangeHours : secondsToHours(elapsedSeconds);
  const displayHours = roundUp
    ? roundToNearest(rawHours, TIMER_ROUNDING_INCREMENT)
    : Math.round(rawHours * 100) / 100;
  const isOverDay = !usingRange && elapsedSeconds > 24 * 3600;
  const cappedHours = Math.min(displayHours, 24);

  function handleSave() {
    if (!employeeId) return;
    if (!customerId) {
      toast.error("Välj en kund");
      return;
    }
    if (!articleId) {
      toast.error("Välj en artikel");
      return;
    }

    upsertMutation.mutate({
      employeeId,
      customerId,
      articleId,
      date: format(new Date(), "yyyy-MM-dd"),
      hours: cappedHours,
      comment: comment || null,
      invoiceText: invoiceText || null,
    });
  }

  function handleDiscard() {
    if (!confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    onDiscard();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Spara tidrapport</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Elapsed time display */}
          <div className="rounded-md bg-muted p-3 text-center">
            <div className="text-2xl font-mono font-medium">
              {formatElapsed(elapsedSeconds)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {displayHours.toFixed(2)} timmar
              {roundUp && " (avrundat)"}
            </div>
            {isOverDay && (
              <p className="text-sm text-destructive mt-1">
                Timern har kört i mer än 24h. Värdet har kapats till 24h.
              </p>
            )}
          </div>

          {/* Time range override */}
          <div className="space-y-2">
            <Label>Tidsperiod (valfritt — ersätter uppmätt tid)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={fromTime}
                onChange={(e) => setFromTime(e.target.value)}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="time"
                value={toTime}
                onChange={(e) => setToTime(e.target.value)}
              />
            </div>
            {usingRange && (
              <p className="text-xs text-muted-foreground">
                Beräknat från {fromTime}–{toTime}
              </p>
            )}
          </div>

          {/* Round checkbox */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="round-timer"
              checked={roundUp}
              onCheckedChange={(checked) => setRoundUp(checked === true)}
            />
            <Label htmlFor="round-timer" className="text-sm font-normal cursor-pointer">
              Avrunda till närmaste 15 min
            </Label>
          </div>

          {/* Customer select */}
          <div className="space-y-2">
            <Label>Kund</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
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
          </div>

          {/* Article select */}
          <div className="space-y-2">
            <Label>Artikel</Label>
            <Select value={articleId} onValueChange={setArticleId}>
              <SelectTrigger>
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
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <Label>Kommentar</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Intern notering — syns inte på fakturan"
            />
          </div>

          {/* Invoice text */}
          <div className="space-y-2">
            <Label>Fakturatext</Label>
            <Textarea
              value={invoiceText}
              onChange={(e) => setInvoiceText(e.target.value)}
              placeholder="Text som skickas vidare till fakturering"
            />
          </div>

          {/* Date (read-only) */}
          <div className="text-sm text-muted-foreground">
            Datum: {format(new Date(), "yyyy-MM-dd")}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={upsertMutation.isPending}
              className="flex-1"
            >
              {upsertMutation.isPending ? "Sparar..." : "Spara tidrapport"}
            </Button>
            <Button
              variant="outline"
              onClick={handleDiscard}
              className={confirmDiscard ? "border-destructive text-destructive" : ""}
            >
              {confirmDiscard ? "Bekräfta kassera" : "Kassera"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
