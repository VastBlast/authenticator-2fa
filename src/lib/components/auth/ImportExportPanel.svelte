<script lang="ts">
  import { Download, FileJson, FileText, ImageUp, Upload } from '@lucide/svelte';
  import { downloadBlob, exportEncryptedBackup, exportPlainOtpAuth } from '../../auth/backup';
  import { decodeQrFiles } from '../../auth/qr';
  import type { AppSettings, AuthenticatorAccount, ImportResult } from '../../auth/types';
  import type { MessageKey } from '../../i18n/messages';

  interface Props {
    accounts: AuthenticatorAccount[];
    settings: AppSettings;
    tr: (key: MessageKey) => string;
    onimport: (text: string) => Promise<ImportResult>;
    onimportencrypted: (text: string, password: string) => Promise<ImportResult>;
  }

  let { accounts, settings, tr, onimport, onimportencrypted }: Props = $props();

  let importText = $state('');
  let importPassword = $state('');
  let exportPassword = $state('');
  let status = $state('');
  let error = $state('');
  let busy = $state(false);

  async function runImport() {
    if (!importText.trim()) {
      error = 'Paste authenticator text before importing.';
      status = '';
      return;
    }

    await run(async () => {
      const result = await onimport(importText);
      setImportStatus(result);
      if (result.imported > 0) {
        importText = '';
      }
    });
  }

  async function importEncryptedFile(event: Event) {
    if (!importPassword) {
      error = 'Enter the backup password before selecting the encrypted backup.';
      status = '';
      resetFileInput(event);
      return;
    }

    const text = await readFirstFile(event);
    if (!text) {
      return;
    }
    await run(async () => {
      const result = await onimportencrypted(text, importPassword);
      setImportStatus(result);
      importPassword = '';
    });
  }

  async function importTextFile(event: Event) {
    const text = await readFirstFile(event);
    if (!text) {
      return;
    }

    await run(async () => {
      status = 'Reading import file.';
      const result = await onimport(text);
      setImportStatus(result);
    });
  }

  async function importQrImages(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = Array.from(target.files ?? []);
    target.value = '';
    if (files.length === 0) {
      return;
    }

    await run(async () => {
      status = 'Reading QR image.';
      const decoded = await decodeQrFiles(files);
      const result = await onimport(decoded.join('\n'));
      setImportStatus(result, ` from QR image${decoded.length === 1 ? '' : 's'}`);
    });
  }

  function exportOtpText() {
    downloadBlob(exportPlainOtpAuth(accounts), 'authenticator-otpauth.txt');
    status = 'Plain otpauth export downloaded.';
    error = '';
  }

  async function exportEncrypted() {
    await run(async () => {
      const blob = await exportEncryptedBackup(accounts, settings, exportPassword);
      downloadBlob(blob, 'authenticator-encrypted-backup.json');
      exportPassword = '';
      status = 'Encrypted backup exported.';
    });
  }

  async function run(action: () => Promise<void>) {
    busy = true;
    status = '';
    error = '';
    try {
      await action();
    } catch (actionError) {
      error = actionError instanceof Error ? actionError.message : 'Operation failed.';
    } finally {
      busy = false;
    }
  }

  async function readFirstFile(event: Event): Promise<string> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    target.value = '';
    return file ? file.text() : '';
  }

  function resetFileInput(event: Event): void {
    (event.target as HTMLInputElement).value = '';
  }

  function setImportStatus(result: ImportResult, source = ''): void {
    if (result.imported === 0) {
      error = result.errors[0] ?? (result.skipped > 0 ? 'No new accounts were imported.' : 'No accounts found to import.');
      status = '';
      return;
    }

    const skipped = result.skipped > 0 ? `, ${result.skipped} skipped` : '';
    status = `${result.imported} imported${source}${skipped}.`;
  }
</script>

<section class="grid gap-4">
  <div class="grid gap-1">
    <h2 class="text-base font-bold leading-tight">{tr('importTitle')}</h2>
    <p class="text-sm leading-snug text-base-content/65">{tr('importText')}</p>
  </div>

  <div class="grid gap-3">
    <label class="grid gap-1.5 text-sm font-semibold">
      <span>{tr('manual')}</span>
      <textarea
        class="textarea min-h-36 w-full font-mono text-sm leading-relaxed"
        bind:value={importText}
        placeholder="otpauth://totp/..."
        spellcheck="false"
      ></textarea>
    </label>

    <button class="btn btn-primary btn-block" type="button" onclick={runImport} disabled={busy || !importText.trim()}>
      <Upload size={16} aria-hidden="true" />
      {#if busy}
        <span class="loading loading-spinner loading-sm"></span>
      {/if}
      {tr('import')}
    </button>

    <div class="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
      <label class="grid gap-1.5 text-sm font-semibold">
        <span class="flex min-w-0 items-center gap-2">
          <FileText size={16} aria-hidden="true" />
          {tr('importFile')}
        </span>
        <input
          class="file-input"
          type="file"
          accept=".txt,.json,text/plain,application/json"
          disabled={busy}
          onchange={importTextFile}
        />
      </label>

      <label class="grid gap-1.5 text-sm font-semibold">
        <span class="flex min-w-0 items-center gap-2">
          <ImageUp size={16} aria-hidden="true" />
          {tr('qrImage')}
        </span>
        <input class="file-input" type="file" accept="image/*" multiple disabled={busy} onchange={importQrImages} />
      </label>
    </div>

    <div class="grid gap-3 rounded-box border border-base-300 bg-base-200/50 p-3">
      <label class="grid gap-1.5 text-sm font-semibold">
        <span>{tr('backupPassword')}</span>
        <input class="input w-full" type="password" bind:value={importPassword} autocomplete="current-password" />
      </label>

      <label class="grid gap-1.5 text-sm font-semibold">
        <span class="flex min-w-0 items-center gap-2">
          <FileJson size={16} aria-hidden="true" />
          {tr('importEncrypted')}
        </span>
        <input class="file-input" type="file" accept=".json,application/json" disabled={busy} onchange={importEncryptedFile} />
      </label>
    </div>
  </div>

  {#if status}
    <div class="alert alert-success py-2 text-sm" role="status">{status}</div>
  {/if}
  {#if error}
    <div class="alert alert-error py-2 text-sm" role="alert">{error}</div>
  {/if}

  <div class="border-t border-base-300"></div>

  <div class="grid gap-1">
    <h2 class="text-base font-bold leading-tight">{tr('exportTitle')}</h2>
  </div>

  <div class="grid gap-3">
    <div class="alert alert-warning py-2 text-sm" role="alert">{tr('plainWarning')}</div>

    <button class="btn btn-block" type="button" onclick={exportOtpText} disabled={accounts.length === 0 || busy}>
      <Download size={16} aria-hidden="true" />
      {tr('exportOtp')}
    </button>

    <label class="grid gap-1.5 text-sm font-semibold">
      <span>{tr('backupPassword')}</span>
      <input class="input w-full" type="password" bind:value={exportPassword} autocomplete="new-password" />
    </label>

    <button class="btn btn-primary btn-block" type="button" onclick={exportEncrypted} disabled={accounts.length === 0 || !exportPassword || busy}>
      <Download size={16} aria-hidden="true" />
      {tr('exportEncrypted')}
    </button>
  </div>
</section>
