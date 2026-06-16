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

<article class="card card-sm border border-base-300 bg-base-100 shadow-sm">
  <div class="card-body gap-3 p-3">
    <div class="flex min-w-0 items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <h2 class="card-title min-w-0 text-base leading-tight break-words">{account.label}</h2>
        {#if account.pinned}
          <span class="badge badge-primary badge-sm">{tr('pinned')}</span>
        {/if}
        </div>
        <p class="mt-1 truncate text-sm text-base-content/65">{account.issuer || typeLabel}</p>
      </div>

      <span class="badge badge-outline shrink-0">{typeLabel}</span>
    </div>

    <button
      class="btn min-h-14 w-full border-base-300 bg-base-200 font-mono text-2xl font-black tracking-normal"
      type="button"
      onclick={() => code && oncopy(account, code.value)}
      aria-label={tr('copy')}
      disabled={!code}
    >
      {displayCode}
    </button>

    {#if account.type !== 'hotp' && code}
      <div class="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-2 text-xs font-semibold text-base-content/70">
        <progress class="progress progress-primary h-1.5" value={code.progress} max="100"></progress>
        <span class="text-right tabular-nums">{code.remaining}s</span>
      </div>
    {/if}

    <div class="card-actions justify-between gap-2 border-t border-base-300 pt-2">
      <div class="flex gap-1">
        <div class="tooltip" data-tip={tr('copy')}>
          <button class="btn btn-ghost btn-sm btn-square" type="button" aria-label={tr('copy')} onclick={() => code && oncopy(account, code.value)} disabled={!code}>
            <Copy size={18} aria-hidden="true" />
          </button>
        </div>
        {#if account.type === 'hotp'}
          <div class="tooltip" data-tip={tr('next')}>
            <button class="btn btn-ghost btn-sm btn-square" type="button" aria-label={tr('next')} onclick={() => onnext(account)}>
              <StepForward size={18} aria-hidden="true" />
            </button>
          </div>
        {/if}
        <div class="tooltip" data-tip={tr('showQr')}>
          <button class="btn btn-ghost btn-sm btn-square" type="button" aria-label={tr('showQr')} onclick={() => onqr(account)}>
            <QrCode size={18} aria-hidden="true" />
          </button>
        </div>
        <div class="tooltip" data-tip={tr('pinned')}>
          <button class="btn btn-ghost btn-sm btn-square" type="button" aria-label={tr('pinned')} onclick={() => onpin(account)}>
            {#if account.pinned}
              <PinOff size={18} aria-hidden="true" />
            {:else}
              <Pin size={18} aria-hidden="true" />
            {/if}
          </button>
        </div>
      </div>

      <div class="flex gap-1">
        <div class="tooltip" data-tip={tr('edit')}>
          <button class="btn btn-ghost btn-sm btn-square" type="button" aria-label={tr('edit')} onclick={() => onedit(account)}>
            <Edit3 size={18} aria-hidden="true" />
          </button>
        </div>
        <div class="tooltip tooltip-left" data-tip={tr('delete')}>
          <button class="btn btn-ghost btn-sm btn-square text-error" type="button" aria-label={tr('delete')} onclick={() => ondelete(account)}>
            <Trash2 size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </div>
</article>
