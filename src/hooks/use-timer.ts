"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TIMER_STORAGE_KEYS } from "@/lib/constants";

interface TimerState {
  startTime: string | null; // ISO string
}

const MAX_SECONDS = 24 * 60 * 60; // 24h cap

function getStoredState(): TimerState {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEYS.TIMER_STATE);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
  }
  return { startTime: null };
}

function persistState(state: TimerState) {
  try {
    localStorage.setItem(TIMER_STORAGE_KEYS.TIMER_STATE, JSON.stringify(state));
  } catch {
    // Ignore quota errors
  }
}

function calcElapsed(startTime: string | null): number {
  if (!startTime) return 0;
  const seconds = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
  return Math.min(Math.max(0, seconds), MAX_SECONDS);
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function useTimer() {
  const [startTime, setStartTime] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const state = getStoredState();
    setStartTime(state.startTime);
    setElapsedSeconds(calcElapsed(state.startTime));
    setHydrated(true);
  }, []);

  // Tick every second when running
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!startTime) {
      setElapsedSeconds(0);
      return;
    }

    setElapsedSeconds(calcElapsed(startTime));
    intervalRef.current = setInterval(() => {
      setElapsedSeconds(calcElapsed(startTime));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startTime]);

  // Listen for cross-tab storage events
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key !== TIMER_STORAGE_KEYS.TIMER_STATE) return;
      const state = getStoredState();
      setStartTime(state.startTime);
      setElapsedSeconds(calcElapsed(state.startTime));
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const start = useCallback(() => {
    const now = new Date().toISOString();
    setStartTime(now);
    persistState({ startTime: now });
  }, []);

  const stop = useCallback((): number => {
    const elapsed = calcElapsed(startTime);
    setStartTime(null);
    persistState({ startTime: null });
    return elapsed;
  }, [startTime]);

  const reset = useCallback(() => {
    setStartTime(null);
    setElapsedSeconds(0);
    persistState({ startTime: null });
  }, []);

  return {
    isRunning: !!startTime,
    elapsedSeconds,
    formattedTime: formatTime(elapsedSeconds),
    start,
    stop,
    reset,
    hydrated,
  };
}
