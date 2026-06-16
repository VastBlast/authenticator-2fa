<script lang="ts">
  import { EllipsisVertical, GripVertical, RefreshCw } from '@lucide/svelte';
  import CountdownRing from './CountdownRing.svelte';
  import { authenticatorVault as vault } from '../../state/authenticator.svelte';
  import { tr } from '../../i18n/messages';
  import type { AuthenticatorAccount, OtpCode } from '../../auth/types';

  interface Props {
    account: AuthenticatorAccount;
    code?: OtpCode;
    reorderDisabled?: boolean;
    dragging?: boolean;
    dragStyle?: string;
    onactions: (account: AuthenticatorAccount) => void;
    onreorderstart: (account: AuthenticatorAccount, event: PointerEvent) => void;
    onreorderkey: (account: AuthenticatorAccount, event: KeyboardEvent) => void;
    onreorderblur: (account: AuthenticatorAccount) => void;
  }

  let {
    account,
    code,
    reorderDisabled = false,
    dragging = false,
    dragStyle = '',
    onactions,
    onreorderstart,
    onreorderkey,
    onreorderblur
  }: Props = $props();

  const value = $derived(code?.value ?? '');
  const displayCode = $derived(value ? groupDigits(value) : '••••••');
  const expiring = $derived(account.type !== 'hotp' && (code?.remaining ?? 99) <= 5);
  const title = $derived(account.issuer ? `${account.issuer} ${account.label}` : account.label);

  async function copy() {
    if (!value) {
      return;
    }
    await navigator.clipboard.writeText(value);
    vault.notice = tr('copied');
  }

  function groupDigits(raw: string): string {
    if (/\D/.test(raw)) {
      return raw; // Steam / non-numeric codes stay intact.
    }
    if (raw.length === 8) {
      return `${raw.slice(0, 4)} ${raw.slice(4)}`;
    }
    return raw.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
  }
</script>

<li
  class={[
    'flex items-center transition-colors',
    dragging && 'bg-base-100 shadow-lg ring-1 ring-primary/30'
  ]}
  style={dragStyle}
  aria-label={title}
  data-account-id={account.id}
>
  <button
    class={[
      'btn btn-ghost btn-sm btn-square m-1 shrink-0 touch-none text-base-content/45',
      reorderDisabled ? 'pointer-events-none opacity-35' : 'cursor-grab hover:text-base-content active:cursor-grabbing'
    ]}
    type="button"
    disabled={reorderDisabled}
    aria-label={`${tr('reorderAccount')}: ${title}`}
    aria-pressed={dragging}
    title={tr('reorderAccount')}
    onpointerdown={(event) => onreorderstart(account, event)}
    onkeydown={(event) => onreorderkey(account, event)}
    onblur={() => onreorderblur(account)}
  >
    <GripVertical size={18} aria-hidden="true" />
  </button>

  <button
    class="flex min-w-0 grow items-center gap-3 px-2 py-2.5 text-left transition-colors hover:bg-base-200/70 focus-visible:bg-base-200/70 focus:outline-none"
    type="button"
    onclick={copy}
    disabled={!value}
    aria-label={tr('copy')}
  >
    <span class="flex min-w-0 grow flex-col">
      <span class="flex min-w-0 items-center gap-1.5 text-sm leading-tight text-base-content/60">
        <span class="truncate font-medium text-base-content/80">{account.issuer || account.label}</span>
        {#if account.issuer && account.label}
          <span class="truncate">{account.label}</span>
        {/if}
      </span>
      <span
        class={[
          'font-mono text-3xl font-semibold leading-snug tracking-[0.1em] tabular-nums',
          expiring ? 'text-error' : 'text-primary'
        ]}
      >
        {displayCode}
      </span>
    </span>

    {#if account.type === 'hotp'}
      <span class="badge badge-ghost shrink-0">#{account.counter}</span>
    {:else if code}
      <CountdownRing remaining={code.remaining} period={account.period} />
    {/if}
  </button>

  <div class="flex shrink-0 items-center pr-1.5">
    {#if account.type === 'hotp'}
      <button
        class="btn btn-ghost btn-sm btn-circle"
        type="button"
        aria-label={tr('next')}
        title={tr('next')}
        onclick={() => vault.advanceHotp(account.id)}
      >
        <RefreshCw size={16} aria-hidden="true" />
      </button>
    {/if}
    <button
      class="btn btn-ghost btn-sm btn-circle text-base-content/45 hover:text-base-content"
      type="button"
      aria-label={tr('edit')}
      onclick={() => onactions(account)}
    >
      <EllipsisVertical size={18} aria-hidden="true" />
    </button>
  </div>
</li>
