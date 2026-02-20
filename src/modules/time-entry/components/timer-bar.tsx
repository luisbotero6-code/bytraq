"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Play, Square } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useTimer } from "@/hooks/use-timer";
import { Button } from "@/components/ui/button";
import { TimerStopDialog } from "./timer-stop-dialog";

export function TimerBar() {
  const { user } = useCurrentUser();
  const employeeId = user?.employeeId;
  const timer = useTimer();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stoppedSeconds, setStoppedSeconds] = useState(0);

  // Today's total hours query
  const dateStr = format(new Date(), "yyyy-MM-dd");
  const { data: todayEntries, refetch: refetchToday } = trpc.timeEntry.getDay.useQuery(
    { employeeId: employeeId!, date: dateStr },
    { enabled: !!employeeId },
  );
  const todayTotal = todayEntries?.reduce((sum, e) => sum + Number(e.hours), 0) ?? 0;

  // Keyboard shortcut Alt+T
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.altKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        if (timer.isRunning) {
          handleStop();
        } else if (!dialogOpen) {
          timer.start();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function handleStop() {
    const elapsed = timer.stop();
    setStoppedSeconds(elapsed);
    setDialogOpen(true);
  }

  const handleSaved = useCallback(() => {
    timer.reset();
    setDialogOpen(false);
    refetchToday();
  }, [timer, refetchToday]);

  const handleDiscard = useCallback(() => {
    timer.reset();
    setDialogOpen(false);
  }, [timer]);

  // Don't render during SSR or if no employeeId
  if (!timer.hydrated || !employeeId) return null;

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50">
        {timer.isRunning ? (
          /* Running state */
          <div className="flex items-center gap-3 rounded-full bg-background border shadow-lg px-4 py-2">
            {/* Pulsing red dot */}
            <span className="relative flex size-3">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex size-3 rounded-full bg-red-500" />
            </span>

            <span className="font-mono text-sm font-medium tabular-nums">
              {timer.formattedTime}
            </span>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleStop}
              className="rounded-full h-8 px-3"
            >
              <Square className="size-3.5 mr-1 fill-current" />
              Stopp
            </Button>
          </div>
        ) : (
          /* Idle state */
          <div className="flex items-center gap-2 rounded-full bg-background border shadow-lg px-4 py-2">
            {todayTotal > 0 && (
              <span className="text-xs text-muted-foreground">
                Idag: {todayTotal.toFixed(1)}h
              </span>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={() => timer.start()}
              className="rounded-full h-8 px-3"
            >
              <Play className="size-3.5 mr-1 fill-current" />
              Starta timer
            </Button>
          </div>
        )}
      </div>

      <TimerStopDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        elapsedSeconds={stoppedSeconds}
        onSaved={handleSaved}
        onDiscard={handleDiscard}
      />
    </>
  );
}
