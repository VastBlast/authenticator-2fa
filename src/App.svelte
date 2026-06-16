<script lang="ts">
  import { onMount } from 'svelte';
  import { CirclePlus, Download, LockKeyhole, Search, Settings, Upload } from '@lucide/svelte';
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

  let view = $state<View>('codes');
  let query = $state('');
  let showAdd = $state(false);
  let editing = $state<AuthenticatorAccount | null>(null);
  let deleting = $state<AuthenticatorAccount | null>(null);
  let qrAccount = $state<AuthenticatorAccount | null>(null);
  let qrDataUrl = $state('');
  let formError = $state('');

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

  onMount(() => {
    void vault.initialize();
    const timer = window.setInterval(() => {
      void vault.refreshCodes();
    }, 1000);

    const listener = (message: unknown) => {
      if (isPageScanReady(message)) {
        void importPageScan(message.dataUrl);
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
    if (!hasRuntimeMessaging()) {
      vault.error = tr('cameraUnavailable');
      return;
    }
    await sendRuntimeMessage({ type: 'start-page-scan' });
  }

  async function importPageScan(dataUrl: string) {
    const text = await decodeQrDataUrl(dataUrl);
    await vault.importText(text);
    view = 'codes';
  }

  function hasRuntimeMessaging(): boolean {
    return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.onMessage);
  }

  function sendRuntimeMessage(message: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, () => {
        const errorMessage = chrome.runtime.lastError?.message;
        if (errorMessage) {
          reject(new Error(errorMessage));
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

<main class="app-shell" data-theme={vault.settings.theme}>
  {#if !vault.initialized}
    <div class="loading-screen">
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
  {:else}
    <header class="topbar">
      <div>
        <p class="eyebrow">{tr('appName')}</p>
        <h1>{tr('appName')}</h1>
      </div>
      <button class="btn btn-ghost btn-sm" type="button" onclick={() => vault.lock()}>
        <LockKeyhole size={16} aria-hidden="true" />
        {tr('lock')}
      </button>
    </header>

    {#if vault.notice}
      <div class="alert alert-success" role="status">{vault.notice}</div>
    {/if}
    {#if vault.error}
      <div class="alert alert-error" role="alert">{vault.error}</div>
    {/if}

    <nav class="segmented" aria-label="Primary">
      <button class={['segmented-button', view === 'codes' && 'active']} type="button" onclick={() => (view = 'codes')}>
        <CirclePlus size={16} aria-hidden="true" />
        {tr('addAccount')}
      </button>
      <button class={['segmented-button', view === 'transfer' && 'active']} type="button" onclick={() => (view = 'transfer')}>
        <Upload size={16} aria-hidden="true" />
        {tr('import')}
      </button>
      <button class={['segmented-button', view === 'settings' && 'active']} type="button" onclick={() => (view = 'settings')}>
        <Settings size={16} aria-hidden="true" />
        {tr('settings')}
      </button>
    </nav>

    {#if view === 'codes'}
      <section class="code-view">
        <div class="toolbar">
          <label class="search-field">
            <Search size={17} aria-hidden="true" />
            <input type="search" placeholder={tr('search')} bind:value={query} />
          </label>
          <button class="btn btn-primary btn-sm" type="button" onclick={() => (showAdd = true)}>
            <CirclePlus size={16} aria-hidden="true" />
            {tr('addAccount')}
          </button>
        </div>

        <div class="account-list">
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
            <div class="empty-state">{tr('empty')}</div>
          {/each}
        </div>
      </section>
    {:else if view === 'transfer'}
      <div class="transfer-layout">
        <section class="panel">
          <h2>{tr('scanPage')}</h2>
          <button class="btn btn-primary" type="button" onclick={startPageScan}>
            <Search size={16} aria-hidden="true" />
            {tr('scanPage')}
          </button>
        </section>
        <ImportExportPanel
          accounts={vault.accounts}
          settings={vault.settings}
          tr={tr}
          onimport={applyImportText}
          onimportencrypted={(text, password) => vault.importEncryptedBackupText(text, password)}
        />
        <section class="panel">
          <h2>{tr('camera')}</h2>
          <CameraScanner tr={tr} onscan={applyCameraImport} />
        </section>
      </div>
    {:else}
      <section class="panel settings-panel">
        <label class="field">
          <span>{tr('language')}</span>
          <select class="select" value={vault.settings.language} onchange={updateLanguage}>
            {#each LANGUAGES as language (language.code)}
              <option value={language.code}>{language.label}</option>
            {/each}
          </select>
        </label>

        <label class="field">
          <span>{tr('theme')}</span>
          <select class="select" value={vault.settings.theme} onchange={updateTheme}>
            <option value="light">{tr('light')}</option>
            <option value="dark">{tr('dark')}</option>
          </select>
        </label>

        <label class="inline-field">
          <input class="toggle" type="checkbox" checked={vault.settings.copyWithSpaces} onchange={updateCopySpacing} />
          <span>{tr('copyWithSpaces')}</span>
        </label>
      </section>
    {/if}
  {/if}
</main>

{#if showAdd}
  <dialog class="modal modal-open" open>
    <div class="modal-box">
      <h2>{tr('addAccount')}</h2>
      {#if formError}
        <div class="alert alert-error" role="alert">{formError}</div>
      {/if}
      <AccountForm tr={tr} onsubmit={saveNewAccount} oncancel={() => (showAdd = false)} />
    </div>
  </dialog>
{/if}

{#if editing}
  <dialog class="modal modal-open" open>
    <div class="modal-box">
      <h2>{tr('editAccount')}</h2>
      {#if formError}
        <div class="alert alert-error" role="alert">{formError}</div>
      {/if}
      <AccountForm initial={editing} tr={tr} onsubmit={saveEditedAccount} oncancel={() => (editing = null)} />
    </div>
  </dialog>
{/if}

{#if deleting}
  <dialog class="modal modal-open" open>
    <div class="modal-box">
      <h2>{tr('delete')}</h2>
      <p>{deleting.issuer ? `${deleting.issuer} - ` : ''}{deleting.label}</p>
      <div class="dialog-actions">
        <button class="btn" type="button" onclick={() => (deleting = null)}>{tr('cancel')}</button>
        <button class="btn btn-error" type="button" onclick={deleteSelected}>{tr('delete')}</button>
      </div>
    </div>
  </dialog>
{/if}

{#if qrAccount}
  <dialog class="modal modal-open" open>
    <div class="modal-box qr-box">
      <h2>{tr('showQr')}</h2>
      <p>{qrAccount.issuer ? `${qrAccount.issuer} - ` : ''}{qrAccount.label}</p>
      {#if qrDataUrl}
        <img class="qr-image" src={qrDataUrl} alt={tr('showQr')} />
        <a class="btn" href={qrDataUrl} download={`${qrAccount.label || 'account'}-qr.png`}>
          <Download size={16} aria-hidden="true" />
          QR
        </a>
      {/if}
      <div class="dialog-actions">
        <button class="btn btn-primary" type="button" onclick={() => (qrAccount = null)}>{tr('cancel')}</button>
      </div>
    </div>
  </dialog>
{/if}
