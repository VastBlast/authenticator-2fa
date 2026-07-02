import { canReplaceCodeValue, normalizeCodeValue } from '../lib/auth/codePasteSafety';

type PasteTargetKind = 'single' | 'group' | 'contenteditable';
type EditableElement = HTMLInputElement | HTMLTextAreaElement | HTMLElement;
type TextEditRange = { start: number; end: number };
type ContentEditableEdit = 'all' | Range;

interface MessageResponse {
  ok: boolean;
  pasted?: boolean;
  error?: string;
}

interface PasteTarget {
  element: EditableElement;
  kind: PasteTargetKind;
  group?: HTMLInputElement[];
  otpLike: boolean;
  score: number;
  replace: boolean;
}

const MAX_CODE_LENGTH = 32;
const OTP_SCORE_THRESHOLD = 45;
const STRONG_OTP_PATTERN =
  /\b(?:otp|totp|hotp|mfa|2fa|two[-\s]?factor|one[-\s]?time|verification|authentication|authenticator|security\s+code|login\s+code|passcode)\b/i;
const CODE_PATTERN = /\bcode\b/i;
const codePasterWindow = window as Window & { __twofaCodePasterInstalled?: boolean };

if (!codePasterWindow.__twofaCodePasterInstalled) {
  codePasterWindow.__twofaCodePasterInstalled = true;
  chrome.runtime.onMessage.addListener(handleMessage);
}

function handleMessage(
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void
) {
  const payload = message as { type?: unknown; code?: unknown };

  if (payload.type !== 'code-paste:run') {
    return undefined;
  }

  if (
    typeof payload.code !== 'string' ||
    payload.code.length === 0 ||
    payload.code.length > MAX_CODE_LENGTH
  ) {
    sendResponse({ ok: false, error: 'Paste code is invalid.' });
    return undefined;
  }

  try {
    sendResponse(pasteCode(payload.code));
  } catch {
    sendResponse({ ok: false, error: 'Unable to paste the code.' });
  }
  return undefined;
}

function pasteCode(code: string): MessageResponse {
  const target = findPasteTarget(code);
  if (!target) {
    return { ok: true, pasted: false };
  }

  const pasted = fillTarget(target, code);
  return { ok: true, pasted };
}

function findPasteTarget(code: string): PasteTarget | null {
  const activeElement = getDeepActiveElement();
  const activeTarget = activeElement ? createTarget(activeElement, code, true) : null;
  const safeActiveTarget = activeTarget && canFillTarget(activeTarget, code) ? activeTarget : null;

  if (safeActiveTarget && (safeActiveTarget.otpLike || safeActiveTarget.kind === 'group')) {
    return safeActiveTarget;
  }

  const candidates = collectEditableElements(document)
    .filter((element) => element !== activeElement)
    .map((element) => createTarget(element, code, false))
    .filter((target): target is PasteTarget => Boolean(target))
    .filter((target) => target.otpLike && target.score >= OTP_SCORE_THRESHOLD)
    .filter((target) => canFillTarget(target, code))
    .sort((left, right) => right.score - left.score);

  return candidates[0] ?? safeActiveTarget;
}

function createTarget(element: Element, code: string, active: boolean): PasteTarget | null {
  if (element instanceof HTMLInputElement) {
    return createInputTarget(element, code, active);
  }

  if (element instanceof HTMLTextAreaElement) {
    if (!isVisibleEditable(element)) {
      return null;
    }

    const score = scoreElement(element, code);
    if (score >= OTP_SCORE_THRESHOLD) {
      return { element, kind: 'single', otpLike: true, score, replace: true };
    }

    return active ? { element, kind: 'single', otpLike: false, score, replace: false } : null;
  }

  if (element instanceof HTMLElement && element.isContentEditable && isVisibleEditable(element)) {
    const score = scoreElement(element, code);
    if (score >= OTP_SCORE_THRESHOLD) {
      return { element, kind: 'contenteditable', otpLike: true, score, replace: true };
    }

    return active
      ? { element, kind: 'contenteditable', otpLike: false, score, replace: false }
      : null;
  }

  return null;
}

