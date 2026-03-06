import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Normalize a string for safe searching: lowercase and strip non-alphanumeric
export function normalizeSearch(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Tokenize a user's query into alphanumeric tokens
export function tokenizeSearch(s: string) {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * In-memory throttle suitable for serverless / edge environments.
 * Returns a wrapper that enforces a minimum interval between calls.
 * Calls during the cooldown are dropped and the rejection callback is invoked.
 */
export function createThrottle<T extends (...args: unknown[]) => void>(
  fn: T,
  intervalMs: number,
  onReject?: () => void,
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall < intervalMs) {
      onReject?.();
      return;
    }
    lastCall = now;
    fn(...args);
  };
}
