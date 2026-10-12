<script lang="ts">
  import { fade } from 'svelte/transition';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Cloud from '@lucide/svelte/icons/cloud';
  import DatabaseBackup from '@lucide/svelte/icons/database-backup';
  import KeyRound from '@lucide/svelte/icons/key-round';
  import Monitor from '@lucide/svelte/icons/monitor';
  import Moon from '@lucide/svelte/icons/moon';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import Sun from '@lucide/svelte/icons/sun';
  import Trash from '@lucide/svelte/icons/trash';
  import ImportExportPanel from './ImportExportPanel.svelte';
  import BrowserSyncPanel from './BrowserSyncPanel.svelte';
  import Toast from './Toast.svelte';
  import ViewHeader from './ViewHeader.svelte';
  import { FADE_TRANSITION, panelReveal, viewTransition } from './transitions';
  import { getSyncStatusKey, getSyncStatusTone, SYNC_STATUS_DOT } from './syncStatus';
  import { authenticatorVault as vault } from '../../state/authenticator.svelte';
  import { LANGUAGES, tr } from '../../i18n/messages';
  import type { AppSettings, ThemePreference } from '../../auth/types';

  interface Props {
    onback: (event?: MouseEvent) => void;
    oncontextualsortchange: (enabled: boolean) => void | Promise<void>;
  }

  const THEME_OPTIONS = [
    { theme: 'system', icon: Monitor },
    { theme: 'light', icon: Sun },
    { theme: 'dark', icon: Moon }
  ] as const;

  let { onback, oncontextualsortchange }: Props = $props();

  type Intent = 'idle' | 'enabling' | 'disabling' | 'changing';

  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmNewPassword = $state('');
  let resetConfirmation = $state('');
  let showTransfer = $state(false);
  let showSync = $state(false);
  let returnToSync = $state(false);
  let sortSaving = $state(false);
  let securitySaving = $state(false);
  let intent = $state<Intent>('idle');
  let currentPasswordInput = $state<HTMLInputElement | undefined>();
  let newPasswordInput = $state<HTMLInputElement | undefined>();
  // The switch reflects the desired state, even mid-change before it is applied.
  const wantsProtection = $derived(
    vault.passwordProtected ? intent !== 'disabling' : intent === 'enabling'
  );
  const securityPending = $derived(vault.busy || securitySaving);
  const passwordsMismatch = $derived(
    confirmNewPassword.length > 0 && confirmNewPassword !== newPassword
  );
  const canApply = $derived(
    !securityPending &&
      newPassword.length >= 8 &&
      newPassword === confirmNewPassword &&
      (intent !== 'changing' || Boolean(currentPassword))
  );
  // Surface vault-level errors (wrong password, etc.) only while a password
  // change is in progress.
  const passwordError = $derived(intent === 'idle' ? '' : vault.error);
  const settingsToastError = $derived(intent === 'idle' ? vault.error : '');
  const securityPanel = $derived.by((): 'password' | 'disable' | 'change' | null => {
    if (intent === 'enabling' || intent === 'changing') {
      return 'password';
    }
    if (intent === 'disabling') {
      return 'disable';
    }
    return vault.passwordProtected ? 'change' : null;
  });

  $effect(() => {
    if (securityPanel === 'disable' || (securityPanel === 'password' && intent === 'changing')) {
      currentPasswordInput?.focus();
    } else if (securityPanel === 'password') {
      newPasswordInput?.focus();
    }
  });

  function setLanguage(language: string) {
    saveSettings({ language });
  }

  function setTheme(theme: ThemePreference) {
    if (theme !== vault.settings.theme) {
      saveSettings({ theme });
    }
  }

  function setShowCountdownSeconds(showCountdownSeconds: boolean) {
    saveSettings({ showCountdownSeconds });
  }

  function setAutoPasteCodes(autoPasteCodes: boolean) {
    saveSettings({ autoPasteCodes });
  }

  function saveSettings(settings: Partial<AppSettings>) {
    void vault.updateSettings(settings).catch((error: unknown) => {
      vault.error = error instanceof Error && error.message ? error.message : tr('settingsSaveFailed');
    });
  }

  async function setAutoSortCodes(input: HTMLInputElement) {
    sortSaving = true;
    try {
      await oncontextualsortchange(input.checked);
    } finally {
      input.checked = vault.settings.accountSortMode === 'contextual';
      sortSaving = false;
    }
  }

  function resetForm() {
    currentPassword = newPassword = confirmNewPassword = '';
    vault.error = '';
  }

  function toggleProtection() {
    resetForm();
    if (vault.passwordProtected) {
      intent = intent === 'disabling' ? 'idle' : 'disabling';
    } else {
      intent = intent === 'enabling' ? 'idle' : 'enabling';
    }
  }

  function startChange() {
    resetForm();
    intent = 'changing';
  }

  function protectForSync() {
    showSync = false;
    returnToSync = true;
    resetForm();
    intent = 'enabling';
  }

  function cancel() {
    resetForm();
    intent = 'idle';
    returnToSync = false;
  }

  async function applyPassword() {
    if (securitySaving) {
      return;
    }
    vault.error = '';
    securitySaving = true;
    try {
      await vault.changePassword(intent === 'changing' ? currentPassword : '', newPassword);
      if (!vault.error) {
        const reopenSync = returnToSync;
        cancel();
        showSync = reopenSync;
      }
    } finally {
      securitySaving = false;
    }
  }

  async function disableProtection() {
    if (securitySaving) {
      return;
    }
    vault.error = '';
    securitySaving = true;
    try {
      await vault.removePassword(currentPassword);
      if (!vault.error) {
        cancel();
      }
    } finally {
      securitySaving = false;
    }
  }

  async function resetVault() {
    if (securitySaving || resetConfirmation !== 'DELETE') {
      return;
    }
    securitySaving = true;
    try {
      await vault.resetVault();
      resetConfirmation = '';
      onback();
    } finally {
      securitySaving = false;
    }
  }