function createInputTarget(input: HTMLInputElement, code: string, active: boolean): PasteTarget | null {
  if (!isVisibleEditable(input) || !isTextLikeInput(input)) {
    return null;
  }

  const group = findOtpInputGroup(input, code);
  const score = scoreElement(input, code, group);
  const otpLike = score >= OTP_SCORE_THRESHOLD;

  if (group && (active || otpLike)) {
    return {
      element: group[0],
      kind: 'group',
      group,
      otpLike: true,
      score: score + 35,
      replace: true
    };
  }

  if (otpLike) {
    return { element: input, kind: 'single', otpLike, score, replace: true };
  }

  if (active && isSafeActiveInput(input)) {
    return { element: input, kind: 'single', otpLike, score, replace: false };
  }

  return null;
}

function fillTarget(target: PasteTarget, code: string): boolean {
  if (!canFillTarget(target, code)) {
    return false;
  }

  focusElement(target.element);
  if (targetValueIsEmpty(target)) {
    dispatchPasteEvent(target.element, code);
    if (targetContainsCode(target, code)) {
      return true;
    }
  }

  if (target.kind === 'group' && target.group) {
    return fillInputGroup(target.group, code);
  }

  if (target.element instanceof HTMLInputElement || target.element instanceof HTMLTextAreaElement) {
    return fillTextControl(target.element, code, target.replace);
  }

  return fillContentEditable(target.element, code, target.replace);
}

function canFillTarget(target: PasteTarget, code: string): boolean {
  if (target.kind === 'group' && target.group) {
    return canFillInputGroup(target.group, code);
  }

  if (target.element instanceof HTMLInputElement || target.element instanceof HTMLTextAreaElement) {
    return Boolean(getTextControlEditRange(target.element, code, target.replace));
  }

  return Boolean(getContentEditableEdit(target.element, code, target.replace));
}

function canFillInputGroup(group: HTMLInputElement[], code: string): boolean {
  return (
    group.length === Array.from(code).length &&
    canReplaceCodeValue(getInputGroupValue(group), code)
  );
}

function fillInputGroup(group: HTMLInputElement[], code: string): boolean {
  const characters = Array.from(code);
  if (!canFillInputGroup(group, code)) {
    return false;
  }

  for (const [index, character] of characters.entries()) {
    const input = group[index];
    focusElement(input);
    setTextControlValue(input, character);
    dispatchInputEvents(input, character);
  }

  focusElement(group[characters.length - 1]);
  return normalizeCodeValue(getInputGroupValue(group)) === normalizeCodeValue(code);
}

function fillTextControl(
  control: HTMLInputElement | HTMLTextAreaElement,
  code: string,
  replace: boolean
): boolean {
  const currentValue = control.value;
  const editRange = getTextControlEditRange(control, code, replace);
  if (!editRange) {
    return false;
  }

  const { start, end } = editRange;
  const nextValue = `${currentValue.slice(0, start)}${code}${currentValue.slice(end)}`;

  setTextControlValue(control, nextValue);
  setSelection(control, start + code.length);
  dispatchInputEvents(control, code);
  return (
    normalizeCodeValue(control.value) === normalizeCodeValue(code) || control.value.includes(code)
  );
}

