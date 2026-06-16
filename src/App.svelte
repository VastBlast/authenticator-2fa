<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    ClipboardPaste,
    Download,
    ImageUp,
    KeyRound,
    Pencil,
    Plus,
    QrCode,
    ScanLine,
    Search,
    Trash2,
    Upload,
    X
  } from '@lucide/svelte';
  import AccountForm from './lib/components/auth/AccountForm.svelte';
  import AccountRow from './lib/components/auth/AccountRow.svelte';
  import AppBar from './lib/components/auth/AppBar.svelte';
  import SettingsView from './lib/components/auth/SettingsView.svelte';
  import VaultGate from './lib/components/auth/VaultGate.svelte';
  import { accountToOtpAuthUri } from './lib/auth/otpauth';
  import { decodeQrFiles, renderQrDataUrl } from './lib/auth/qr';
  import type { AccountDraft, AuthenticatorAccount, ImportResult } from './lib/auth/types';
  import { authenticatorVault as vault } from './lib/state/authenticator.svelte';
  import { tr } from './lib/i18n/messages';

  type View = 'codes' | 'settings';
  type AddMode = 'qr' | 'manual' | 'paste';
  type PageScanState = 'idle' | 'starting' | 'waiting';

  interface RuntimeResponse {
    ok?: boolean;
    error?: string;
  }

  interface PageScanCompletedMessage {
    type: 'page-scan:completed';
    ok: boolean;
    message: string;
  }

  interface AccountDragRect {
    id: string;
    top: number;
    height: number;
  }

  interface AccountDragState {
    accountId: string;
    pointerId: number;
    startPointerY: number;
    currentPointerY: number;
    pointerOffsetY: number;
    startIndex: number;
    currentIndex: number;
    itemHeight: number;
    scrollTopAtStart: number;
    itemRects: AccountDragRect[];
  }

  const ADD_MODES: { mode: AddMode; key: 'addQr' | 'addManual' | 'addPaste'; icon: typeof ScanLine }[] = [
    { mode: 'qr', key: 'addQr', icon: ScanLine },
    { mode: 'manual', key: 'addManual', icon: KeyRound },
    { mode: 'paste', key: 'addPaste', icon: ClipboardPaste }
  ];

  let view = $state<View>('codes');
  let query = $state('');
  let dragAccounts = $state.raw<AuthenticatorAccount[] | null>(null);
  let dragState = $state.raw<AccountDragState | null>(null);
  let keyboardDraggingAccountId = $state<string | null>(null);
  let accountListElement = $state<HTMLUListElement | null>(null);
  let scrollContainerElement = $state<HTMLDivElement | null>(null);
  let activeDragHandle: HTMLElement | null = null;
  let autoScrollFrame = 0;
  let previousBodyUserSelect: string | null = null;
  let showAdd = $state(false);
  let addMode = $state<AddMode>('qr');
  let addImportText = $state('');
  let editing = $state<AuthenticatorAccount | null>(null);
  let deleting = $state<AuthenticatorAccount | null>(null);
  let actionsFor = $state<AuthenticatorAccount | null>(null);
  let qrAccount = $state<AuthenticatorAccount | null>(null);
  let qrDataUrl = $state('');
  let formError = $state('');
  let addBusy = $state(false);
  let addStatus = $state('');
  let addError = $state('');
  let pageScanState = $state<PageScanState>('idle');
  let pageScanMessage = $state('');
  let pageScanError = $state('');

  const orderedAccounts = $derived.by(() => dragAccounts ?? vault.sortedAccounts);
  const filteredAccounts = $derived.by(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return orderedAccounts;
    }
    return orderedAccounts.filter(
      (account) =>
        account.label.toLowerCase().includes(needle) || account.issuer.toLowerCase().includes(needle)
    );
  });
  const reorderDisabled = $derived(query.trim().length > 0 || filteredAccounts.length < 2);
  const activeDragAccountId = $derived(dragState?.accountId ?? keyboardDraggingAccountId);
  const pageScanBusy = $derived(pageScanState !== 'idle');

  onMount(() => {
    void initializeApp();
    const timer = window.setInterval(() => void vault.refreshCodes(), 1000);

    const listener = (message: unknown) => {
      if (isPageScanCompleted(message)) {
        void handlePageScanCompleted(message);
      }
    };
    if (hasRuntimeMessaging()) {
      chrome.runtime.onMessage.addListener(listener);
    }

    return () => {
      window.clearInterval(timer);
      if (hasRuntimeMessaging()) {
        chrome.runtime.onMessage.removeListener(listener);
      }
    };
  });
  onDestroy(() => {
    cleanupAccountDrag();
  });

  // Auto-dismiss transient status messages so they never pile up on screen.
  $effect(() => {
    if (!vault.notice) {
      return;
    }
    const id = setTimeout(() => (vault.notice = ''), 2200);
    return () => clearTimeout(id);
  });
  $effect(() => {
    if (!vault.error || vault.locked) {
      return;
    }
    const id = setTimeout(() => (vault.error = ''), 4000);
    return () => clearTimeout(id);
  });

  async function initializeApp() {
    await vault.initialize();
  }

  async function createVault(password: string) {
    await vault.create(password);
  }

  async function unlockVault(password: string) {
    await vault.unlock(password);
  }

  function openAddDialog(mode: AddMode = 'qr') {
    addMode = mode;
    showAdd = true;
    addImportText = '';
    clearAddFeedback();
  }

  function selectAddMode(mode: AddMode) {
    addMode = mode;
    clearAddFeedback();
  }

  function clearAddFeedback() {
    formError = '';
    addStatus = '';
    addError = '';
    pageScanMessage = '';
    pageScanError = '';
  }

  async function saveNewAccount(draft: AccountDraft) {
    await runForm(async () => {
      await vault.addAccount(draft);
      showAdd = false;
    });
  }

  async function saveEditedAccount(draft: AccountDraft) {
    const account = editing;
    if (!account) {
      return;
    }
    await runForm(async () => {
      await vault.updateAccount(account.id, draft);
      editing = null;
    });
  }

  async function runForm(action: () => Promise<void>) {
    formError = '';
    try {
      await action();
    } catch (error) {
      formError = error instanceof Error ? error.message : 'Unable to save account.';
    }
  }

  async function showQr(account: AuthenticatorAccount) {
    qrAccount = account;
    qrDataUrl = await renderQrDataUrl(accountToOtpAuthUri(account));
  }

  async function importAddQrImages(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = Array.from(target.files ?? []);
    target.value = '';
    if (files.length === 0) {
      return;
    }

    await runAddImport(async () => {
      addStatus = 'Reading QR image…';
      const decoded = await decodeQrFiles(files);
      return vault.importText(decoded.join('\n'));
    });
  }

  async function importAddText() {
    if (!addImportText.trim()) {
      addError = 'Paste authenticator text before importing.';
      addStatus = '';
      return;
    }

    await runAddImport(
      async () => vault.importText(addImportText),
      () => (addImportText = '')
    );
  }

  async function runAddImport(action: () => Promise<ImportResult>, afterSuccess?: () => void) {
    addBusy = true;
    addError = '';
    pageScanError = '';
    addStatus = 'Importing account…';
    try {
      const result = await action();
      if (result.imported === 0) {
        addStatus = '';
        addError = getNoImportMessage(result);
        return;
      }

      addStatus = '';
      afterSuccess?.();
      showAdd = false;
      view = 'codes';
    } catch (error) {
      addStatus = '';
      addError = getErrorMessage(error, 'Unable to import QR code.');
    } finally {
      addBusy = false;
    }
  }

  async function startPageScan() {
    showAdd = true;
    addMode = 'qr';
    pageScanMessage = '';
    pageScanError = '';
    addError = '';
    vault.error = '';

    if (!hasRuntimeMessaging()) {
      pageScanError = tr('scanPageUnavailable');
      return;
    }

    pageScanState = 'starting';
    try {
      await sendRuntimeMessage({ type: 'start-page-scan' });
      pageScanState = 'waiting';
      pageScanMessage = '';
      showAdd = false;
      view = 'codes';
      closeExtensionWindow();
    } catch (error) {
      pageScanState = 'idle';
      pageScanError = getErrorMessage(error, tr('scanPageFailed'));
    }
  }

  function closeExtensionWindow(): void {
    if (!/^(chrome|moz)-extension:$/.test(window.location.protocol)) {
      return;
    }

    setTimeout(() => {
      window.close();
    }, 0);
  }

  function hasRuntimeMessaging(): boolean {
    return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.onMessage);
  }

  function sendRuntimeMessage(message: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response: RuntimeResponse | undefined) => {
        const errorMessage = chrome.runtime.lastError?.message;
        if (errorMessage) {
          reject(new Error(errorMessage));
        } else if (response?.ok === false) {
          reject(new Error(response.error ?? tr('scanPageFailed')));
        } else {
          resolve();
        }
      });
    });
  }

  function isPageScanCompleted(message: unknown): message is PageScanCompletedMessage {
    return (
      typeof message === 'object' &&
      message !== null &&
      (message as { type?: unknown }).type === 'page-scan:completed' &&
      typeof (message as { ok?: unknown }).ok === 'boolean' &&
      typeof (message as { message?: unknown }).message === 'string'
    );
  }

  async function handlePageScanCompleted(message: PageScanCompletedMessage) {
    pageScanState = 'idle';
    pageScanMessage = '';
    pageScanError = message.ok ? '' : message.message || tr('scanPageFailed');
    if (!message.ok) {
      vault.error = pageScanError;
      return;
    }

    showAdd = false;
    view = 'codes';
    await vault.initialize();
  }

  function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  function getNoImportMessage(result: ImportResult): string {
    if (result.errors[0]) {
      return result.errors[0];
    }
    if (result.skipped > 0) {
      return 'No new account was imported. It may already exist.';
    }
    return 'No account was found to import.';
  }

  async function deleteSelected() {
    if (!deleting) {
      return;
    }
    await vault.deleteAccount(deleting.id);
    deleting = null;
  }

  function startAccountDrag(account: AuthenticatorAccount, event: PointerEvent) {
    const scrollContainer = scrollContainerElement;
    if (reorderDisabled || !accountListElement || !scrollContainer) {
      return;
    }

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    const rows = getAccountRows();
    const startIndex = rows.findIndex((row) => row.dataset.accountId === account.id);
    const row = rows[startIndex];
    if (!row) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    keyboardDraggingAccountId = null;
    dragAccounts = null;

    const rowRect = row.getBoundingClientRect();
    const scrollRect = scrollContainer.getBoundingClientRect();
    const itemRects = rows.map((item) => {
      const rect = item.getBoundingClientRect();
      return {
        id: item.dataset.accountId ?? '',
        top: rect.top - scrollRect.top + scrollContainer.scrollTop,
        height: rect.height
      };
    });

    activeDragHandle = event.currentTarget as HTMLElement;
    activeDragHandle.setPointerCapture?.(event.pointerId);
    previousBodyUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    dragState = {
      accountId: account.id,
      pointerId: event.pointerId,
      startPointerY: event.clientY,
      currentPointerY: event.clientY,
      pointerOffsetY: event.clientY - rowRect.top,
      startIndex,
      currentIndex: startIndex,
      itemHeight: rowRect.height,
      scrollTopAtStart: scrollContainer.scrollTop,
      itemRects
    };

    window.addEventListener('pointermove', handleAccountDragMove, { passive: false });
    window.addEventListener('pointerup', finishAccountDrag, { passive: false });
    window.addEventListener('pointercancel', cancelAccountDrag);
    startAutoScroll();
  }

  function handleAccountDragMove(event: PointerEvent) {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    event.preventDefault();
    updatePointerDrag(event.clientY);
  }

  function updatePointerDrag(clientY: number) {
    if (!dragState) {
      return;
    }

    const toIndex = getPointerAccountIndex(clientY, dragState);
    dragState = {
      ...dragState,
      currentPointerY: clientY,
      currentIndex: toIndex === -1 ? dragState.currentIndex : toIndex
    };
  }

  function finishAccountDrag(event: PointerEvent) {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    event.preventDefault();
    const state = dragState;
    const accounts =
      state.currentIndex === state.startIndex
        ? null
        : moveAccountInList(vault.sortedAccounts, state.startIndex, state.currentIndex);
    if (accounts) {
      dragAccounts = accounts;
    }
    cleanupPointerDrag();
    if (accounts) {
      void commitAccountOrder(accounts);
    }
  }

  function cancelAccountDrag() {
    cleanupPointerDrag();
  }

  function cleanupAccountDrag() {
    cleanupPointerDrag();
    keyboardDraggingAccountId = null;
    dragAccounts = null;
  }

  function cleanupPointerDrag() {
    const pointerId = dragState?.pointerId;
    window.removeEventListener('pointermove', handleAccountDragMove);
    window.removeEventListener('pointerup', finishAccountDrag);
    window.removeEventListener('pointercancel', cancelAccountDrag);
    if (autoScrollFrame) {
      window.cancelAnimationFrame(autoScrollFrame);
      autoScrollFrame = 0;
    }
    if (
      activeDragHandle &&
      pointerId !== undefined &&
      activeDragHandle.hasPointerCapture?.(pointerId)
    ) {
      activeDragHandle.releasePointerCapture(pointerId);
    }
    if (typeof document !== 'undefined' && previousBodyUserSelect !== null) {
      document.body.style.userSelect = previousBodyUserSelect;
    }
    previousBodyUserSelect = null;
    activeDragHandle = null;
    dragState = null;
  }

  function startAutoScroll() {
    if (autoScrollFrame) {
      window.cancelAnimationFrame(autoScrollFrame);
    }
    autoScrollFrame = window.requestAnimationFrame(runAutoScroll);
  }

  function runAutoScroll() {
    if (!dragState || !scrollContainerElement) {
      autoScrollFrame = 0;
      return;
    }

    const velocity = getAutoScrollVelocity(dragState.currentPointerY);
    if (velocity !== 0) {
      scrollContainerElement.scrollTop += velocity;
      updatePointerDrag(dragState.currentPointerY);
    }

    autoScrollFrame = window.requestAnimationFrame(runAutoScroll);
  }

  function getAutoScrollVelocity(clientY: number): number {
    if (!scrollContainerElement) {
      return 0;
    }

    const rect = scrollContainerElement.getBoundingClientRect();
    const threshold = 56;
    const maxVelocity = 18;
    const topDistance = clientY - rect.top;
    const bottomDistance = rect.bottom - clientY;

    if (topDistance < threshold && scrollContainerElement.scrollTop > 0) {
      return -Math.ceil(Math.min(maxVelocity, ((threshold - topDistance) / threshold) * maxVelocity));
    }

    const maxScrollTop = scrollContainerElement.scrollHeight - scrollContainerElement.clientHeight;
    if (bottomDistance < threshold && scrollContainerElement.scrollTop < maxScrollTop) {
      return Math.ceil(Math.min(maxVelocity, ((threshold - bottomDistance) / threshold) * maxVelocity));
    }

    return 0;
  }

  function handleAccountDragKey(account: AuthenticatorAccount, event: KeyboardEvent) {
    if (reorderDisabled) {
      return;
    }

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();

      if (keyboardDraggingAccountId === account.id) {
        const accounts = dragAccounts;
        keyboardDraggingAccountId = null;
        if (accounts) {
          void commitAccountOrder(accounts);
        }
      } else {
        cleanupPointerDrag();
        keyboardDraggingAccountId = account.id;
        dragAccounts = orderedAccounts;
      }
      return;
    }

    if (event.key === 'Escape' && keyboardDraggingAccountId === account.id) {
      event.preventDefault();
      event.stopPropagation();
      keyboardDraggingAccountId = null;
      dragAccounts = null;
      return;
    }

    if (
      keyboardDraggingAccountId !== account.id ||
      !['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(event.key)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const accounts = dragAccounts ?? orderedAccounts;
    const fromIndex = accounts.findIndex((item) => item.id === account.id);
    const delta = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
    const toIndex = Math.max(0, Math.min(accounts.length - 1, fromIndex + delta));
    if (fromIndex === -1 || fromIndex === toIndex) {
      return;
    }

    dragAccounts = moveAccountInList(accounts, fromIndex, toIndex);
  }

  function handleAccountDragBlur(account: AuthenticatorAccount) {
    if (keyboardDraggingAccountId !== account.id || !dragAccounts) {
      return;
    }

    const accounts = dragAccounts;
    keyboardDraggingAccountId = null;
    void commitAccountOrder(accounts);
  }

  async function commitAccountOrder(accounts: AuthenticatorAccount[]) {
    dragAccounts = accounts;
    try {
      await persistAccountOrder(accounts);
    } finally {
      dragAccounts = null;
    }
  }

  async function persistAccountOrder(accounts: AuthenticatorAccount[]) {
    if (reorderDisabled) {
      return;
    }

    try {
      await vault.reorderAccounts(accounts.map((account) => account.id));
    } catch (error) {
      vault.error = getErrorMessage(error, 'Unable to update account order.');
    }
  }

  function getPointerAccountIndex(clientY: number, state: AccountDragState): number {
    if (!scrollContainerElement || state.itemRects.length === 0) {
      return -1;
    }

    const scrollRect = scrollContainerElement.getBoundingClientRect();
    const draggedCenter =
      clientY -
      scrollRect.top +
      scrollContainerElement.scrollTop -
      state.pointerOffsetY +
      state.itemHeight / 2;

    const downwardSwitchRatio = 0.56;
    const upwardSwitchRatio = 0.44;
    let targetIndex = state.startIndex;

    for (let index = state.startIndex + 1; index < state.itemRects.length; index += 1) {
      const rect = state.itemRects[index];
      if (draggedCenter > rect.top + rect.height * downwardSwitchRatio) {
        targetIndex = index;
      }
    }

    for (let index = state.startIndex - 1; index >= 0; index -= 1) {
      const rect = state.itemRects[index];
      if (draggedCenter < rect.top + rect.height * upwardSwitchRatio) {
        targetIndex = index;
      }
    }

    return targetIndex;
  }

  function getAccountRows(): HTMLElement[] {
    return Array.from(accountListElement?.querySelectorAll<HTMLElement>('[data-account-id]') ?? []);
  }

  function getAccountDragStyle(account: AuthenticatorAccount): string {
    if (!dragState) {
      return '';
    }

    const index = dragState.itemRects.findIndex((rect) => rect.id === account.id);
    if (index === -1) {
      return '';
    }

    if (account.id === dragState.accountId) {
      const scrollDelta =
        (scrollContainerElement?.scrollTop ?? dragState.scrollTopAtStart) - dragState.scrollTopAtStart;
      const offset = dragState.currentPointerY - dragState.startPointerY + scrollDelta;
      return `position: relative; z-index: 30; transform: translate3d(0, ${offset}px, 0); transition: none; will-change: transform;`;
    }

    const offset = getDisplacedAccountOffset(index, dragState);
    return `transform: translate3d(0, ${offset}px, 0); transition: transform 150ms cubic-bezier(0.2, 0, 0, 1); will-change: transform;`;
  }

  function getDisplacedAccountOffset(index: number, state: AccountDragState): number {
    if (state.currentIndex > state.startIndex && index > state.startIndex && index <= state.currentIndex) {
      return -state.itemHeight;
    }
    if (state.currentIndex < state.startIndex && index >= state.currentIndex && index < state.startIndex) {
      return state.itemHeight;
    }
    return 0;
  }

  function moveAccountInList(
    accounts: AuthenticatorAccount[],
    fromIndex: number,
    toIndex: number
  ): AuthenticatorAccount[] {
    const next = [...accounts];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  }

  function accountTitle(account: AuthenticatorAccount): string {
    return account.issuer ? `${account.issuer} · ${account.label}` : account.label;
  }
</script>

<svelte:head>
  <title>{tr('appName')}</title>
</svelte:head>

<div class="contents" data-theme={vault.settings.theme}>
<main
  class="relative flex h-(--auth-popup-height) w-(--auth-popup-width) flex-col overflow-hidden bg-base-100 text-base-content"
>
  {#if !vault.initialized}
    <div class="grid h-full place-items-center">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
  {:else if vault.locked}
    <VaultGate hasVault={vault.hasVault} busy={vault.busy} oncreate={createVault} onunlock={unlockVault} />
    {#if vault.error}
      <p class="px-6 pb-4 text-center text-sm text-error" role="alert">{vault.error}</p>
    {/if}
    {#if pageScanError}
      <p class="px-6 pb-4 text-center text-sm text-error" role="alert">{pageScanError}</p>
    {/if}
  {:else if view === 'settings'}
    <SettingsView onback={() => (view = 'codes')} />
  {:else}
    <AppBar onsettings={() => (view = 'settings')} />

    <div class="flex grow flex-col overflow-y-auto pb-20" bind:this={scrollContainerElement}>
      {#if vault.accounts.length > 0}
        <div class="sticky top-0 z-10 bg-base-100/95 px-3 py-2 backdrop-blur">
          <label class="input input-sm w-full items-center gap-2">
            <Search class="shrink-0 text-base-content/45" size={16} aria-hidden="true" />
            <input class="grow" type="search" placeholder={tr('search')} bind:value={query} />
          </label>
        </div>
      {/if}

      {#if filteredAccounts.length > 0}
        <ul
          class="divide-y divide-base-200"
          aria-label={tr('reorderAccounts')}
          bind:this={accountListElement}
        >
          {#each filteredAccounts as account (account.id)}
            <AccountRow
              {account}
              code={vault.codes[account.id]}
              reorderDisabled={reorderDisabled}
              dragging={activeDragAccountId === account.id}
              dragStyle={getAccountDragStyle(account)}
              onactions={(item) => (actionsFor = item)}
              onreorderstart={startAccountDrag}
              onreorderkey={handleAccountDragKey}
              onreorderblur={handleAccountDragBlur}
            />
          {/each}
        </ul>
      {:else if vault.accounts.length === 0}
        <div class="grid grow place-items-center p-8 text-center">
          <div class="grid justify-items-center gap-3">
            <div class="grid size-16 place-items-center rounded-2xl bg-base-200 text-base-content/40">
              <KeyRound size={30} aria-hidden="true" />
            </div>
            <div class="grid gap-1">
              <p class="text-base font-semibold">{tr('empty')}</p>
              <p class="max-w-60 text-sm text-base-content/60">{tr('emptyHint')}</p>
            </div>
            <button class="btn btn-primary btn-sm mt-1" type="button" onclick={() => openAddDialog('qr')}>
              <Plus size={16} aria-hidden="true" />
              {tr('addAccount')}
            </button>
          </div>
        </div>
      {:else}
        <p class="p-8 text-center text-sm text-base-content/55">{tr('noResults')}</p>
      {/if}
    </div>

    {#if vault.accounts.length > 0}
      <button
        class="btn btn-circle btn-primary btn-lg absolute bottom-4 right-4 z-20 shadow-lg"
        type="button"
        aria-label={tr('addAccount')}
        title={tr('addAccount')}
        onclick={() => openAddDialog('qr')}
      >
        <Plus size={24} aria-hidden="true" />
      </button>
    {/if}

    <!-- Transient feedback -->
    <div class="toast toast-center toast-bottom z-30 mb-2">
      {#if vault.error}
        <div class="alert alert-error py-2 text-sm shadow-md" role="alert">{vault.error}</div>
      {:else if vault.notice}
        <div class="alert alert-success py-2 text-sm shadow-md" role="status">{vault.notice}</div>
      {/if}
    </div>
  {/if}
</main>

<!-- Per-account actions sheet -->
{#if actionsFor}
  {@const account = actionsFor}
  <dialog class="modal modal-bottom modal-open sm:modal-middle" open>
    <div class="modal-box p-0">
      <div class="border-b border-base-200 px-4 py-3">
        <p class="truncate font-semibold">{accountTitle(account)}</p>
      </div>
      <ul class="menu w-full gap-0.5 p-2 text-base">
        <li>
          <button type="button" onclick={() => { void showQr(account); actionsFor = null; }}>
            <QrCode size={18} aria-hidden="true" />{tr('showQr')}
          </button>
        </li>
        <li>
          <button type="button" onclick={() => { editing = account; actionsFor = null; }}>
            <Pencil size={18} aria-hidden="true" />{tr('edit')}
          </button>
        </li>
        <li>
          <button class="text-error" type="button" onclick={() => { deleting = account; actionsFor = null; }}>
            <Trash2 size={18} aria-hidden="true" />{tr('delete')}
          </button>
        </li>
      </ul>
    </div>
    <button class="modal-backdrop" type="button" onclick={() => (actionsFor = null)}>close</button>
  </dialog>
{/if}

<!-- Add account -->
{#if showAdd}
  <dialog class="modal modal-open" open>
    <div class="modal-box max-h-[88dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto p-4">
      <div class="mb-3 flex items-center justify-between gap-2">
        <h2 class="text-lg font-bold">{tr('addAccount')}</h2>
        <button class="btn btn-ghost btn-sm btn-circle" type="button" aria-label={tr('cancel')} onclick={() => (showAdd = false)}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div class="join w-full">
        {#each ADD_MODES as item (item.mode)}
          {@const Icon = item.icon}
          <button
            class={['btn join-item flex-1 btn-sm px-1', addMode === item.mode ? 'btn-primary' : '']}
            type="button"
            onclick={() => selectAddMode(item.mode)}
          >
            <Icon size={15} aria-hidden="true" />
            <span class="truncate">{tr(item.key)}</span>
          </button>
        {/each}
      </div>

      {#if addMode === 'qr'}
        <div class="mt-4 grid gap-3">
          <p class="text-sm leading-snug text-base-content/60">{tr('addQrDescription')}</p>

          <button class="btn btn-primary btn-block" type="button" onclick={startPageScan} disabled={pageScanBusy || addBusy}>
            <ScanLine size={16} aria-hidden="true" />
            {pageScanState === 'starting' ? tr('scanPage') : tr('scanPageStart')}
          </button>

          <label class="grid gap-1 text-sm font-medium">
            <span class="flex items-center gap-2">
              <ImageUp size={16} aria-hidden="true" />
              {tr('qrImage')}
            </span>
            <input class="file-input file-input-sm w-full" type="file" accept="image/*" disabled={addBusy} onchange={importAddQrImages} />
          </label>

          {#if pageScanMessage}
            <div class="alert alert-info py-2 text-sm" role="status">{pageScanMessage}</div>
          {/if}
          {#if pageScanError}
            <div class="alert alert-error py-2 text-sm" role="alert">{pageScanError}</div>
          {/if}
          {#if addStatus}
            <div class="alert alert-info py-2 text-sm" role="status">{addStatus}</div>
          {/if}
          {#if addError}
            <div class="alert alert-error py-2 text-sm" role="alert">{addError}</div>
          {/if}
        </div>
      {:else if addMode === 'manual'}
        {#if formError}
          <div class="alert alert-error my-3 py-2 text-sm" role="alert">{formError}</div>
        {/if}
        <div class="mt-4">
          <AccountForm onsubmit={saveNewAccount} oncancel={() => (showAdd = false)} />
        </div>
      {:else}
        <div class="mt-4 grid gap-3">
          <p class="text-sm leading-snug text-base-content/60">{tr('addPasteDescription')}</p>

          <textarea
            class="textarea min-h-32 w-full font-mono text-sm leading-relaxed"
            bind:value={addImportText}
            placeholder="otpauth://totp/..."
            spellcheck="false"
          ></textarea>

          <button class="btn btn-primary btn-block" type="button" onclick={importAddText} disabled={addBusy || !addImportText.trim()}>
            {#if addBusy}
              <span class="loading loading-spinner loading-sm"></span>
            {:else}
              <Upload size={16} aria-hidden="true" />
            {/if}
            {tr('import')}
          </button>

          {#if addStatus}
            <div class="alert alert-info py-2 text-sm" role="status">{addStatus}</div>
          {/if}
          {#if addError}
            <div class="alert alert-error py-2 text-sm" role="alert">{addError}</div>
          {/if}
        </div>
      {/if}
    </div>
    <button class="modal-backdrop" type="button" onclick={() => (showAdd = false)}>close</button>
  </dialog>
{/if}

<!-- Edit account -->
{#if editing}
  <dialog class="modal modal-open" open>
    <div class="modal-box max-h-[88dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto p-4">
      <h2 class="mb-3 text-lg font-bold">{tr('editAccount')}</h2>
      {#if formError}
        <div class="alert alert-error mb-3 py-2 text-sm" role="alert">{formError}</div>
      {/if}
      <AccountForm initial={editing} onsubmit={saveEditedAccount} oncancel={() => (editing = null)} />
    </div>
    <button class="modal-backdrop" type="button" onclick={() => (editing = null)}>close</button>
  </dialog>
{/if}

<!-- Delete confirmation -->
{#if deleting}
  <dialog class="modal modal-open" open>
    <div class="modal-box w-[calc(100vw-1.5rem)] max-w-sm p-4">
      <h2 class="text-lg font-bold">{tr('delete')}</h2>
      <p class="mt-2 break-words text-sm text-base-content/70">{accountTitle(deleting)}</p>
      <div class="modal-action grid grid-cols-2 gap-2">
        <button class="btn" type="button" onclick={() => (deleting = null)}>{tr('cancel')}</button>
        <button class="btn btn-error" type="button" onclick={deleteSelected}>{tr('delete')}</button>
      </div>
    </div>
    <button class="modal-backdrop" type="button" onclick={() => (deleting = null)}>close</button>
  </dialog>
{/if}

<!-- QR display -->
{#if qrAccount}
  <dialog class="modal modal-open" open>
    <div class="modal-box grid w-[calc(100vw-1.5rem)] max-w-sm justify-items-center gap-3 p-4 text-center">
      <h2 class="text-lg font-bold">{tr('showQr')}</h2>
      <p class="wrap-break-word text-sm text-base-content/70">{accountTitle(qrAccount)}</p>
      {#if qrDataUrl}
        <img class="w-full max-w-64 rounded-box border border-base-300 bg-white p-2" src={qrDataUrl} alt={tr('showQr')} />
        <a class="btn btn-block" href={qrDataUrl} download={`${qrAccount.label || 'account'}-qr.png`}>
          <Download size={16} aria-hidden="true" />
          QR
        </a>
      {/if}
      <div class="modal-action mt-0 w-full">
        <button class="btn btn-primary btn-block" type="button" onclick={() => (qrAccount = null)}>{tr('cancel')}</button>
      </div>
    </div>
    <button class="modal-backdrop" type="button" onclick={() => (qrAccount = null)}>close</button>
  </dialog>
{/if}
</div>
