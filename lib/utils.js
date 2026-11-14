import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Join class names and let later Tailwind classes win over earlier conflicting ones.
 * @param {...import("clsx").ClassValue} inputs
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
