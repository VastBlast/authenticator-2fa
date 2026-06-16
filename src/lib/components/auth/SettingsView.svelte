<script lang="ts">
  import { ArrowLeft, ChevronRight, DatabaseBackup, KeyRound, Moon, ShieldCheck, Sun, Trash2 } from '@lucide/svelte';
  import ImportExportPanel from './ImportExportPanel.svelte';
  import { authenticatorVault as vault } from '../../state/authenticator.svelte';
  import { clearPendingPageScan } from '../../auth/pendingScan';
  import { LANGUAGES, tr } from '../../i18n/messages';

  interface Props {
    onback: () => void;
  }

  let { onback }: Props = $props();

  type Intent = 'idle' | 'enabling' | 'disabling' | 'changing';

  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmNewPassword = $state('');
  let resetConfirmation = $state('');
  let securityError = $state('');
  let showBackup = $state(false);
  let intent = $state<Intent>('idle');

  // The switch reflects the desired state, even mid-change before it is applied.
  const wantsProtection = $derived(
    vault.passwordProtected ? intent !== 'disabling' : intent === 'enabling'
  );
  const canApply = $derived(
    !vault.busy &&
      newPassword.length >= 8 &&
      newPassword === confirmNewPassword &&
      (intent !== 'changing' || Boolean(currentPassword))
  );
  // Surface vault-level errors (wrong password, etc.) only while a password
  // change is in progress, alongside local validation messages.
  const passwordError = $derived(securityError || (intent === 'idle' ? '' : vault.error));

  function setLanguage(language: string) {
    void vault.replaceSettings({ ...vault.settings, language });
  }

  function setTheme(theme: 'light' | 'dark') {
    if (theme !== vault.settings.theme) {
      void vault.replaceSettings({ ...vault.settings, theme });
    }
  }

  function resetForm() {
    currentPassword = newPassword = confirmNewPassword = '';
    securityError = '';
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

  function cancel() {
    resetForm();
    intent = 'idle';
  }

  async function applyPassword() {
    securityError = '';
    vault.error = '';
    if (newPassword !== confirmNewPassword) {
      securityError = 'New passwords do not match.';
      return;
    }
    await vault.changePassword(intent === 'changing' ? currentPassword : '', newPassword);
    if (!vault.error) {
      cancel();
    }
  }

  async function disableProtection() {
    securityError = '';
    vault.error = '';
    if (!currentPassword) {
      securityError = 'Enter the current password.';
      return;
    }
    await vault.removePassword(currentPassword);
    if (!vault.error) {
      cancel();
    }
  }

  async function resetVault() {
    securityError = '';
    if (resetConfirmation !== 'DELETE') {
      securityError = tr('deleteVaultConfirm');
      return;
    }
    await clearPendingPageScan();
    await vault.resetVault();
    resetConfirmation = '';
    onback();
  }
</script>

<div class="flex h-full flex-col overflow-hidden">
  <header class="flex items-center gap-2 border-b border-base-200 px-2 py-2">
    <button class="btn btn-ghost btn-sm btn-circle" type="button" aria-label="Back" onclick={onback}>
      <ArrowLeft size={18} aria-hidden="true" />
    </button>
    <h1 class="text-base font-bold tracking-tight">{tr('settings')}</h1>
  </header>

  <div class="grow space-y-5 overflow-y-auto p-3">
    <!-- Appearance -->
    <section class="space-y-3">
      <h2 class="text-xs font-bold uppercase tracking-wide text-base-content/50">{tr('appearance')}</h2>

      <div class="space-y-1.5">
        <span class="text-sm font-medium">{tr('theme')}</span>
        <div class="join w-full">
          <button
            class={['btn join-item flex-1 btn-sm', vault.settings.theme === 'light' && 'btn-primary']}
            type="button"
            onclick={() => setTheme('light')}
          >
            <Sun size={16} aria-hidden="true" />
            {tr('light')}
          </button>
          <button
            class={['btn join-item flex-1 btn-sm', vault.settings.theme === 'dark' && 'btn-primary']}
            type="button"
            onclick={() => setTheme('dark')}
          >
            <Moon size={16} aria-hidden="true" />
            {tr('dark')}
          </button>
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
    </section>

    <!-- Backup -->
    <section class="space-y-3">
      <h2 class="text-xs font-bold uppercase tracking-wide text-base-content/50">{tr('importExport')}</h2>
      <button
        class="btn btn-block btn-sm justify-between border border-base-content/20 bg-base-200"
        type="button"
        onclick={() => (showBackup = true)}
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
            {vault.passwordProtected ? tr('protectionOnHint') : tr('protectionOffHint')}
          </span>
        </span>
        <input
          class="toggle toggle-primary shrink-0"
          type="checkbox"
          checked={wantsProtection}
          onchange={toggleProtection}
          disabled={vault.busy}
        />
      </label>

      {#if intent === 'enabling' || intent === 'changing'}
        <div class="space-y-2 rounded-box bg-base-200/60 p-3">
          {#if intent === 'changing'}
            <label class="grid gap-1.5">
              <span class="text-sm font-medium">{tr('currentPassword')}</span>
              <input class="input input-sm w-full" type="password" bind:value={currentPassword} autocomplete="current-password" />
            </label>
          {/if}
          <label class="grid gap-1.5">
            <span class="text-sm font-medium">{tr('newPassword')}</span>
            <!-- svelte-ignore a11y_autofocus -->
            <input class="input input-sm w-full" type="password" bind:value={newPassword} autocomplete="new-password" autofocus />
            <span class="text-xs text-base-content/50">{tr('passwordHint')}</span>
          </label>
          <label class="grid gap-1.5">
            <span class="text-sm font-medium">{tr('confirmPassword')}</span>
            <input class="input input-sm w-full" type="password" bind:value={confirmNewPassword} autocomplete="new-password" />
          </label>
          <div class="grid grid-cols-2 gap-2 pt-1">
            <button class="btn btn-sm" type="button" onclick={cancel}>{tr('cancel')}</button>
            <button class="btn btn-primary btn-sm" type="button" onclick={applyPassword} disabled={!canApply}>
              {#if vault.busy}
                <span class="loading loading-spinner loading-xs"></span>
              {/if}
              {intent === 'changing' ? tr('changePassword') : tr('setPassword')}
            </button>
          </div>
        </div>
      {:else if intent === 'disabling'}
        <div class="space-y-2 rounded-box border border-warning/40 bg-warning/10 p-3">
          <label class="grid gap-1.5">
            <span class="text-sm font-medium">{tr('currentPassword')}</span>
            <!-- svelte-ignore a11y_autofocus -->
            <input class="input input-sm w-full" type="password" bind:value={currentPassword} autocomplete="current-password" autofocus />
          </label>
          <div class="grid grid-cols-2 gap-2 pt-1">
            <button class="btn btn-sm" type="button" onclick={cancel}>{tr('cancel')}</button>
            <button class="btn btn-warning btn-sm" type="button" onclick={disableProtection} disabled={vault.busy || !currentPassword}>
              {#if vault.busy}
                <span class="loading loading-spinner loading-xs"></span>
              {/if}
              {tr('turnOff')}
            </button>
          </div>
        </div>
      {:else if vault.passwordProtected}
        <button class="btn btn-ghost btn-block btn-sm justify-start" type="button" onclick={startChange}>
          <KeyRound size={16} aria-hidden="true" />
          {tr('changePassword')}
        </button>
      {/if}

      {#if passwordError}
        <p class="text-sm text-error" role="alert">{passwordError}</p>
      {/if}

      <div class="space-y-2 rounded-box border border-error/30 bg-error/5 p-3">
        <label class="grid gap-1.5">
          <span class="text-sm font-medium text-error">{tr('deleteVault')}</span>
          <input class="input input-sm w-full" bind:value={resetConfirmation} autocomplete="off" placeholder="DELETE" />
        </label>
        <p class="text-xs text-base-content/60">{tr('deleteVaultConfirm')}</p>
        <button class="btn btn-error btn-block btn-sm" type="button" onclick={resetVault} disabled={vault.busy || resetConfirmation !== 'DELETE'}>
          <Trash2 size={16} aria-hidden="true" />
          {tr('deleteVault')}
        </button>
      </div>
    </section>
  </div>
</div>

{#if showBackup}
  <dialog class="modal modal-open" open>
    <div class="modal-box max-h-[88dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto p-4">
      <h2 class="mb-3 text-lg font-bold">{tr('importExport')}</h2>
      <ImportExportPanel
        accounts={vault.accounts}
        settings={vault.settings}
        onimport={(text) => vault.importText(text)}
        onimportencrypted={(text, password) => vault.importEncryptedBackupText(text, password)}
      />
    </div>
    <button class="modal-backdrop" type="button" onclick={() => (showBackup = false)}>close</button>
  </dialog>
{/if}