function fillContentEditable(element: HTMLElement, code: string, replace: boolean): boolean {
  const edit = getContentEditableEdit(element, code, replace);
  if (!edit) {
    return false;
  }

  if (edit === 'all') {
    element.textContent = code;
  } else {
    const selection = window.getSelection();
    const range = edit;
    range.deleteContents();
    range.insertNode(document.createTextNode(code));
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  dispatchInputEvents(element, code);
  return element.textContent?.includes(code) ?? false;
}

function targetContainsCode(target: PasteTarget, code: string): boolean {
  if (target.kind === 'group' && target.group) {
    const joinedValue = getInputGroupValue(target.group);
    return (
      normalizeCodeValue(joinedValue) === normalizeCodeValue(code) ||
      target.group.some((input) => normalizeCodeValue(input.value) === normalizeCodeValue(code))
    );
  }

  if (target.element instanceof HTMLInputElement || target.element instanceof HTMLTextAreaElement) {
    return target.otpLike
      ? normalizeCodeValue(target.element.value) === normalizeCodeValue(code)
      : target.element.value.includes(code);
  }

  return target.element.textContent?.includes(code) ?? false;
}

function targetValueIsEmpty(target: PasteTarget): boolean {
  if (target.kind === 'group' && target.group) {
    return normalizeCodeValue(getInputGroupValue(target.group)).length === 0;
  }

  if (target.element instanceof HTMLInputElement || target.element instanceof HTMLTextAreaElement) {
    return normalizeCodeValue(target.element.value).length === 0;
  }

  return normalizeCodeValue(target.element.textContent ?? '').length === 0;
}

function collectEditableElements(root: Document | ShadowRoot): EditableElement[] {
  const direct = Array.from(
    root.querySelectorAll<EditableElement>(
      'input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]'
    )
  );
  const shadowRootElements = Array.from(root.querySelectorAll<HTMLElement>('*'))
    .map((element) => element.shadowRoot)
    .filter((shadowRoot): shadowRoot is ShadowRoot => Boolean(shadowRoot))
    .flatMap((shadowRoot) => collectEditableElements(shadowRoot));

  return [...direct, ...shadowRootElements];
}

function getDeepActiveElement(): Element | null {
  let activeElement: Element | null = document.activeElement;
  while (activeElement instanceof HTMLElement && activeElement.shadowRoot?.activeElement) {
    activeElement = activeElement.shadowRoot.activeElement;
  }
  return activeElement;
}

function findOtpInputGroup(input: HTMLInputElement, code: string): HTMLInputElement[] | null {
  for (const container of getGroupContainers(input)) {
    const inputs = Array.from(container.querySelectorAll('input'))
      .filter((item): item is HTMLInputElement => item instanceof HTMLInputElement)
      .filter((item) => isVisibleEditable(item) && isTextLikeInput(item) && isOtpBoxInput(item));

    if (!inputs.includes(input) || inputs.length !== code.length || inputs.length > 12) {
      continue;
    }

    return inputs;
  }

  return null;
}

function getGroupContainers(input: HTMLInputElement): Element[] {
  return Array.from(
    new Set(
      [
        input.closest('fieldset, [role="group"]'),
        input.parentElement,
        input.parentElement?.parentElement,
        input.form
      ].filter((container): container is Element => container instanceof Element)
    )
  );
}

function scoreElement(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLElement,
  code: string,
  group?: HTMLInputElement[] | null
): number {
  const hints = getElementHints(element, group);
  let score = 0;

  if (element instanceof HTMLInputElement && element.autocomplete.toLowerCase() === 'one-time-code') {
    score += 120;
  }
  if (STRONG_OTP_PATTERN.test(hints)) {
    score += 80;
  }
  if (CODE_PATTERN.test(hints) && (group || hasOtpShape(element, code))) {
    // Generic "code" text is a weak signal; coupon and postal fields use it too.
    score += 15;
  }
  if (group) {
    score += 35;
  }
  if (hasOtpShape(element, code)) {
    score += 20;
  }
  if ('value' in element && typeof element.value === 'string' && element.value.trim() === '') {
    score += 5;
  }

  return score;
}

function hasOtpShape(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLElement,
  code: string
): boolean {
  if (!(element instanceof HTMLInputElement)) {
    return false;
  }

  const type = element.type.toLowerCase();
  const maxLength = element.maxLength;
  return (
    ['tel', 'number'].includes(type) ||
    ['numeric', 'decimal', 'tel'].includes(element.inputMode.toLowerCase()) ||
    /\d/.test(element.pattern) ||
    (maxLength >= code.length && maxLength <= Math.max(8, code.length))
  );
}

function getElementHints(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLElement,
  group?: HTMLInputElement[] | null
): string {
  const describedBy = element.getAttribute('aria-describedby') ?? '';
  const describedByText = describedBy
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');
  const labelText =
    element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
      ? Array.from(element.labels ?? []).map((label) => label.textContent ?? '').join(' ')
      : '';
  const nearbyText = (
    group ? getGroupContainers(group[0])[0] : element.closest('label, fieldset, [role="group"]')
  )?.textContent;

  return [
    element.getAttribute('autocomplete'),
    element.getAttribute('name'),
    element.id,
    element.getAttribute('placeholder'),
    element.getAttribute('aria-label'),
    describedByText,
    labelText,
    nearbyText
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 1200);
}

function isOtpBoxInput(input: HTMLInputElement): boolean {
  const placeholder = input.placeholder.trim();
  return (
    (input.maxLength > 0 && input.maxLength <= 2) ||
    (input.size > 0 && input.size <= 2) ||
    /digit|character/i.test(input.getAttribute('aria-label') ?? '') ||
    (placeholder.length > 0 && placeholder.length <= 2)
  );
}

function isTextLikeInput(input: HTMLInputElement): boolean {
  return ['', 'text', 'search', 'tel', 'number', 'password'].includes(input.type.toLowerCase());
}

function isSafeActiveInput(input: HTMLInputElement): boolean {
  return ['', 'text', 'tel', 'number'].includes(input.type.toLowerCase());
}

function isVisibleEditable(element: HTMLElement): boolean {
  if (
    (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) &&
    (element.disabled || element.readOnly)
  ) {
    return false;
  }

  const style = getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    element.getClientRects().length > 0
  );
}

