export const PHONE_ERROR = 'Enter a Nigerian phone number like 0803 123 4567.';

/**
 * Normalises a Nigerian mobile number to E.164 (+234 and 10 digits starting
 * with 7, 8 or 9). Returns null for anything else.
 */
export function normalizeNigerianPhone(input: string): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!/^\+?[\d\s\-().]+$/.test(trimmed)) return null;
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  let national: string | null = null;
  if (digits.startsWith('234') && digits.length === 13) national = digits.slice(3);
  else if (!hasPlus && digits.startsWith('0') && digits.length === 11) national = digits.slice(1);
  else if (!hasPlus && digits.length === 10) national = digits;
  if (!national || !/^[789]\d{9}$/.test(national)) return null;
  return `+234${national}`;
}

/** Last four digits, the only part of a phone number we show or log. */
export function phoneHint(e164: string | null | undefined): string {
  return e164 ? e164.slice(-4) : '';
}
