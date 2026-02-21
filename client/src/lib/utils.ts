/**
 * Utility function to merge Tailwind CSS classes
 * Based on shadcn/ui pattern using tailwind-merge and clsx
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
