import { describe, expect, test } from 'vitest';
import {
  canReplaceCodeValue,
  canReplaceWholeCodeValue,
  hasStrongOtpFieldHint,
  isCodeCompatibleWithTextControl,
  isCodeValueEmpty,
  isValidOtpCode,
  normalizeCodeValue
} from '../../src/lib/auth/codePasteSafety';

describe('code paste input validation', () => {
  test('accepts supported OTP-shaped values', () => {
    expect(isValidOtpCode('01234')).toBe(true);
    expect(isValidOtpCode('0123456789')).toBe(true);
    expect(isValidOtpCode('BCDF2')).toBe(true);

    expect(isValidOtpCode('1234')).toBe(false);
    expect(isValidOtpCode('12345678901')).toBe(false);
    expect(isValidOtpCode('123 456')).toBe(false);
    expect(isValidOtpCode('<12345>')).toBe(false);
  });

  test('rejects codes that cannot fit or be represented by a text control', () => {
    expect(isCodeCompatibleWithTextControl('012345', 6, true)).toBe(true);
    expect(isCodeCompatibleWithTextControl('012345', -1, true)).toBe(true);
    expect(isCodeCompatibleWithTextControl('012345', 5, true)).toBe(false);
    expect(isCodeCompatibleWithTextControl('BCDF2', -1, true)).toBe(false);
    expect(isCodeCompatibleWithTextControl('BCDF2', 5, false)).toBe(true);
    expect(isCodeCompatibleWithTextControl('0123456789', 10, true)).toBe(true);
    expect(isCodeCompatibleWithTextControl('0123456789', 9, true)).toBe(false);
    expect(isCodeCompatibleWithTextControl('01234', 0, true)).toBe(false);
  });
});

describe('OTP field hints', () => {
  test('recognizes the reported identifiers only when the field has an OTP shape', () => {
    expect(hasStrongOtpFieldHint('off google_auth_code 验证码', true)).toBe(true);
    expect(hasStrongOtpFieldHint('off googleCode google-code', true)).toBe(true);
    expect(hasStrongOtpFieldHint('googleAuthenticatorCode', true)).toBe(true);
    expect(hasStrongOtpFieldHint('google-authenticator-code', true)).toBe(true);

    expect(hasStrongOtpFieldHint('googleCode', false)).toBe(false);
  });

  test('recognizes compound forms of existing high-confidence hints', () => {
    expect(hasStrongOtpFieldHint('verification_code', false)).toBe(true);
    expect(hasStrongOtpFieldHint('oneTimeCode', false)).toBe(true);
    expect(hasStrongOtpFieldHint('two_factor_code', false)).toBe(true);
    expect(hasStrongOtpFieldHint('totpCode', false)).toBe(true);
  });

  test('preserves existing strong OTP hints', () => {
    for (const hints of [
      'otp',
      'hotp',
      'mfa',
      '2fa',
      'two-factor',
      'one-time',
      'verification',
      'authentication',
      'authenticator',
      'login code',
      'loginCode',
      'passcode'
    ]) {
      expect(hasStrongOtpFieldHint(hints, false), hints).toBe(true);
    }
  });

  test('does not promote unrelated or sensitive compound identifiers', () => {
    for (const hints of [
      'authCode',
      'coupon_code',
      'postalCode',
      'recoveryCode',
      'security_code',
      'sourceCode',
      'otp_secret',
      'mfa_method',
      'authentication_password',
      'googleAuthorizationCode',
      'googleCodeVerifier',
      'googleCouponCode',
      'notgoogleCode'
    ]) {
      expect(hasStrongOtpFieldHint(hints, true), hints).toBe(false);
    }
  });
});

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
