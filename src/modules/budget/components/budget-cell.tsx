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
 * Safe math expression evaluator.
 * Supports: numbers, +, -, *, /, parentheses, decimals (both . and ,).
 * Strips leading = sign (Excel-style).
 * Returns NaN if the expression is invalid.
 */
function evaluateExpression(input: string): number {
  let expr = input.trim();

  // Strip leading = (Excel habit)
  if (expr.startsWith("=")) {
    expr = expr.slice(1).trim();
  }

  // Replace Swedish decimal comma with dot (e.g. "2,5" → "2.5")
  // but only when comma is between digits (not a thousands separator)
  expr = expr.replace(/(\d),(\d)/g, "$1.$2");

  // Remove any whitespace
  expr = expr.replace(/\s/g, "");

  // Validate: only allow digits, ., +, -, *, /, (, )
  if (!/^[\d.+\-*/()]+$/.test(expr) || expr.length === 0) {
    return NaN;
  }

  // Prevent empty parens, double operators, etc.
  if (/[+\-*/]{2,}/.test(expr.replace(/[+\-](?=[\d.(])/g, ""))) {
    return NaN;
  }

  try {
    // Use Function constructor for safe eval of math-only expressions.
    // The regex above guarantees only math characters are present.
    const result = new Function(`"use strict"; return (${expr})`)() as unknown;
    if (typeof result !== "number" || !isFinite(result)) return NaN;
    return result;
  } catch {
    return NaN;
  }
}

/**
 * Editable number cell with formula support and +/- steppers.
 *
 * Type a number directly, or a formula like:
 *   =2*500    →  1000
 *   100+50    →  150
 *   3*8,5     →  25.5
 *   (10+5)*3  →  45
 *
 * Saves on Enter or blur. Escape reverts.
 */
export function BudgetCell({ value, step = 0.5, decimals = 2, onSave, className }: BudgetCellProps) {
  const [displayValue, setDisplayValue] = useState(formatDisplay(value, decimals));
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef(value);

  // Sync external value changes (e.g. after refetch)
  useEffect(() => {
    if (!isEditing) {
      setDisplayValue(formatDisplay(value, decimals));
      savedRef.current = value;
    }
  }, [value, decimals, isEditing]);

  const commitValue = useCallback((newValue: number) => {
    const clamped = Math.max(0, newValue);
    const rounded = Number(clamped.toFixed(decimals));
    setDisplayValue(formatDisplay(rounded, decimals));
    if (rounded !== savedRef.current) {
      savedRef.current = rounded;
      onSave(rounded);
    }
  }, [decimals, onSave]);

  function handleFocus() {
    setIsEditing(true);
    // Show the raw number for editing
    setEditText(savedRef.current.toString().replace(".", ","));
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function handleBlur() {
    setIsEditing(false);
    resolveAndCommit(editText);
  }

  function resolveAndCommit(text: string) {
    const result = evaluateExpression(text);
    if (isNaN(result)) {
      // Revert to last saved value
      setDisplayValue(formatDisplay(savedRef.current, decimals));
      return;
    }
    commitValue(result);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      setEditText(savedRef.current.toString().replace(".", ","));
      setIsEditing(false);
      setDisplayValue(formatDisplay(savedRef.current, decimals));
      inputRef.current?.blur();
    }
    if (e.key === "ArrowUp" && !isExpressionInput(editText)) {
      e.preventDefault();
      const num = parseFloat(editText.replace(",", ".")) || 0;
      const newVal = num + step;
      setEditText(newVal.toString().replace(".", ","));
      commitValue(newVal);
    }
    if (e.key === "ArrowDown" && !isExpressionInput(editText)) {
      e.preventDefault();
      const num = parseFloat(editText.replace(",", ".")) || 0;
      const newVal = num - step;
      setEditText(newVal.toString().replace(".", ","));
      commitValue(newVal);
    }
  }

  function increment() {
    const current = savedRef.current;
    commitValue(current + step);
  }

  function decrement() {
    const current = savedRef.current;
    commitValue(current - step);
  }

  const showingFormula = isEditing && isExpressionInput(editText);

  return (
    <div
      className={cn(
        "group/cell flex items-center rounded-md border border-transparent transition-colors",
        isEditing && "border-ring ring-ring/50 ring-[2px]",
        !isEditing && "hover:border-input",
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
        inputMode="text"
        className={cn(
          "h-7 w-full min-w-0 bg-transparent text-right text-xs outline-none px-1 tabular-nums",
          showingFormula && "text-blue-600 font-mono",
        )}
        value={isEditing ? editText : displayValue}
        onChange={(e) => setEditText(e.target.value)}
        onFocus={handleFocus}
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

/** Format a number for display using Swedish locale */
function formatDisplay(num: number, decimals: number): string {
  return num.toLocaleString("sv-SE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Check if the input looks like a formula (has operators) vs plain number */
function isExpressionInput(text: string): boolean {
  const cleaned = text.replace(/^=/, "").replace(/^\s*-/, "");
  return /[+\-*/()]/.test(cleaned);
}
