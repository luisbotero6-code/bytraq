"use client";

import { Button } from "@/components/ui/button";

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
  function prev() {
    if (month === 1) onChange(year - 1, 12);
    else onChange(year, month - 1);
  }

  function next() {
    if (month === 12) onChange(year + 1, 1);
    else onChange(year, month + 1);
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={prev}>
        &larr;
      </Button>
      <span className="min-w-[100px] text-center text-sm font-medium">
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <Button variant="outline" size="sm" onClick={next}>
        &rarr;
      </Button>
    </div>
  );
}
