"use client";

import { useSyncExternalStore } from "react";

const defaultTarget = 3.75;
const changeEvent = "sipyeong-semester-target";
const currentTargets = new Map<string, number>();

function subscribe(listener: () => void) {
  window.addEventListener(changeEvent, listener);
  return () => window.removeEventListener(changeEvent, listener);
}

export function useSemesterTarget(userId: string, term: { year: number; termCode: string }) {
  const key = `sipyeong-target:${userId}:${term.year}:${term.termCode}`;
  const target = useSyncExternalStore(subscribe, () => {
    const current = currentTargets.get(key);
    if (current !== undefined) return current;
    try {
      const value = Number(sessionStorage.getItem(key));
      return value >= 2 && value <= 4.5 ? value : defaultTarget;
    } catch {
      return defaultTarget;
    }
  }, () => defaultTarget);
  return [target, (value: number = defaultTarget) => {
    currentTargets.set(key, value);
    try {
      sessionStorage.setItem(key, String(value));
    } catch {
      // The in-memory value is still shared on navigation.
    }
    window.dispatchEvent(new Event(changeEvent));
  }] as const;
}
