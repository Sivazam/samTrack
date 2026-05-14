import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Clean phone number by removing hidden Unicode characters
 * that can cause display issues (e.g., \u202c POP DIRECTIONAL FORMATTING)
 */
export function cleanPhoneNumber(phone: string | undefined | null): string {
  if (!phone) return '';
  // Remove hidden Unicode characters that can cause display issues
  return phone.replace(/[\u200B-\u200D\u202A-\u202E\u2060-\u2064\u202C\u202D\u2066-\u206F]/g, '')
    .trim();
}

/**
 * Normalize phone number by:
 * 1. Removing all non-digit characters
 * 2. Stripping leading country codes (0, 91, +91)
 * 3. Returning the last 10 digits
 * 
 * Examples:
 * - "+919876543210" → "9876543210"
 * - "919876543210" → "9876543210"
 * - "09876543210" → "9876543210"
 * - "9876543210" → "9876543210"
 */
export function normalizePhoneNumber(phone: string | undefined | null): string {
  if (!phone) return '';

  // Step 1: Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // Step 2: Handle country code prefixes
  // If starts with 91 and is longer than 10 digits, strip it
  if (digits.length > 10 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }
  // If starts with 0 and is 11 digits, strip it
  else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Step 3: Return last 10 digits if still longer
  if (digits.length > 10) {
    digits = digits.slice(-10);
  }

  return digits;
}

/**
 * Format payment method for display
 * Maps the internal enum value to a human-readable label
 */
export function formatPaymentMethod(method: string | undefined | null): string {
  if (!method) return 'N/A';

  const mapping: Record<string, string> = {
    'CASH': 'Cash',
    'UPI': 'UPI',
    'BANK_TRANSFER': 'NEFT/RTGS',
    'CHEQUE': 'Cheque'
  };

  return mapping[method] || method;
}

/**
 * Subtle badge color classes for payment methods (UI only — not for PDF/Excel exports)
 */
export function getPaymentMethodColor(method: string | undefined | null): string {
  switch (method) {
    case 'CASH': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'UPI': return 'bg-violet-50 text-violet-700 border-violet-200';
    case 'CHEQUE': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'BANK_TRANSFER': return 'bg-sky-50 text-sky-700 border-sky-200';
    default: return '';
  }
}

/**
 * Subtle row background for payment method (UI only)
 */
export function getPaymentMethodRowBg(method: string | undefined | null): string {
  switch (method) {
    case 'CASH': return 'bg-emerald-100/80';
    case 'UPI': return 'bg-violet-100/80';
    case 'CHEQUE': return 'bg-amber-100/80';
    case 'BANK_TRANSFER': return 'bg-sky-100/80';
    default: return '';
  }
}

/** Payment method legend entries for UI display */
export const PAYMENT_METHOD_LEGEND = [
  { method: 'CASH', label: 'Cash', dot: 'bg-emerald-400' },
  { method: 'UPI', label: 'UPI', dot: 'bg-violet-400' },
  { method: 'CHEQUE', label: 'Cheque', dot: 'bg-amber-400' },
  { method: 'BANK_TRANSFER', label: 'NEFT/RTGS', dot: 'bg-sky-400' },
] as const;
