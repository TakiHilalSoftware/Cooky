"use client";

import { useEffect, useState } from "react";

/** `value`, but only once it has stopped changing for `delayMs` (typing → one request, not one per key). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}