function focusElement(element: HTMLElement): void {
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function dispatchPasteEvent(element: HTMLElement, code: string): void {
  try {
    const data = new DataTransfer();
    data.setData('text/plain', code);
    data.setData('text', code);
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        composed: true,
        clipboardData: data
      })
    );
  } catch {
    // Some browsers do not allow constructing clipboard events with data.
  }
}

function setTextControlValue(control: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype =
    control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setNativeValue = Object.getOwnPropertyDescriptor(prototype, 'value')?.['set'];
  if (setNativeValue) {
    Reflect.apply(setNativeValue, control, [value]);
  } else {
    control.value = value;
  }
}

function setSelection(control: HTMLInputElement | HTMLTextAreaElement, position: number): void {
  try {
    control.setSelectionRange(position, position);
  } catch {
    // Number inputs and some custom controls do not expose text selection.
  }
}

function getInputGroupValue(group: HTMLInputElement[]): string {
  return group.map((input) => input.value).join('');
}

function getTextControlEditRange(
  control: HTMLInputElement | HTMLTextAreaElement,
  code: string,
  replace: boolean
): TextEditRange | null {
  const currentValue = control.value;
  if (canReplaceCodeValue(currentValue, code)) {
    return { start: 0, end: currentValue.length };
  }

  if (replace) {
    return null;
  }

  const selection = getTextSelectionRange(control);
  if (!selection || selection.start === selection.end) {
    return null;
  }

  const selectedValue = currentValue.slice(selection.start, selection.end);
  return canReplaceCodeValue(selectedValue, code) ? selection : null;
}

function getTextSelectionRange(
  control: HTMLInputElement | HTMLTextAreaElement
): TextEditRange | null {
  try {
    const { selectionStart, selectionEnd } = control;
    return typeof selectionStart === 'number' && typeof selectionEnd === 'number'
      ? { start: selectionStart, end: selectionEnd }
      : null;
  } catch {
    return null;
  }
}

function getContentEditableEdit(
  element: HTMLElement,
  code: string,
  replace: boolean
): ContentEditableEdit | null {
  const currentValue = element.textContent ?? '';
  if (canReplaceCodeValue(currentValue, code)) {
    return 'all';
  }

  if (replace) {
    return null;
  }

  const selection = window.getSelection();
  if (!selection?.rangeCount || !selection.anchorNode || !element.contains(selection.anchorNode)) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (range.collapsed) {
    return null;
  }

  return canReplaceCodeValue(range.toString(), code) ? range : null;
}

function dispatchInputEvents(element: HTMLElement, code: string): void {
  let inputEvent: Event;
  try {
    inputEvent = new InputEvent('input', {
      bubbles: true,
      composed: true,
      data: code,
      inputType: 'insertFromPaste'
    });
  } catch {
    inputEvent = new Event('input', { bubbles: true, composed: true });
  }

  element.dispatchEvent(inputEvent);
  element.dispatchEvent(new Event('change', { bubbles: true }));
}
