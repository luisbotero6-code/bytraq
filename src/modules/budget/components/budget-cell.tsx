"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";

interface BudgetCellProps {
  value: number;
  step?: number;
  decimals?: number;
  onSave: (value: number) => void;
  className?: string;
}

/**
 * Editable number cell with +/- stepper buttons.
 * Saves on blur and on stepper click.
 */
export function BudgetCell({ value, step = 0.5, decimals = 2, onSave, className }: BudgetCellProps) {
  const [localValue, setLocalValue] = useState(value.toFixed(decimals));
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef(value);

  // Sync external value changes (e.g. after refetch)
  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value.toFixed(decimals));
      savedRef.current = value;
    }
  }, [value, decimals, isFocused]);

  const commitValue = useCallback((newValue: number) => {
    const clamped = Math.max(0, newValue);
    const rounded = Number(clamped.toFixed(decimals));
    setLocalValue(rounded.toFixed(decimals));
    if (rounded !== savedRef.current) {
      savedRef.current = rounded;
      onSave(rounded);
    }
  }, [decimals, onSave]);

  function handleBlur() {
    setIsFocused(false);
    const num = parseFloat(localValue);
    if (isNaN(num)) {
      // Revert to last saved
      setLocalValue(savedRef.current.toFixed(decimals));
      return;
    }
    commitValue(num);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      setLocalValue(savedRef.current.toFixed(decimals));
      inputRef.current?.blur();
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const num = parseFloat(localValue) || 0;
      commitValue(num + step);
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const num = parseFloat(localValue) || 0;
      commitValue(num - step);
    }
  }

  function increment() {
    const num = parseFloat(localValue) || 0;
    commitValue(num + step);
  }

  function decrement() {
    const num = parseFloat(localValue) || 0;
    commitValue(num - step);
  }

  return (
    <div
      className={cn(
        "group/cell flex items-center rounded-md border border-transparent transition-colors",
        isFocused && "border-ring ring-ring/50 ring-[2px]",
        !isFocused && "hover:border-input",
        className,
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        onClick={decrement}
        className="shrink-0 h-7 w-6 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 focus:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
        aria-label="Minska"
      >
        <Minus className="h-3 w-3" />
      </button>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        className="h-7 w-full min-w-0 bg-transparent text-right text-xs outline-none px-1 tabular-nums"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={() => {
          setIsFocused(true);
          // Select all on focus for easy overwrite
          setTimeout(() => inputRef.current?.select(), 0);
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={increment}
        className="shrink-0 h-7 w-6 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 focus:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
        aria-label="Öka"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}
