import { describe, expect, test } from 'vitest';
import {
  canReplaceCodeValue,
  canReplaceWholeCodeValue,
  isCodeValueEmpty,
  normalizeCodeValue
} from '../../src/lib/auth/codePasteSafety';

describe('code paste replacement safety', () => {
  test('normalizes whitespace before comparing code values', () => {
    expect(normalizeCodeValue('123 456')).toBe('123456');
    expect(normalizeCodeValue(' AB\tCD\n')).toBe('ABCD');
  });

  test('allows empty fields to be filled', () => {
    expect(isCodeValueEmpty('')).toBe(true);
    expect(isCodeValueEmpty('   ')).toBe(true);
    expect(isCodeValueEmpty('1')).toBe(false);
    expect(canReplaceCodeValue('', '123456')).toBe(true);
    expect(canReplaceCodeValue('   ', '123456')).toBe(true);
  });

  test('allows numeric codes to replace same-length numeric values', () => {
    expect(canReplaceCodeValue('123456', '654321')).toBe(true);
    expect(canReplaceCodeValue('123 456', '654321')).toBe(true);
  });

  test('respects explicit whole-value replacement permission', () => {
    expect(canReplaceWholeCodeValue('', '654321', false)).toBe(true);
    expect(canReplaceWholeCodeValue('123456', '654321', true)).toBe(true);
    expect(canReplaceWholeCodeValue('123456', '654321', false)).toBe(false);
  });

  test('rejects numeric code replacement for different or non-numeric values', () => {
    expect(canReplaceCodeValue('12345', '654321')).toBe(false);
    expect(canReplaceCodeValue('coupon', '654321')).toBe(false);
    expect(canReplaceCodeValue('abc123', '654321')).toBe(false);
  });

  test('allows lettered codes to replace same-length lettered alphanumeric values', () => {
    expect(canReplaceCodeValue('ABCD2', 'KLMN3')).toBe(true);
    expect(canReplaceCodeValue('ab cd2', 'KLMN3')).toBe(true);
  });

  test('rejects lettered codes for numeric-only existing values', () => {
    expect(canReplaceCodeValue('12345', 'KLMN3')).toBe(false);
    expect(canReplaceCodeValue('ABCD', 'KLMN3')).toBe(false);
  });
});
