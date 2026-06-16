<script lang="ts">
  import { Copy, Edit3, Pin, PinOff, QrCode, StepForward, Trash2 } from '@lucide/svelte';
  import type { AuthenticatorAccount, OtpCode } from '../../auth/types';
  import type { MessageKey } from '../../i18n/messages';

  interface Props {
    account: AuthenticatorAccount;
    code?: OtpCode;
    copyWithSpaces: boolean;
    tr: (key: MessageKey) => string;
    oncopy: (account: AuthenticatorAccount, code: string) => void;
    onnext: (account: AuthenticatorAccount) => void;
    onedit: (account: AuthenticatorAccount) => void;
    ondelete: (account: AuthenticatorAccount) => void;
    onpin: (account: AuthenticatorAccount) => void;
    onqr: (account: AuthenticatorAccount) => void;
  }

  let {
    account,
    code,
    copyWithSpaces,
    tr,
    oncopy,
    onnext,
    onedit,
    ondelete,
    onpin,
    onqr
  }: Props = $props();

  const displayCode = $derived(formatCode(code?.value ?? '------', copyWithSpaces));
  const typeLabel = $derived(account.type === 'hotp' ? tr('hotp') : account.type === 'steam' ? tr('steam') : tr('totp'));

  function formatCode(value: string, withSpaces: boolean): string {
    if (!withSpaces || value.length < 6 || /[A-Z]/.test(value)) {
      return value;
    }
    return value.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
  }
</script>

<article class="card account-card">
  <div class="account-main">
    <div class="account-meta">
      <div class="account-title-row">
        <h2 class="account-title">{account.label}</h2>
        {#if account.pinned}
          <span class="badge badge-primary badge-sm">{tr('pinned')}</span>
        {/if}
      </div>
      <p>{account.issuer || typeLabel}</p>
    </div>

    <button
      class="code-button"
      type="button"
      onclick={() => code && oncopy(account, code.value)}
      aria-label={tr('copy')}
      disabled={!code}
    >
      {displayCode}
    </button>
  </div>

  {#if account.type !== 'hotp' && code}
    <div class="timer-row">
      <progress class="progress progress-primary" value={code.progress} max="100"></progress>
      <span>{code.remaining}s</span>
    </div>
  {/if}

  <div class="account-actions">
    <button class="btn btn-ghost btn-sm btn-square" type="button" title={tr('copy')} onclick={() => code && oncopy(account, code.value)}>
      <Copy size={18} aria-hidden="true" />
    </button>
    {#if account.type === 'hotp'}
      <button class="btn btn-ghost btn-sm btn-square" type="button" title={tr('next')} onclick={() => onnext(account)}>
        <StepForward size={18} aria-hidden="true" />
      </button>
    {/if}
    <button class="btn btn-ghost btn-sm btn-square" type="button" title={tr('showQr')} onclick={() => onqr(account)}>
      <QrCode size={18} aria-hidden="true" />
    </button>
    <button class="btn btn-ghost btn-sm btn-square" type="button" title={tr('pinned')} onclick={() => onpin(account)}>
      {#if account.pinned}
        <PinOff size={18} aria-hidden="true" />
      {:else}
        <Pin size={18} aria-hidden="true" />
      {/if}
    </button>
    <button class="btn btn-ghost btn-sm btn-square" type="button" title={tr('edit')} onclick={() => onedit(account)}>
      <Edit3 size={18} aria-hidden="true" />
    </button>
    <button class="btn btn-ghost btn-sm btn-square danger-button" type="button" title={tr('delete')} onclick={() => ondelete(account)}>
      <Trash2 size={18} aria-hidden="true" />
    </button>
  </div>
</article>
