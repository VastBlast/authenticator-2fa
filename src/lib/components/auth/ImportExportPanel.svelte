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

  let activeTab = $state<'import' | 'export'>('import');
  let importText = $state('');
  let importPassword = $state('');
  let exportPassword = $state('');
  let status = $state('');
  let error = $state('');
  let busy = $state(false);

  async function runImport() {
    await run(async () => {
      const result = await onimport(importText);
      status = `${result.imported} imported, ${result.skipped} skipped.`;
      importText = '';
    });
  }

  async function importEncryptedFile(event: Event) {
    const text = await readFirstFile(event);
    if (!text) {
      return;
    }
    await run(async () => {
      const result = await onimportencrypted(text, importPassword);
      status = `${result.imported} imported.`;
      importPassword = '';
    });
  }

  async function importTextFile(event: Event) {
    const text = await readFirstFile(event);
    if (!text) {
      return;
    }
    importText = text;
    await runImport();
  }

  async function importQrImages(event: Event) {
    const target = event.target as HTMLInputElement;
    if (!target.files?.length) {
      return;
    }

    await run(async () => {
      const decoded = await decodeQrFiles(target.files ?? []);
      const result = await onimport(decoded.join('\n'));
      status = `${result.imported} imported from QR image${decoded.length === 1 ? '' : 's'}.`;
    });
  }

  function exportOtpText() {
    downloadBlob(exportPlainOtpAuth(accounts), 'authenticator-otpauth.txt');
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
    return file ? file.text() : '';
  }
</script>

<section class="panel">
  <div role="tablist" class="tabs tabs-box">
    <button
      role="tab"
      class={['tab', activeTab === 'import' && 'tab-active']}
      type="button"
      onclick={() => (activeTab = 'import')}
    >
      {tr('import')}
    </button>
    <button
      role="tab"
      class={['tab', activeTab === 'export' && 'tab-active']}
      type="button"
      onclick={() => (activeTab = 'export')}
    >
      {tr('export')}
    </button>
  </div>

  {#if activeTab === 'import'}
    <div class="form-stack">
      <label class="field">
        <span>{tr('importText')}</span>
        <textarea class="textarea import-textarea" bind:value={importText} spellcheck="false"></textarea>
      </label>
      <button class="btn btn-primary" type="button" onclick={runImport} disabled={busy || !importText.trim()}>
        <Upload size={16} aria-hidden="true" />
        {tr('import')}
      </button>

      <div class="file-row">
        <label class="file-action">
          <FileText size={18} aria-hidden="true" />
          <span>{tr('import')}</span>
          <input type="file" accept=".txt,.json,text/plain,application/json" onchange={importTextFile} />
        </label>
        <label class="file-action">
          <ImageUp size={18} aria-hidden="true" />
          <span>{tr('qrImage')}</span>
          <input type="file" accept="image/*" multiple onchange={importQrImages} />
        </label>
      </div>

      <label class="field">
        <span>{tr('backupPassword')}</span>
        <input class="input" type="password" bind:value={importPassword} />
      </label>
      <label class="file-action wide">
        <FileJson size={18} aria-hidden="true" />
        <span>{tr('importEncrypted')}</span>
        <input type="file" accept=".json,application/json" onchange={importEncryptedFile} />
      </label>
    </div>
  {:else}
    <div class="form-stack">
      <div class="alert alert-warning" role="alert">{tr('plainWarning')}</div>
      <button class="btn" type="button" onclick={exportOtpText} disabled={accounts.length === 0}>
        <Download size={16} aria-hidden="true" />
        {tr('exportOtp')}
      </button>

      <label class="field">
        <span>{tr('backupPassword')}</span>
        <input class="input" type="password" bind:value={exportPassword} />
      </label>
      <button class="btn btn-primary" type="button" onclick={exportEncrypted} disabled={accounts.length === 0 || !exportPassword}>
        <Download size={16} aria-hidden="true" />
        {tr('exportEncrypted')}
      </button>
    </div>
  {/if}

  {#if status}
    <div class="alert alert-success" role="status">{status}</div>
  {/if}
  {#if error}
    <div class="alert alert-error" role="alert">{error}</div>
  {/if}
</section>
