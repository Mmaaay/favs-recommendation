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