</script>

<!-- The transfer screen covers this view, so settings stay out of the tab order
     while it is open. -->
<div class="flex h-full flex-col overflow-hidden" inert={showTransfer || showSync}>
  <ViewHeader title={tr('settings')} {onback} />

  <div class="grow space-y-5 overflow-y-auto p-3">
    <!-- Appearance -->
    <section class="space-y-3">
      <h2 class="text-xs font-bold uppercase tracking-wide text-base-content/50">{tr('appearance')}</h2>

      <div class="space-y-1.5">
        <span class="text-sm font-medium">{tr('theme')}</span>
        <div class="join w-full" role="group" aria-label={tr('theme')}>
          {#each THEME_OPTIONS as option (option.theme)}
            {@const ThemeIcon = option.icon}
            <button
              class={['btn join-item flex-1 btn-sm', vault.settings.theme === option.theme && 'btn-primary']}
              type="button"
              aria-pressed={vault.settings.theme === option.theme}
              onclick={() => setTheme(option.theme)}
            >
              <ThemeIcon size={16} aria-hidden="true" />
              {tr(option.theme)}
            </button>
          {/each}
        </div>
      </div>

      <label class="grid gap-1.5">
        <span class="text-sm font-medium">{tr('language')}</span>
        <select
          class="select select-sm w-full"
          value={vault.settings.language}
          onchange={(event) => setLanguage((event.target as HTMLSelectElement).value)}
        >
          {#each LANGUAGES as language (language.code)}
            <option value={language.code}>{language.label}</option>
          {/each}
        </select>
      </label>

      <label class="flex items-center justify-between gap-3">
        <span class="min-w-0">
          <span class="block text-sm font-medium">{tr('showCountdownSeconds')}</span>
          <span class="block text-xs text-base-content/60">{tr('showCountdownSecondsHint')}</span>
        </span>
        <input
          class="toggle toggle-primary shrink-0"
          type="checkbox"
          checked={vault.settings.showCountdownSeconds}
          onchange={(event) => setShowCountdownSeconds((event.target as HTMLInputElement).checked)}
        />
      </label>
    </section>

    <!-- Codes -->
    <section class="space-y-3">
      <h2 class="text-xs font-bold uppercase tracking-wide text-base-content/50">{tr('accounts')}</h2>

      <label class="flex items-center justify-between gap-3">
        <span class="min-w-0">
          <span class="block text-sm font-medium">{tr('autoSortCodes')}</span>
          <span class="block text-xs text-base-content/60">{tr('autoSortCodesHint')}</span>
        </span>
        <input
          class="toggle toggle-primary shrink-0"
          type="checkbox"
          checked={vault.settings.accountSortMode === 'contextual'}
          disabled={sortSaving}
          onchange={(event) => void setAutoSortCodes(event.currentTarget)}
        />
      </label>

      {#if vault.settings.accountSortMode === 'contextual'}
        <div transition:panelReveal>
          <label class="flex items-center justify-between gap-3 border-s-2 border-base-200 ps-3">
            <span class="min-w-0">
              <span class="block text-sm font-medium">{tr('alwaysShowAllCodes')}</span>
              <span class="block text-xs text-base-content/60">{tr('alwaysShowAllCodesHint')}</span>
            </span>
            <input
              class="toggle toggle-primary toggle-sm shrink-0"
              type="checkbox"
              checked={vault.settings.alwaysShowAllCodes}
              onchange={(event) => saveSettings({ alwaysShowAllCodes: event.currentTarget.checked })}
            />
          </label>
        </div>
      {/if}

      <label class="flex items-center justify-between gap-3">
        <span class="min-w-0">
          <span class="flex flex-wrap items-center gap-1.5 text-sm font-medium">
            <span>{tr('autoPasteCodes')}</span>
            <span class="badge badge-warning badge-xs shrink-0">{tr('beta')}</span>
          </span>
          <span class="block text-xs text-base-content/60">{tr('autoPasteCodesHint')}</span>
        </span>
        <input
          class="toggle toggle-primary shrink-0"
          type="checkbox"
          checked={vault.settings.autoPasteCodes}
          onchange={(event) => setAutoPasteCodes((event.target as HTMLInputElement).checked)}
        />
      </label>

      <label class="flex items-center justify-between gap-3">
        <span class="min-w-0">
          <span class="block text-sm font-medium">{tr('hideCodes')}</span>
          <span class="block text-xs text-base-content/60">{tr('hideCodesHint')}</span>
        </span>
        <input
          class="toggle toggle-primary shrink-0"
          type="checkbox"
          checked={vault.settings.hideCodes}
          onchange={(event) => saveSettings({ hideCodes: event.currentTarget.checked })}
        />
      </label>
    </section>

    <section class="space-y-3">
      <h2 class="text-xs font-bold uppercase tracking-wide text-base-content/50">{tr('browserSync')}</h2>
      <button
        class="btn btn-block h-auto min-h-10 justify-between border border-base-content/20 bg-base-200 py-2"
        type="button"
        onclick={() => (showSync = true)}
      >
        <span class="flex min-w-0 items-center gap-2.5 text-start">
          <Cloud class="shrink-0" size={16} aria-hidden="true" />
          <span class="min-w-0 whitespace-normal">
            <span class="block text-sm">{tr('browserSync')}</span>
            {#if vault.syncEnabled || vault.syncError}
              <span class="flex items-center gap-1.5 text-xs font-normal text-base-content/60" role="status">
                <span class={['size-2 shrink-0 rounded-full', SYNC_STATUS_DOT[getSyncStatusTone(vault.syncStatus)]]} aria-hidden="true"></span>
                {tr(getSyncStatusKey(vault.syncStatus))}
              </span>
            {:else}
              <span class="block text-xs font-normal text-base-content/60">{tr('syncDescription')}</span>
            {/if}
          </span>
        </span>
        <ChevronRight class="shrink-0 opacity-50" size={16} aria-hidden="true" />
      </button>
    </section>

    <!-- Backup -->
    <section class="space-y-3">
      <h2 class="text-xs font-bold uppercase tracking-wide text-base-content/50">{tr('importExport')}</h2>
      <button
        class="btn btn-block btn-sm justify-between border border-base-content/20 bg-base-200"
        type="button"
        onclick={() => (showTransfer = true)}
      >
        <span class="flex items-center gap-2">
          <DatabaseBackup size={16} aria-hidden="true" />
          {tr('importExport')}
        </span>
        <ChevronRight class="opacity-50" size={16} aria-hidden="true" />
      </button>
    </section>

    <!-- Security -->
    <section class="space-y-3">
      <h2 class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-base-content/50">
        <ShieldCheck size={14} aria-hidden="true" />
        {tr('security')}
      </h2>

      <label class="flex items-center justify-between gap-3">
        <span class="min-w-0">
          <span class="block text-sm font-medium">{tr('passwordProtection')}</span>
          <span class="block text-xs text-base-content/60">
            {vault.syncEnabled ? tr('syncProtectionHint') : vault.passwordProtected ? tr('protectionOnHint') : tr('protectionOffHint')}
          </span>
        </span>
        <input
          class="toggle toggle-primary shrink-0"
          type="checkbox"
          checked={wantsProtection}
          onchange={toggleProtection}
          disabled={securityPending || vault.syncEnabled}
        />
      </label>

      {#if securityPanel}
        <div transition:panelReveal>
          {#if securityPanel === 'password'}
            <div class="space-y-2 rounded-box bg-base-200/60 p-3">
              {#if intent === 'changing'}
                <label class="grid gap-1.5">
                  <span class="text-sm font-medium">{tr('currentPassword')}</span>
                  <input
                    class="input input-sm w-full"
                    type="password"
                    bind:this={currentPasswordInput}
                    bind:value={currentPassword}
                    autocomplete="current-password"
                    disabled={securityPending}
                  />
                </label>
              {/if}
              <label class="grid gap-1.5">
                <span class="text-sm font-medium">{tr('newPassword')}</span>
                <input
                  class="input input-sm w-full"
                  type="password"
                  bind:this={newPasswordInput}
                  bind:value={newPassword}
                  autocomplete="new-password"
                  disabled={securityPending}
                />
                <span class="text-xs text-base-content/50">{tr('passwordHint')}</span>
              </label>
              <label class="grid gap-1.5">
                <span class="text-sm font-medium">{tr('confirmPassword')}</span>
                <input class="input input-sm w-full" type="password" bind:value={confirmNewPassword} autocomplete="new-password" disabled={securityPending} />
                {#if passwordsMismatch}
                  <span class="text-xs text-error">{tr('passwordMismatch')}</span>
                {/if}
              </label>
              <div class="grid grid-cols-2 gap-2 pt-1">
                <button class="btn btn-sm" type="button" onclick={cancel} disabled={securityPending}>{tr('cancel')}</button>
                <button class="btn btn-primary btn-sm" type="button" onclick={applyPassword} disabled={!canApply}>
                  {#if securityPending}
                    <span class="loading loading-spinner loading-xs"></span>
                  {/if}
                  {intent === 'changing' ? tr('changePassword') : tr('setPassword')}
                </button>
              </div>
            </div>
          {:else if securityPanel === 'disable'}
            <div class="space-y-2 rounded-box border border-warning/40 bg-warning/10 p-3">
              <label class="grid gap-1.5">
                <span class="text-sm font-medium">{tr('currentPassword')}</span>
                <input
                  class="input input-sm w-full"
                  type="password"
                  bind:this={currentPasswordInput}
                  bind:value={currentPassword}
                  autocomplete="current-password"
                  disabled={securityPending}
                />
              </label>
              <div class="grid grid-cols-2 gap-2 pt-1">
                <button class="btn btn-sm" type="button" onclick={cancel} disabled={securityPending}>{tr('cancel')}</button>
                <button class="btn btn-warning btn-sm" type="button" onclick={disableProtection} disabled={securityPending || !currentPassword}>
                  {#if securityPending}
                    <span class="loading loading-spinner loading-xs"></span>
                  {/if}
                  {tr('turnOff')}
                </button>
              </div>
            </div>
          {:else}
            <button class="btn btn-ghost btn-block btn-sm justify-start" type="button" onclick={startChange}>
              <KeyRound size={16} aria-hidden="true" />
              {tr('changePassword')}
            </button>
          {/if}
        </div>
      {/if}

      {#if passwordError}
        <p class="text-sm text-error" transition:fade={FADE_TRANSITION} role="alert">{passwordError}</p>
      {/if}

      <div class="space-y-2 rounded-box border border-error/30 bg-error/5 p-3">
        <label class="grid gap-1.5">
          <span class="text-sm font-medium text-error">{tr('deleteVault')}</span>
          <input class="input input-sm w-full" bind:value={resetConfirmation} autocomplete="off" placeholder="DELETE" disabled={securityPending} />
        </label>
        <p class="text-xs text-base-content/60">{tr('deleteVaultConfirm')}</p>
        {#if vault.syncEnabled}
          <p class="text-xs text-base-content/60">{tr('syncLocalDeleteHint')}</p>
        {/if}
        <button class="btn btn-error btn-block btn-sm" type="button" onclick={resetVault} disabled={securityPending || resetConfirmation !== 'DELETE'}>
          <Trash size={16} aria-hidden="true" />
          {tr('deleteVault')}
        </button>
      </div>
    </section>
  </div>
</div>

<!-- The transfer screen reports import and export results inline, so the shared
     toast stays quiet while it is open. -->
<Toast
  message={showTransfer || showSync ? '' : settingsToastError || vault.notice}
  variant={settingsToastError ? 'error' : 'notice'}
  nonce={vault.noticeKey}
/>

{#if showTransfer}
  <div class="fixed inset-0 z-30 bg-base-100" transition:viewTransition={{ x: 20 }}>
    <ImportExportPanel
      accounts={vault.accounts}
      settings={vault.settings}
      onimport={(text) => vault.importText(text)}
      onimportencrypted={(text, password) => vault.importEncryptedBackupText(text, password)}
      onclose={() => (showTransfer = false)}
    />
  </div>
{/if}

{#if showSync}
  <div class="fixed inset-0 z-30 bg-base-100" transition:viewTransition={{ x: 20 }}>
    <BrowserSyncPanel onclose={() => (showSync = false)} onprotect={protectForSync} />
  </div>
{/if}
