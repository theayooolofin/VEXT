import { describe, expect, it } from 'vitest';
import { normalizeNigerianPhone, phoneHint } from '@/lib/phone';

describe('normalizeNigerianPhone (spec 7.4 table)', () => {
  it.each([
    ['0803 123 4567', '+2348031234567'],
    ['08031234567', '+2348031234567'],
    ['+234 803 123 4567', '+2348031234567'],
    ['2348031234567', '+2348031234567'],
    ['803 123 4567', '+2348031234567'],
  ])('accepts %s', (input, expected) => {
    expect(normalizeNigerianPhone(input)).toBe(expected);
  });

  it.each(['12345', '+447911123456', 'abc'])('rejects %s', (input) => {
    expect(normalizeNigerianPhone(input)).toBeNull();
  });

  it('handles spaces, hyphens and a leading plus', () => {
    expect(normalizeNigerianPhone('  0803-123-4567 ')).toBe('+2348031234567');
    expect(normalizeNigerianPhone('+234-803-123-4567')).toBe('+2348031234567');
    expect(normalizeNigerianPhone('(0803) 123 4567')).toBe('+2348031234567');
  });

  it('accepts 7, 8 and 9 prefixes only', () => {
    expect(normalizeNigerianPhone('07031234567')).toBe('+2347031234567');
    expect(normalizeNigerianPhone('09031234567')).toBe('+2349031234567');
    expect(normalizeNigerianPhone('06031234567')).toBeNull();
    expect(normalizeNigerianPhone('2346031234567')).toBeNull();
  });

  it('rejects empty, too short, too long and a plus with a local number', () => {
    expect(normalizeNigerianPhone('')).toBeNull();
    expect(normalizeNigerianPhone('   ')).toBeNull();
    expect(normalizeNigerianPhone('0803123456')).toBeNull();
    expect(normalizeNigerianPhone('080312345678')).toBeNull();
    expect(normalizeNigerianPhone('+08031234567')).toBeNull();
    expect(normalizeNigerianPhone('+8031234567')).toBeNull();
  });

  it('shows only the last four digits as a hint', () => {
    expect(phoneHint('+2348031234567')).toBe('4567');
    expect(phoneHint(null)).toBe('');
  });
});
