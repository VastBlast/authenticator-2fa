<script lang="ts">
  import { fade } from 'svelte/transition';
  import { CircleAlert, CircleCheck, Download, FileText, ShieldCheck } from '@lucide/svelte';
  import PasswordField from './PasswordField.svelte';
  import { FADE_TRANSITION, panelReveal } from './transitions';
  import { createEncryptedBackupFile, createPlainOtpAuthFile, downloadFile } from '../../auth/backup';
  import { getErrorMessage } from '../../auth/errors';
  import type { AppSettings, AuthenticatorAccount } from '../../auth/types';
  import { tr } from '../../i18n/messages';

  interface Props {
    accounts: AuthenticatorAccount[];
    settings: AppSettings;
  }

  type ExportFormat = 'encrypted' | 'plain';

  const MIN_PASSWORD_LENGTH = 8;
  const FORMATS = [
    { id: 'encrypted', icon: ShieldCheck, title: 'exportOptionEncrypted', hint: 'exportOptionEncryptedHint' },
    { id: 'plain', icon: FileText, title: 'exportOptionPlain', hint: 'plainWarning' }
  ] as const;

  let { accounts, settings }: Props = $props();

  let format = $state<ExportFormat>('encrypted');
  let password = $state('');
  let confirmPassword = $state('');
  let acknowledged = $state(false);
  let busy = $state(false);
  let error = $state('');
  let exported = $state(false);

  const tooShort = $derived(password.length > 0 && password.length < MIN_PASSWORD_LENGTH);
  const mismatch = $derived(confirmPassword.length > 0 && confirmPassword !== password);
  const canExport = $derived(
    accounts.length > 0 &&
      !busy &&
      (format === 'plain'
        ? acknowledged
        : password.length >= MIN_PASSWORD_LENGTH && password === confirmPassword)
  );

  async function exportBackup(event: SubmitEvent) {
    event.preventDefault();
    if (!canExport) {
      return;
    }

    busy = true;
    error = '';
    try {
      downloadFile(
        format === 'plain'
          ? createPlainOtpAuthFile(accounts)
          : await createEncryptedBackupFile(accounts, settings, password)
      );
      // Passwords are only needed for the file that just left the app.
      password = '';
      confirmPassword = '';
      acknowledged = false;
      exported = true;
    } catch (cause) {
      error = getErrorMessage(cause, tr('exportFailed'));
    } finally {
      busy = false;
    }
  }

  function selectFormat(next: ExportFormat) {
    format = next;
    clearFeedback();
  }

  function clearFeedback() {
    exported = false;
    error = '';
  }
</script>

{#if accounts.length === 0}
  <div class="grid justify-items-center gap-1.5 py-10 text-center">
    <p class="text-base font-semibold">{tr('empty')}</p>
    <p class="max-w-60 text-sm text-base-content/60">{tr('emptyHint')}</p>
  </div>
{:else}
  <form class="grid gap-4" onsubmit={exportBackup}>
    <p class="text-sm text-base-content/65">{tr('exportCount', { count: accounts.length })}</p>

    <div class="grid gap-2">
      {#each FORMATS as option (option.id)}
        {@const OptionIcon = option.icon}
        {@const selected = format === option.id}
        <label
          class={[
            'flex cursor-pointer items-start gap-3 rounded-box border p-3 transition-colors',
            selected ? 'border-primary bg-primary/5' : 'border-base-300 hover:bg-base-200/50'
          ]}
        >
          <input
            class="radio radio-sm radio-primary mt-0.5 shrink-0"
            type="radio"
            name="export-format"
            value={option.id}
            checked={selected}
            onchange={() => selectFormat(option.id)}
          />
          <span class="grid gap-0.5">
            <span class="flex items-center gap-1.5 text-sm font-semibold">
              <OptionIcon size={15} aria-hidden="true" />
              {tr(option.title)}
            </span>
            <span class="text-xs leading-snug text-base-content/60">{tr(option.hint)}</span>
          </span>
        </label>
      {/each}
    </div>

    {#if format === 'encrypted'}
      <div class="grid gap-3" transition:panelReveal>
        <PasswordField
          bind:value={password}
          label={tr('backupPassword')}
          autocomplete="new-password"
          hint={tr('passwordHint')}
          invalid={tooShort}
          disabled={busy}
          oninput={clearFeedback}
        />
        <PasswordField
          bind:value={confirmPassword}
          label={tr('confirmPassword')}
          autocomplete="new-password"
          hint={mismatch ? tr('passwordMismatch') : ''}
          invalid={mismatch}
          disabled={busy}
          oninput={clearFeedback}
        />
      </div>
    {:else}
      <label
        class="flex cursor-pointer items-start gap-2.5 rounded-box border border-warning/40 bg-warning/10 p-3 text-sm"
        transition:panelReveal
      >
        <input
          class="checkbox checkbox-sm checkbox-warning mt-0.5 shrink-0"
          type="checkbox"
          bind:checked={acknowledged}
          onchange={clearFeedback}
          disabled={busy}
        />
        <span>{tr('exportPlainAcknowledge')}</span>
      </label>
    {/if}

    <button class="btn btn-primary btn-block" type="submit" disabled={!canExport}>
      {#if busy}
        <span class="loading loading-spinner loading-sm"></span>
      {:else}
        <Download size={16} aria-hidden="true" />
      {/if}
      {format === 'plain' ? tr('exportOtp') : tr('exportEncrypted')}
    </button>

    {#if exported}
      <div class="alert alert-success py-2 text-sm" role="status" transition:fade={FADE_TRANSITION}>
        <CircleCheck class="shrink-0" size={16} aria-hidden="true" />
        <span>{tr('exportDone')}</span>
      </div>
    {/if}
    {#if error}
      <div class="alert alert-error py-2 text-sm" role="alert" transition:fade={FADE_TRANSITION}>
        <CircleAlert class="shrink-0" size={16} aria-hidden="true" />
        <span>{error}</span>
      </div>
    {/if}
  </form>
{/if}
