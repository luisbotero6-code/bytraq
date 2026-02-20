"use client";

import { useState, useEffect, useCallback } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  // Read from localStorage on mount
  useEffect(() => {
    try {
      const item = localStorage.getItem(key);
      if (item !== null) {
        setStoredValue(JSON.parse(item));
      }
    } catch {
      // Ignore parse errors
    }
    setHydrated(true);
  }, [key]);

  // Listen for cross-tab changes
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key !== key) return;
      try {
        setStoredValue(e.newValue !== null ? JSON.parse(e.newValue) : initialValue);
      } catch {
        // Ignore parse errors
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key, initialValue]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const nextValue = value instanceof Function ? value(prev) : value;
        try {
          localStorage.setItem(key, JSON.stringify(nextValue));
        } catch {
          // Ignore quota errors
        }
        return nextValue;
      });
    },
    [key],
  );

  const removeValue = useCallback(() => {
    setStoredValue(initialValue);
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore errors
    }
  }, [key, initialValue]);

  return [storedValue, setValue, { hydrated, removeValue }] as const;
}
