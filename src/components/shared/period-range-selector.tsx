"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "Maj", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dec",
];

interface PeriodRangeSelectorProps {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
  onChange: (startYear: number, startMonth: number, endYear: number, endMonth: number) => void;
}

function MonthPicker({
  label,
  year,
  month,
  onSelect,
}: {
  label: string;
  year: number;
  month: number;
  onSelect: (year: number, month: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);

  function handleOpen(isOpen: boolean) {
    if (isOpen) setPickerYear(year);
    setOpen(isOpen);
  }

  function selectMonth(m: number) {
    onSelect(pickerYear, m);
    setOpen(false);
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Popover open={open} onOpenChange={handleOpen}>
        <PopoverTrigger asChild>
          <button className="min-w-[100px] text-center text-sm font-medium hover:bg-accent hover:text-accent-foreground rounded-md px-3 py-1.5 transition-colors cursor-pointer">
            {MONTH_NAMES[month - 1]} {year}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="center">
          <div className="flex items-center justify-between mb-3">
            <button
              className="p-1 hover:bg-accent rounded transition-colors"
              onClick={() => setPickerYear(pickerYear - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold">{pickerYear}</span>
            <button
              className="p-1 hover:bg-accent rounded transition-colors"
              onClick={() => setPickerYear(pickerYear + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTH_NAMES.map((name, i) => {
              const m = i + 1;
              const isSelected = pickerYear === year && m === month;
              return (
                <button
                  key={m}
                  onClick={() => selectMonth(m)}
                  className={`rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function PeriodRangeSelector({
  startYear,
  startMonth,
  endYear,
  endMonth,
  onChange,
}: PeriodRangeSelectorProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  function handleStartChange(y: number, m: number) {
    // If new start is after end, move end to match start
    if (y > endYear || (y === endYear && m > endMonth)) {
      onChange(y, m, y, m);
    } else {
      onChange(y, m, endYear, endMonth);
    }
  }

  function handleEndChange(y: number, m: number) {
    // If new end is before start, move start to match end
    if (y < startYear || (y === startYear && m < startMonth)) {
      onChange(y, m, y, m);
    } else {
      onChange(startYear, startMonth, y, m);
    }
  }

  function setQuickRange(months: number) {
    let sy = currentYear;
    let sm = currentMonth - months + 1;
    while (sm <= 0) {
      sm += 12;
      sy--;
    }
    onChange(sy, sm, currentYear, currentMonth);
  }

  function setFullYear(year: number) {
    onChange(year, 1, year, 12);
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <MonthPicker label="Från:" year={startYear} month={startMonth} onSelect={handleStartChange} />
      <span className="text-muted-foreground">—</span>
      <MonthPicker label="Till:" year={endYear} month={endMonth} onSelect={handleEndChange} />

      <div className="flex items-center gap-1 ml-2">
        <Button variant="outline" size="sm" onClick={() => setFullYear(currentYear)}>
          Hela {currentYear}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setFullYear(currentYear - 1)}>
          Hela {currentYear - 1}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setQuickRange(3)}>
          3 mån
        </Button>
        <Button variant="outline" size="sm" onClick={() => setQuickRange(6)}>
          6 mån
        </Button>
        <Button variant="outline" size="sm" onClick={() => setQuickRange(12)}>
          12 mån
        </Button>
      </div>
    </div>
  );
}
