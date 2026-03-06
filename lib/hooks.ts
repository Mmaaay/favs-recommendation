import { useState, useEffect } from "react";

/**
 * Returns a debounced copy of `value` that only updates after
 * `delay` ms of inactivity. Use for live search inputs to avoid
 * a DB hit on every keystroke.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
