<script lang="ts">
  import { fade } from 'svelte/transition';
  import { CircleAlert, CircleCheck, FileLock2, Upload } from '@lucide/svelte';
  import PasswordField from './PasswordField.svelte';
  import { getImportFailureMessage } from './importFeedback';
  import { FADE_TRANSITION } from './transitions';
  import { BackupPasswordError } from '../../auth/backup';
  import { getErrorMessage } from '../../auth/errors';
  import { readImportFiles, type EncryptedBackupFile } from '../../auth/importFiles';
  import type { ImportResult } from '../../auth/types';
  import { tr } from '../../i18n/messages';

  interface Props {
    onimport: (text: string) => Promise<ImportResult>;
    onimportencrypted: (text: string, password: string) => Promise<ImportResult>;
  }

  interface ImportSummary {
    imported: number;
    skipped: number;
    errors: string[];
  }

  const FILE_ACCEPT = 'image/*,.txt,.json,text/plain,application/json';

  let { onimport, onimportencrypted }: Props = $props();

  let fileInput = $state<HTMLInputElement | null>(null);
  let pasteText = $state('');
  let password = $state('');
  let passwordError = $state('');
  let pendingBackups = $state.raw<EncryptedBackupFile[]>([]);
  let summary = $state.raw<ImportSummary | null>(null);
  let error = $state('');
  let busy = $state(false);
  let dropActive = $state(false);

  const currentBackup = $derived(pendingBackups[0] ?? null);

  // The password prompt takes over the drop zone, so focus follows it.
  function focusPassword(node: HTMLElement) {
    node.querySelector('input')?.focus();
  }

  function importFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    void run(async () => {
      const selection = await readImportFiles(files);
      const result = selection.text
        ? await onimport(selection.text)
        : { imported: 0, skipped: 0, errors: [] };

      // Locked backups on their own are not a result yet: they still need a
      // password, and the prompt below says so.
      if (selection.text || selection.errors.length > 0 || selection.encrypted.length === 0) {
        addToSummary({
          imported: result.imported,
          skipped: result.skipped,
          errors: [...result.errors, ...selection.errors]
        });
      }

      password = '';
      pendingBackups = selection.encrypted;
    });
  }

  function importPastedText() {
    void run(async () => {
      const result = await onimport(pasteText);
      addToSummary(result);
      if (result.imported > 0) {
        pasteText = '';
      }
    });
  }

  async function unlockBackup(event: SubmitEvent) {
    event.preventDefault();
    const backup = currentBackup;
    if (!backup || busy) {
      return;
    }

    passwordError = '';
    busy = true;
    try {
      addToSummary(await onimportencrypted(backup.text, password));
      password = '';
      pendingBackups = pendingBackups.slice(1);
    } catch (cause) {
      passwordError =
        cause instanceof BackupPasswordError
          ? tr('backupPasswordWrong')
          : getErrorMessage(cause, tr('importFailed'));
    } finally {
      busy = false;
    }
  }

  function skipBackup() {
    password = '';
    passwordError = '';
    pendingBackups = pendingBackups.slice(1);
  }

  async function run(action: () => Promise<void>) {
    if (busy) {
      return;
    }

    summary = null;
    error = '';
    passwordError = '';
    busy = true;
    try {
      await action();
    } catch (cause) {
      error = getErrorMessage(cause, tr('importFailed'));
    } finally {
      busy = false;
    }
  }

  function addToSummary(result: ImportSummary): void {
    const previous = summary ?? { imported: 0, skipped: 0, errors: [] };
    summary = {
      imported: previous.imported + result.imported,
      skipped: previous.skipped + result.skipped,
      errors: [...previous.errors, ...result.errors]
    };
  }

  function selectFiles(event: Event & { currentTarget: HTMLInputElement }) {
    const files = Array.from(event.currentTarget.files ?? []);
    // Reset so picking the same file twice still fires a change event.
    event.currentTarget.value = '';
    importFiles(files);
  }

  // Dropping anywhere on this screen imports, so a near miss still works.
  function handleDragOver(event: DragEvent) {
    if (!isFileDrag(event)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    dropActive = true;
  }

  function handleDragLeave(event: DragEvent) {
    // Moving between elements keeps a related target; leaving the window drops it.
    if (!event.relatedTarget) {
      dropActive = false;
    }
  }

  function handleDrop(event: DragEvent) {
    if (!isFileDrag(event)) {
      return;
    }
    event.preventDefault();
    dropActive = false;
    importFiles(Array.from(event.dataTransfer.files));
  }

  function isFileDrag(event: DragEvent): event is DragEvent & { dataTransfer: DataTransfer } {
    return event.dataTransfer?.types.includes('Files') ?? false;
  }
</script>

<svelte:window
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondragend={() => (dropActive = false)}
  ondrop={handleDrop}
/>

<section class="grid gap-4">
  {#if currentBackup}
    <form
      class="grid gap-3 rounded-box border border-base-300 bg-base-200/40 p-3"
      onsubmit={unlockBackup}
      {@attach focusPassword}
    >
      <div class="flex items-center gap-2">
        <FileLock2 class="shrink-0 text-base-content/55" size={20} aria-hidden="true" />
        <div class="min-w-0 grow">
          <p class="truncate text-sm font-semibold">{currentBackup.name}</p>
          <p class="text-xs text-base-content/60">{tr('importEncryptedPrompt')}</p>
        </div>
        {#if pendingBackups.length > 1}
          <span class="badge badge-sm shrink-0 tabular-nums">{pendingBackups.length}</span>
        {/if}
      </div>

      <PasswordField
        bind:value={password}
        label={tr('backupPassword')}
        disabled={busy}
        invalid={Boolean(passwordError)}
      />
      {#if passwordError}
        <p class="text-sm text-error" role="alert" transition:fade={FADE_TRANSITION}>{passwordError}</p>
      {/if}

      <div class="grid grid-cols-2 gap-2">
        <button class="btn btn-sm" type="button" onclick={skipBackup} disabled={busy}>
          {tr('cancel')}
        </button>
        <button class="btn btn-primary btn-sm" type="submit" disabled={busy || !password}>
          {#if busy}
            <span class="loading loading-spinner loading-xs"></span>
          {/if}
          {tr('unlock')}
        </button>
      </div>
    </form>
  {:else}
    <button
      class={[
        'grid w-full cursor-pointer place-items-center gap-1.5 rounded-box border-2 border-dashed px-4 py-7 text-center transition-colors',
        dropActive
          ? 'border-primary bg-primary/10'
          : 'border-base-300 bg-base-200/40 hover:border-base-content/25 hover:bg-base-200/70'
      ]}
      type="button"
      disabled={busy}
      onclick={() => fileInput?.click()}
    >
      <span class="grid size-11 place-items-center rounded-full bg-base-100 text-base-content/55 shadow-sm">
        {#if busy}
          <span class="loading loading-spinner loading-sm"></span>
        {:else}
          <Upload size={19} aria-hidden="true" />
        {/if}
      </span>
      <span class="text-sm font-semibold">{busy ? tr('importing') : tr('importDropTitle')}</span>
      <span class="max-w-64 text-xs leading-snug text-base-content/60">{tr('importDropHint')}</span>
    </button>
    <input
      class="hidden"
      bind:this={fileInput}
      type="file"
      accept={FILE_ACCEPT}
      multiple
      onchange={selectFiles}
    />
  {/if}

  {#if summary}
    <div
      class={['alert items-start py-2 text-sm', summary.imported > 0 ? 'alert-success' : 'alert-warning']}
      role="status"
      transition:fade={FADE_TRANSITION}
    >
      {#if summary.imported > 0}
        <CircleCheck class="shrink-0" size={16} aria-hidden="true" />
        <span class="grid gap-0.5">
          <span>
            {tr('importAddedCount', { count: summary.imported })}
            {#if summary.skipped > 0}
              <span class="opacity-75">· {tr('importSkippedCount', { count: summary.skipped })}</span>
            {/if}
          </span>
          {#if summary.errors.length > 0}
            <span class="text-xs opacity-75">{summary.errors[0]}</span>
          {/if}
        </span>
      {:else}
        <CircleAlert class="shrink-0" size={16} aria-hidden="true" />
        <span>{getImportFailureMessage(summary)}</span>
      {/if}
    </div>
  {/if}

  {#if error}
    <div class="alert alert-error py-2 text-sm" role="alert" transition:fade={FADE_TRANSITION}>
      <CircleAlert class="shrink-0" size={16} aria-hidden="true" />
      <span>{error}</span>
    </div>
  {/if}

  <div class="grid gap-2">
    <label class="grid gap-1.5">
      <span class="text-sm font-medium">{tr('importText')}</span>
      <textarea
        class="textarea min-h-24 w-full font-mono text-sm leading-relaxed"
        bind:value={pasteText}
        placeholder="otpauth://totp/..."
        spellcheck="false"
        disabled={busy}
      ></textarea>
    </label>
    <button
      class="btn btn-primary btn-block btn-sm"
      type="button"
      onclick={importPastedText}
      disabled={busy || !pasteText.trim()}
    >
      <Upload size={15} aria-hidden="true" />
      {tr('import')}
    </button>
  </div>
</section>
