import { twMerge } from "tailwind-merge";

import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse a date-only ISO string ("YYYY-MM-DD") as a *local* Date instead of
 * UTC midnight, so date-only fields render on the intended calendar day
 * regardless of the viewer's timezone. Falls back to the raw value if it is
 * not a pure date string (e.g. a full timestamp), which `new Date` handles.
 */
export function parseDateOnly(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`);
  }
  return new Date(value);
}
