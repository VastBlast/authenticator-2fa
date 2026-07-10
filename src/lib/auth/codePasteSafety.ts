const NUMERIC_CODE_PATTERN = /^\d+$/;
const ALPHANUMERIC_CODE_PATTERN = /^[a-z0-9]+$/i;
const LETTER_PATTERN = /[a-z]/i;
const OTP_CODE_PATTERN = /^[a-z0-9]{5,10}$/i;
const STRONG_OTP_HINT_PATTERN =
  /\b(?:(?:otp|totp|hotp|mfa|2fa|two[-_\s]?factor|one[-_\s]?time|verification|authentication|authenticator)(?:[-_\s]*code)?|login[-_\s]*code|passcode)\b/i;
// Legacy forms often use googleCode-style identifiers without standard OTP autocomplete metadata.
const AUTHENTICATOR_PROVIDER_CODE_PATTERN =
  /\bgoogle(?:[-_\s]*auth(?:entication|enticator)?)?[-_\s]*code\b/i;

export function isValidOtpCode(value: string): boolean {
  return OTP_CODE_PATTERN.test(value);
}

export function hasStrongOtpFieldHint(hints: string, otpShaped: boolean): boolean {
  return (
    STRONG_OTP_HINT_PATTERN.test(hints) ||
    (otpShaped && AUTHENTICATOR_PROVIDER_CODE_PATTERN.test(hints))
  );
}

export function isCodeCompatibleWithTextControl(
  code: string,
  maxLength: number,
  numericOnly: boolean
): boolean {
  return (
    (maxLength < 0 || code.length <= maxLength) &&
    (!numericOnly || NUMERIC_CODE_PATTERN.test(code))
  );
}

export function normalizeCodeValue(value: string): string {
  return value.replace(/\s+/g, '');
}

export function isCodeValueEmpty(value: string): boolean {
  return normalizeCodeValue(value).length === 0;
}

export function canReplaceWholeCodeValue(
  currentValue: string,
  code: string,
  replace: boolean
): boolean {
  return isCodeValueEmpty(currentValue) || (replace && canReplaceCodeValue(currentValue, code));
}

export function canReplaceCodeValue(currentValue: string, code: string): boolean {
  const current = normalizeCodeValue(currentValue);
  const next = normalizeCodeValue(code);

  if (current.length === 0) {
    return true;
  }

  if (next.length === 0 || current.length !== next.length) {
    return false;
  }

  if (NUMERIC_CODE_PATTERN.test(next)) {
    return NUMERIC_CODE_PATTERN.test(current);
  }

  if (ALPHANUMERIC_CODE_PATTERN.test(next)) {
    return (
      ALPHANUMERIC_CODE_PATTERN.test(current) &&
      (!LETTER_PATTERN.test(next) || LETTER_PATTERN.test(current))
    );
  }

  return false;
}
