const NUMERIC_CODE_PATTERN = /^\d+$/;
const ALPHANUMERIC_CODE_PATTERN = /^[a-z0-9]+$/i;
const LETTER_PATTERN = /[a-z]/i;

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
