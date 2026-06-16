<script lang="ts">
  import { onMount } from 'svelte';
  import { ArrowLeftRight, CirclePlus, Download, KeyRound, LockKeyhole, Search, Settings } from '@lucide/svelte';
  import AccountCard from './lib/components/auth/AccountCard.svelte';
  import AccountForm from './lib/components/auth/AccountForm.svelte';
  import CameraScanner from './lib/components/auth/CameraScanner.svelte';
  import ImportExportPanel from './lib/components/auth/ImportExportPanel.svelte';
  import VaultGate from './lib/components/auth/VaultGate.svelte';
  import { accountToOtpAuthUri } from './lib/auth/otpauth';
  import { decodeQrDataUrl, renderQrDataUrl } from './lib/auth/qr';
  import type { AccountDraft, AuthenticatorAccount } from './lib/auth/types';
  import { authenticatorVault as vault } from './lib/state/authenticator.svelte';
  import { LANGUAGES, t, type MessageKey } from './lib/i18n/messages';

  type View = 'codes' | 'transfer' | 'settings';
  type PageScanState = 'idle' | 'starting' | 'waiting';

  interface RuntimeResponse {
    ok?: boolean;
    error?: string;
  }

  let view = $state<View>('codes');
  let query = $state('');
  let showAdd = $state(false);
  let editing = $state<AuthenticatorAccount | null>(null);
  let deleting = $state<AuthenticatorAccount | null>(null);
  let qrAccount = $state<AuthenticatorAccount | null>(null);
  let qrDataUrl = $state('');
  let formError = $state('');
  let pageScanState = $state<PageScanState>('idle');
  let pageScanMessage = $state('');
  let pageScanError = $state('');

  const tr = (key: MessageKey) => t(vault.settings.language, key);
  const filteredAccounts = $derived(
    vault.sortedAccounts.filter((account) => {
      const needle = query.trim().toLowerCase();
      return (
        !needle ||
        account.label.toLowerCase().includes(needle) ||
        account.issuer.toLowerCase().includes(needle)
      );
    })
  );
  const pageScanBusy = $derived(pageScanState !== 'idle');

  onMount(() => {
    void vault.initialize();
    const timer = window.setInterval(() => {
      void vault.refreshCodes();
    }, 1000);

    const listener = (message: unknown) => {
      if (isPageScanReady(message)) {
        void importPageScan(message.dataUrl);
      } else if (isPageScanFailed(message)) {
        handlePageScanFailure(message.message);
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

  async function copyCode(account: AuthenticatorAccount, code: string) {
    const value = vault.settings.copyWithSpaces ? code.replace(/(\d{3})(?=\d)/g, '$1 ').trim() : code;
    await navigator.clipboard.writeText(value);
    vault.notice = `${account.label} copied.`;
  }

  async function showQr(account: AuthenticatorAccount) {
    qrAccount = account;
    qrDataUrl = await renderQrDataUrl(accountToOtpAuthUri(account));
  }

  async function applyImportText(text: string) {
    return vault.importText(text);
  }

  async function applyCameraImport(text: string) {
    await vault.importText(text);
    view = 'codes';
  }

  async function startPageScan() {
    pageScanMessage = '';
    pageScanError = '';
    vault.error = '';

    if (!hasRuntimeMessaging()) {
      pageScanError = tr('scanPageUnavailable');
      return;
    }

    pageScanState = 'starting';
    try {
      await sendRuntimeMessage({ type: 'start-page-scan' });
      pageScanState = 'waiting';
      pageScanMessage = tr('scanPageWaiting');
    } catch (error) {
      pageScanState = 'idle';
      pageScanError = getErrorMessage(error, tr('scanPageFailed'));
    }
  }

  async function importPageScan(dataUrl: string) {
    pageScanState = 'idle';
    pageScanMessage = '';
    pageScanError = '';

    if (vault.locked) {
      pageScanError = 'Unlock the vault before importing a page scan.';
      return;
    }

    let text = '';
    try {
      text = await decodeQrDataUrl(dataUrl);
    } catch {
      pageScanError = tr('scanPageNoQr');
      view = 'transfer';
      return;
    }

    try {
      const result = await vault.importText(text);
      if (result.imported === 0) {
        pageScanError = tr('scanPageNoQr');
        view = 'transfer';
        return;
      }
      view = 'codes';
    } catch (error) {
      pageScanError = getErrorMessage(error, tr('scanPageFailed'));
      view = 'transfer';
    }
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

  function isPageScanReady(message: unknown): message is { type: 'page-scan:ready'; dataUrl: string } {
    return (
      typeof message === 'object' &&
      message !== null &&
      (message as { type?: unknown }).type === 'page-scan:ready' &&
      typeof (message as { dataUrl?: unknown }).dataUrl === 'string'
    );
  }

  function isPageScanFailed(message: unknown): message is { type: 'page-scan:failed'; message: string } {
    return (
      typeof message === 'object' &&
      message !== null &&
      (message as { type?: unknown }).type === 'page-scan:failed' &&
      typeof (message as { message?: unknown }).message === 'string'
    );
  }

  function handlePageScanFailure(message: string) {
    pageScanState = 'idle';
    pageScanMessage = '';
    pageScanError = message || tr('scanPageFailed');
    view = 'transfer';
  }

  function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  async function deleteSelected() {
    if (!deleting) {
      return;
    }
    await vault.deleteAccount(deleting.id);
    deleting = null;
  }

  async function updateLanguage(event: Event) {
    const language = (event.target as HTMLSelectElement).value;
    await vault.replaceSettings({ ...vault.settings, language });
  }

  async function updateTheme(event: Event) {
    const theme = (event.target as HTMLSelectElement).value === 'dark' ? 'dark' : 'light';
    await vault.replaceSettings({ ...vault.settings, theme });
  }

  async function updateCopySpacing(event: Event) {
    await vault.replaceSettings({
      ...vault.settings,
      copyWithSpaces: (event.target as HTMLInputElement).checked
    });
  }
</script>

<svelte:head>
  <title>{tr('appName')}</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh w-[430px] flex-col gap-3 bg-base-100 p-3 text-base-content" data-theme={vault.settings.theme}>
  {#if !vault.initialized}
    <div class="grid min-h-dvh place-items-center">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if vault.locked}
    <VaultGate
      hasVault={vault.hasVault}
      busy={vault.busy}
      tr={tr}
      oncreate={(password) => vault.create(password)}
      onunlock={(password) => vault.unlock(password)}
    />
    {#if vault.error}
      <div class="alert alert-error py-2 text-sm" role="alert">{vault.error}</div>
    {/if}
    {#if pageScanError}
      <div class="alert alert-error py-2 text-sm" role="alert">{pageScanError}</div>
    {/if}
  {:else}
    <header class="flex min-w-0 items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="mb-0.5 text-xs font-bold uppercase leading-none text-base-content/60">{tr('appName')}</p>
        <h1 class="truncate text-xl font-bold leading-tight">{tr('appName')}</h1>
      </div>
      <button class="btn btn-ghost btn-sm shrink-0" type="button" onclick={() => vault.lock()}>
        <LockKeyhole size={16} aria-hidden="true" />
        {tr('lock')}
      </button>
    </header>

    {#if vault.notice}
      <div class="alert alert-success py-2 text-sm" role="status">{vault.notice}</div>
    {/if}
    {#if vault.error}
      <div class="alert alert-error py-2 text-sm" role="alert">{vault.error}</div>
    {/if}

    <nav class="grid grid-cols-3 gap-1 rounded-box bg-base-200 p-1" aria-label="Primary">
      <button class={['btn btn-sm min-w-0 px-2', view === 'codes' ? 'btn-primary' : 'btn-ghost']} type="button" onclick={() => (view = 'codes')}>
        <KeyRound size={16} aria-hidden="true" />
        <span class="truncate">{tr('accounts')}</span>
      </button>
      <button class={['btn btn-sm min-w-0 px-2', view === 'transfer' ? 'btn-primary' : 'btn-ghost']} type="button" onclick={() => (view = 'transfer')}>
        <ArrowLeftRight size={16} aria-hidden="true" />
        <span class="truncate">{tr('transfer')}</span>
      </button>
      <button class={['btn btn-sm min-w-0 px-2', view === 'settings' ? 'btn-primary' : 'btn-ghost']} type="button" onclick={() => (view = 'settings')}>
        <Settings size={16} aria-hidden="true" />
        <span class="truncate">{tr('settings')}</span>
      </button>
    </nav>

    {#if view === 'codes'}
      <section class="flex min-w-0 flex-col gap-3">
        <div class="grid grid-cols-1 gap-2 min-[420px]:grid-cols-[minmax(0,1fr)_auto]">
          <label class="input input-sm flex w-full min-w-0 items-center gap-2">
            <Search class="shrink-0 text-base-content/55" size={17} aria-hidden="true" />
            <input class="min-w-0 grow" type="search" placeholder={tr('search')} bind:value={query} />
          </label>
          <button class="btn btn-primary btn-sm w-full min-[420px]:w-auto" type="button" onclick={() => (showAdd = true)}>
            <CirclePlus size={16} aria-hidden="true" />
            {tr('addAccount')}
          </button>
        </div>

        <div class="flex min-w-0 flex-col gap-2">
          {#each filteredAccounts as account (account.id)}
            <AccountCard
              {account}
              code={vault.codes[account.id]}
              copyWithSpaces={vault.settings.copyWithSpaces}
              tr={tr}
              oncopy={copyCode}
              onnext={(item) => vault.advanceHotp(item.id)}
              onedit={(item) => (editing = item)}
              ondelete={(item) => (deleting = item)}
              onpin={(item) => vault.togglePinned(item.id)}
              onqr={showQr}
            />
          {:else}
            <div class="rounded-box border border-dashed border-base-300 p-8 text-center text-sm text-base-content/65">{tr('empty')}</div>
          {/each}
        </div>
      </section>
    {:else if view === 'transfer'}
      <div class="flex min-w-0 flex-col gap-3">
        <section class="rounded-box border border-base-300 bg-base-100 p-3 shadow-sm">
          <div class="mb-3 min-w-0">
            <h2 class="text-base font-bold leading-tight">{tr('scanPage')}</h2>
            <p class="mt-1 text-sm leading-snug text-base-content/65">{tr('scanPageWaiting')}</p>
          </div>

          {#if pageScanError}
            <div class="alert alert-error mb-3 py-2 text-sm" role="alert">{pageScanError}</div>
          {:else if pageScanMessage}
            <div class="alert alert-info mb-3 py-2 text-sm" role="status">{pageScanMessage}</div>
          {/if}

          <button class="btn btn-primary btn-block" type="button" onclick={startPageScan} disabled={pageScanBusy}>
            <Search size={16} aria-hidden="true" />
            {pageScanState === 'starting' ? tr('scanPage') : tr('scanPageStart')}
          </button>
        </section>

        <ImportExportPanel
          accounts={vault.accounts}
          settings={vault.settings}
          tr={tr}
          onimport={applyImportText}
          onimportencrypted={(text, password) => vault.importEncryptedBackupText(text, password)}
        />

        <section class="rounded-box border border-base-300 bg-base-100 p-3 shadow-sm">
          <div class="mb-3">
            <h2 class="text-base font-bold leading-tight">{tr('camera')}</h2>
          </div>
          <CameraScanner tr={tr} onscan={applyCameraImport} />
        </section>
      </div>
    {:else}
      <div class="flex min-w-0 flex-col gap-3">
        <section class="rounded-box border border-base-300 bg-base-100 p-3 shadow-sm">
          <div class="mb-3">
            <h2 class="text-base font-bold leading-tight">{tr('appearance')}</h2>
          </div>

          <div class="grid gap-3">
            <label class="grid gap-1.5 text-sm font-semibold">
              <span>{tr('language')}</span>
              <select class="select" value={vault.settings.language} onchange={updateLanguage}>
                {#each LANGUAGES as language (language.code)}
                  <option value={language.code}>{language.label}</option>
                {/each}
              </select>
            </label>

            <label class="grid gap-1.5 text-sm font-semibold">
              <span>{tr('theme')}</span>
              <select class="select" value={vault.settings.theme} onchange={updateTheme}>
                <option value="light">{tr('light')}</option>
                <option value="dark">{tr('dark')}</option>
              </select>
            </label>
          </div>
        </section>

        <section class="rounded-box border border-base-300 bg-base-100 p-3 shadow-sm">
          <div class="mb-3">
            <h2 class="text-base font-bold leading-tight">{tr('preferences')}</h2>
          </div>

          <label class="flex min-w-0 items-center justify-between gap-3">
            <span class="grid min-w-0 gap-0.5">
              <strong class="truncate text-sm">{tr('codeDisplay')}</strong>
              <small class="text-sm leading-snug text-base-content/65">{tr('copyWithSpaces')}</small>
            </span>
            <input class="toggle shrink-0" type="checkbox" checked={vault.settings.copyWithSpaces} onchange={updateCopySpacing} />
          </label>
        </section>
      </div>
    {/if}
  {/if}
</main>

{#if showAdd}
  <dialog class="modal modal-open" open>
    <div class="modal-box max-h-[88dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto p-4">
      <h2 class="mb-3 text-lg font-bold leading-tight">{tr('addAccount')}</h2>
      {#if formError}
        <div class="alert alert-error mb-3 py-2 text-sm" role="alert">{formError}</div>
      {/if}
      <AccountForm tr={tr} onsubmit={saveNewAccount} oncancel={() => (showAdd = false)} />
    </div>
    <button class="modal-backdrop" type="button" onclick={() => (showAdd = false)}>close</button>
  </dialog>
{/if}

{#if editing}
  <dialog class="modal modal-open" open>
    <div class="modal-box max-h-[88dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto p-4">
      <h2 class="mb-3 text-lg font-bold leading-tight">{tr('editAccount')}</h2>
      {#if formError}
        <div class="alert alert-error mb-3 py-2 text-sm" role="alert">{formError}</div>
      {/if}
      <AccountForm initial={editing} tr={tr} onsubmit={saveEditedAccount} oncancel={() => (editing = null)} />
    </div>
    <button class="modal-backdrop" type="button" onclick={() => (editing = null)}>close</button>
  </dialog>
{/if}

{#if deleting}
  <dialog class="modal modal-open" open>
    <div class="modal-box w-[calc(100vw-1.5rem)] max-w-sm p-4">
      <h2 class="text-lg font-bold leading-tight">{tr('delete')}</h2>
      <p class="mt-2 break-words text-sm text-base-content/70">{deleting.issuer ? `${deleting.issuer} - ` : ''}{deleting.label}</p>
      <div class="modal-action grid grid-cols-2 gap-2">
        <button class="btn" type="button" onclick={() => (deleting = null)}>{tr('cancel')}</button>
        <button class="btn btn-error" type="button" onclick={deleteSelected}>{tr('delete')}</button>
      </div>
    </div>
    <button class="modal-backdrop" type="button" onclick={() => (deleting = null)}>close</button>
  </dialog>
{/if}

{#if qrAccount}
  <dialog class="modal modal-open" open>
    <div class="modal-box grid w-[calc(100vw-1.5rem)] max-w-sm justify-items-center gap-3 p-4 text-center">
      <h2 class="text-lg font-bold leading-tight">{tr('showQr')}</h2>
      <p class="break-words text-sm text-base-content/70">{qrAccount.issuer ? `${qrAccount.issuer} - ` : ''}{qrAccount.label}</p>
      {#if qrDataUrl}
        <img class="w-full max-w-64 rounded-box border border-base-300 bg-white p-2" src={qrDataUrl} alt={tr('showQr')} />
        <a class="btn btn-block" href={qrDataUrl} download={`${qrAccount.label || 'account'}-qr.png`}>
          <Download size={16} aria-hidden="true" />
          QR
        </a>
      {/if}
      <div class="modal-action mt-0 w-full">
        <button class="btn btn-primary" type="button" onclick={() => (qrAccount = null)}>{tr('cancel')}</button>
      </div>
    </div>
    <button class="modal-backdrop" type="button" onclick={() => (qrAccount = null)}>close</button>
  </dialog>
{/if}
