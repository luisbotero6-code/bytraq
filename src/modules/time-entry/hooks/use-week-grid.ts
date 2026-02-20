"use client";

import { useMemo } from "react";
import { startOfWeek, addDays, format } from "date-fns";
import { sv } from "date-fns/locale";

export interface WeekDay {
  date: Date;
  dateStr: string;
  dayLabel: string;
  dayShort: string;
}

export function useWeekGrid(weekStart: Date) {
  const days = useMemo<WeekDay[]>(() => {
    const start = startOfWeek(weekStart, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      return {
        date,
        dateStr: format(date, "yyyy-MM-dd"),
        dayLabel: format(date, "EEEE d/M", { locale: sv }),
        dayShort: format(date, "EEE", { locale: sv }),
      };
    });
  }, [weekStart]);

  return { days };
}
