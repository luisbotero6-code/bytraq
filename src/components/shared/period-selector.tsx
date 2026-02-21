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

interface PeriodSelectorProps {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}

export function PeriodSelector({ year, month, onChange }: PeriodSelectorProps) {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);

  function prev() {
    if (month === 1) onChange(year - 1, 12);
    else onChange(year, month - 1);
  }

  function next() {
    if (month === 12) onChange(year + 1, 1);
    else onChange(year, month + 1);
  }

  function handleOpen(isOpen: boolean) {
    if (isOpen) setPickerYear(year);
    setOpen(isOpen);
  }

  function selectMonth(m: number) {
    onChange(pickerYear, m);
    setOpen(false);
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={prev}>
        &larr;
      </Button>

      <Popover open={open} onOpenChange={handleOpen}>
        <PopoverTrigger asChild>
          <button className="min-w-[100px] text-center text-sm font-medium hover:bg-accent hover:text-accent-foreground rounded-md px-3 py-1.5 transition-colors cursor-pointer">
            {MONTH_NAMES[month - 1]} {year}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="center">
          {/* Year selector */}
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

          {/* Month grid */}
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

      <Button variant="outline" size="sm" onClick={next}>
        &rarr;
      </Button>
    </div>
  );
}
