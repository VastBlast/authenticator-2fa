<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { prefersReducedMotion } from 'svelte/motion';
  import { fade } from 'svelte/transition';
  import type { LucideIcon } from '@lucide/svelte';
  import Check from '@lucide/svelte/icons/check';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import Cloud from '@lucide/svelte/icons/cloud';
  import CloudAlert from '@lucide/svelte/icons/cloud-alert';
  import CloudCheck from '@lucide/svelte/icons/cloud-check';
  import CloudOff from '@lucide/svelte/icons/cloud-off';
  import CloudSync from '@lucide/svelte/icons/cloud-sync';
  import Copy from '@lucide/svelte/icons/copy';
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import Info from '@lucide/svelte/icons/info';
  import KeyRound from '@lucide/svelte/icons/key-round';
  import ListChecks from '@lucide/svelte/icons/list-checks';
  import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
  import Plus from '@lucide/svelte/icons/plus';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import Trash from '@lucide/svelte/icons/trash';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import Unplug from '@lucide/svelte/icons/unplug';
  import ViewHeader from './ViewHeader.svelte';
  import { FADE_TRANSITION, PANEL_TRANSITION, panelReveal } from './transitions';
  import { getSyncStatusKey, getSyncStatusTone, SYNC_STATUS_DOT } from './syncStatus';
  import { generateSyncRecoveryKey, parseSyncRecoveryKey } from '../../auth/browserSync';
  import { authenticatorVault as vault } from '../../state/authenticator.svelte';
  import { tr, type MessageKey } from '../../i18n/messages';

  interface Props {
    onclose: () => void;
    onprotect: () => void;
  }

  type Mode = 'idle' | 'create' | 'join';
  type Confirmation = 'stop' | 'delete';

  const ERROR_MESSAGES = {
    unavailable: 'syncUnavailable',
    passwordRequired: 'syncProtectionRequired',
    invalidKey: 'syncWrongKey',
    notFound: 'syncNoData',
    quota: 'syncQuota',
    invalidData: 'syncInvalidData',
    storage: 'syncFailed'
  } as const satisfies Record<Exclude<typeof vault.syncError, ''>, MessageKey>;
  // Format hint only; the parser accepts any spacing or dashes.
  const KEY_PLACEHOLDER = 'A2FA1-XXXX-XXXX-XXXX-…';
  const COPIED_RESET_MS = 2000;

  let { onclose, onprotect }: Props = $props();
  let mode = $state<Mode>('idle');
  let recoveryKey = $state('');
  let keySaved = $state(false);
  let showKey = $state(false);
  let copied = $state(false);
  let working = $state(false);
  let confirmation = $state<Confirmation | null>(null);
  let localError = $state<MessageKey | null>(null);
  let keyInput = $state<HTMLTextAreaElement | undefined>();
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  const pending = $derived(working || vault.busy || vault.syncStatus === 'syncing');
  const syncErrorMessage = $derived(vault.syncError ? tr(ERROR_MESSAGES[vault.syncError]) : '');
  const localErrorMessage = $derived(localError ? tr(localError) : '');
  const hasHotp = $derived(vault.accounts.some((account) => account.type === 'hotp'));
  const statusTone = $derived(getSyncStatusTone(vault.syncStatus));
  const statusLabel = $derived(tr(getSyncStatusKey(vault.syncStatus)));

  onDestroy(() => clearTimeout(copiedTimer));

  function setCopied(value: boolean) {
    clearTimeout(copiedTimer);
    copied = value;
    if (value) {
      copiedTimer = setTimeout(() => (copied = false), COPIED_RESET_MS);
    }
  }

  async function selectMode(next: Mode) {
    localError = null;
    setCopied(false);
    keySaved = false;
    recoveryKey = '';
    // Leaving an abandoned attempt dismisses its error; nothing is connected yet.
    if (next === 'idle' && !vault.syncEnabled) vault.syncError = '';
    try {
      if (next === 'create') recoveryKey = generateSyncRecoveryKey();
      mode = next;
      if (next === 'join') {
        await tick();
        keyInput?.focus();
      }
    } catch {
      localError = 'syncFailed';
    }
  }

  async function connect(event: SubmitEvent) {
    event.preventDefault();
    if (pending || (mode === 'create' && !keySaved)) return;
    localError = null;
    let key: string;
    try {
      key = parseSyncRecoveryKey(recoveryKey);
    } catch {
      localError = 'syncWrongKey';
      return;
    }
    working = true;
    try {
      await vault.startBrowserSync(key, mode === 'join');
      if (vault.syncEnabled) {
        recoveryKey = '';
        keySaved = false;
        mode = 'idle';
      }
    } finally {
      working = false;
    }
  }

  async function copyKey(key: string) {
    localError = null;
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
    } catch {
      localError = 'syncKeyCopyFailed';
    }
  }

  function toggleKey() {
    showKey = !showKey;
    setCopied(false);
    localError = null;
  }

  async function disconnect() {
    if (pending || !confirmation) return;
    working = true;
    localError = null;
    try {
      if (confirmation === 'delete') await vault.deleteBrowserSync();
      else await vault.stopBrowserSync();
      if (!vault.syncEnabled) {
        confirmation = null;
        showKey = false;
        setCopied(false);
      }
    } finally {
      working = false;
    }
  }

  function submitOnEnter(event: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function goBack() {
    if (mode === 'idle') onclose();
    else void selectMode('idle');
  }

  // Content revealed near the bottom of the list should not land below the fold.
  function revealIntoView(node: HTMLElement) {
    node.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion.current ? 'auto' : 'smooth' });
  }

  function handleEscape(event: KeyboardEvent) {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    if (confirmation) confirmation = null;
    else goBack();
  }
</script>

<svelte:window onkeydown={handleEscape} />

<div class="flex h-full flex-col overflow-hidden">
  <ViewHeader title={tr('browserSync')} onback={goBack} />

  <div class="grow overflow-y-auto p-3">
    {#if vault.syncEnabled}
      <div class="space-y-4" in:fade={PANEL_TRANSITION}>
        {@render connectedView()}
      </div>
    {:else if mode === 'create'}
      <div in:fade={PANEL_TRANSITION}>
        {@render createView()}
      </div>
    {:else if mode === 'join'}
      <div in:fade={PANEL_TRANSITION}>
        {@render joinView()}
      </div>
    {:else}
      <div class="space-y-4" in:fade={PANEL_TRANSITION}>
        {@render introView()}
      </div>
    {/if}
  </div>
</div>

<!-- What sync is, followed by the single next step for this device. -->
{#snippet introView()}
  <div class="flex items-start gap-3">
    <div class="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
      <CloudSync size={22} aria-hidden="true" />
    </div>
    <div class="min-w-0 space-y-0.5 pt-0.5">
      <h2 class="text-base leading-snug font-semibold">{tr('syncDescription')}</h2>
      <p class="text-xs leading-snug text-base-content/60">{tr('syncRequirements')}</p>
    </div>
  </div>

  <ul class="space-y-2.5">
    {@render feature(LockKeyhole, tr('syncFeatureEncrypted'), false)}
    {@render feature(Cloud, tr('syncFeatureBrowser'), false)}
    {@render feature(ListChecks, tr('syncScope'), false)}
  </ul>

  {#if !vault.syncAvailable}
    {@render callout(CloudOff, tr('syncUnavailable'), 'neutral')}
  {:else if !vault.passwordProtected}
    <div class="space-y-3 rounded-box border border-base-300 bg-base-200/40 p-3">
      <div class="flex items-start gap-2.5">
        <ShieldCheck class="mt-0.5 shrink-0 text-base-content/60" size={18} aria-hidden="true" />
        <div class="min-w-0 space-y-0.5">
          <p class="text-sm font-semibold">{tr('syncProtectionTitle')}</p>
          <p class="text-xs leading-snug text-base-content/65">{tr('syncProtectionRequired')}</p>
        </div>
      </div>
      <button class="btn btn-primary btn-block btn-sm" type="button" onclick={onprotect}>
        <KeyRound size={15} aria-hidden="true" />
        {tr('setPassword')}
      </button>
    </div>
  {:else}
    <div class="space-y-2">
      {@render choice(Plus, tr('syncStart'), tr('syncStartHint'), () => selectMode('create'), false)}
      {@render choice(KeyRound, tr('syncConnect'), tr('syncConnectHint'), () => selectMode('join'), false)}
    </div>
  {/if}

  {@render errorAlert(localErrorMessage || syncErrorMessage)}
{/snippet}

<!-- First device: the key exists only here until it is saved. -->
{#snippet createView()}
  <form class="space-y-4" onsubmit={connect}>
    <div class="space-y-1">
      <h2 class="text-base font-semibold">{tr('syncCreateTitle')}</h2>
      <p class="text-xs leading-snug text-base-content/65">{tr('syncKeyUsage')}</p>
    </div>

    {@render keyDisplay(recoveryKey)}

    <div class="space-y-2.5 rounded-box border border-warning/40 bg-warning/10 p-3">
      <p class="flex items-start gap-2 text-xs leading-snug">
        <TriangleAlert class="mt-px shrink-0 text-warning" size={14} aria-hidden="true" />
        <span>{tr('syncRecoveryHint')}</span>
      </p>
      <label class="flex cursor-pointer items-start gap-2.5 text-sm font-medium">
        <input class="checkbox checkbox-sm checkbox-warning mt-0.5 shrink-0" type="checkbox" bind:checked={keySaved} disabled={pending} />
        <span>{tr('syncSavedKey')}</span>
      </label>
    </div>

    {#if hasHotp}
      {@render callout(TriangleAlert, tr('syncHotpWarning'), 'warning')}
    {/if}
    {@render errorAlert(localErrorMessage || syncErrorMessage)}

    <div class="grid grid-cols-2 gap-2">
      <button class="btn" type="button" onclick={() => selectMode('idle')} disabled={pending}>{tr('cancel')}</button>
      <button class="btn btn-primary h-auto min-h-10 py-1 whitespace-normal" type="submit" disabled={pending || !keySaved}>
        {#if pending}
          <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
        {/if}
        {tr('syncEnable')}
      </button>
    </div>
  </form>
{/snippet}

<!-- Additional device: the key comes from a device that already syncs. -->
{#snippet joinView()}
  <form class="space-y-4" onsubmit={connect}>
    <div class="space-y-1">
      <h2 class="text-base font-semibold">{tr('syncJoinTitle')}</h2>
      <p class="text-xs leading-snug text-base-content/65">{tr('syncJoinHint')}</p>
    </div>

    <label class="block space-y-1.5">
      <span class="text-sm font-medium">{tr('syncRecoveryKey')}</span>
      <textarea
        class="auth-recovery-key textarea w-full resize-none font-mono tracking-wide"
        rows="3"
        bind:this={keyInput}
        bind:value={recoveryKey}
        placeholder={KEY_PLACEHOLDER}
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        dir="ltr"
        disabled={pending}
        oninput={() => (localError = null)}
        onkeydown={submitOnEnter}
      ></textarea>
    </label>

    {#if hasHotp}
      {@render callout(TriangleAlert, tr('syncHotpWarning'), 'warning')}
    {/if}
    {@render errorAlert(localErrorMessage || syncErrorMessage)}

    <div class="grid grid-cols-2 gap-2">
      <button class="btn" type="button" onclick={() => selectMode('idle')} disabled={pending}>{tr('cancel')}</button>
      <button class="btn btn-primary" type="submit" disabled={pending || !recoveryKey.trim()}>
        {#if pending}
          <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
        {/if}
        {tr('syncJoinSubmit')}
      </button>
    </div>
  </form>
{/snippet}

{#snippet connectedView()}
  <div
    class={[
      'rounded-box border p-3',
      statusTone === 'attention' ? 'border-warning/40 bg-warning/10' : 'border-base-300 bg-base-200/40'
    ]}
  >
    <div class="flex items-center gap-3">
      <div
        class={[
          'grid size-10 shrink-0 place-items-center rounded-xl',
          statusTone === 'attention' && 'bg-warning/20 text-warning',
          statusTone === 'progress' && 'bg-primary/10 text-primary',
          statusTone !== 'attention' && statusTone !== 'progress' && 'bg-success/15 text-success'
        ]}
      >
        {#if statusTone === 'progress'}
          <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
        {:else if statusTone === 'attention'}
          <CloudAlert size={20} aria-hidden="true" />
        {:else}
          <CloudCheck size={20} aria-hidden="true" />
        {/if}
      </div>
      <div class="min-w-0 grow">
        <p class="text-sm font-semibold">{tr('syncConnected')}</p>
        <p class="flex items-center gap-1.5 text-xs text-base-content/70" role="status">
          <span class={['size-2 shrink-0 rounded-full', SYNC_STATUS_DOT[statusTone]]} aria-hidden="true"></span>
          {statusLabel}
        </p>
      </div>
      <button
        class="btn btn-ghost btn-sm btn-circle shrink-0"
        type="button"
        aria-label={tr('syncSyncNow')}
        title={tr('syncSyncNow')}
        onclick={() => vault.syncNow()}
        disabled={pending}
      >
        <RefreshCw size={16} aria-hidden="true" />
      </button>
    </div>
    {#if syncErrorMessage}
      <p class="mt-2.5 border-t border-warning/30 pt-2.5 text-xs leading-snug" role="alert" transition:fade={FADE_TRANSITION}>
        {syncErrorMessage}
      </p>
    {/if}
  </div>

  <ul class="space-y-2">
    {@render feature(Info, tr('syncDeliveryHint'), true)}
    {@render feature(ListChecks, tr('syncScope'), true)}
  </ul>
  {#if hasHotp}
    {@render callout(TriangleAlert, tr('syncHotpWarning'), 'warning')}
  {/if}

  <section class="space-y-2">
    <h3 class="text-xs font-bold tracking-wide uppercase text-base-content/50">{tr('syncRecoveryKey')}</h3>
    <p class="text-xs leading-snug text-base-content/65">{tr('syncKeyUsage')}</p>
    <button class="btn btn-block btn-sm" type="button" aria-expanded={showKey} onclick={toggleKey}>
      {#if showKey}
        <EyeOff size={15} aria-hidden="true" />
        {tr('syncHideKey')}
      {:else}
        <Eye size={15} aria-hidden="true" />
        {tr('syncShowKey')}
      {/if}
    </button>
    {#if showKey}
      <div transition:panelReveal {@attach revealIntoView}>
        {@render keyDisplay(vault.syncRecoveryKey)}
      </div>
    {/if}
    {@render errorAlert(localErrorMessage)}
  </section>

  <section class="space-y-2 border-t border-base-300 pt-4">
    {#if confirmation}
      {@const deleting = confirmation === 'delete'}
      <div
        class={['space-y-2.5 rounded-box border p-3', deleting ? 'border-error/30 bg-error/5' : 'border-base-300 bg-base-200/40']}
        in:panelReveal
        {@attach revealIntoView}
      >
        <p class={['text-sm font-semibold', deleting && 'text-error']}>{deleting ? tr('syncDelete') : tr('syncStop')}</p>
        <p class="text-xs leading-snug text-base-content/70">{deleting ? tr('syncDeleteHint') : tr('syncStopHint')}</p>
        <div class="grid grid-cols-2 gap-2 pt-0.5">
          <button class="btn btn-sm" type="button" onclick={() => (confirmation = null)} disabled={pending}>{tr('cancel')}</button>
          <button
            class={['btn btn-sm h-auto min-h-8 py-1 whitespace-normal', deleting ? 'btn-error' : 'btn-primary']}
            type="button"
            onclick={disconnect}
            disabled={pending}
          >
            {#if working}
              <span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
            {/if}
            {deleting ? tr('syncDelete') : tr('syncStopConfirm')}
          </button>
        </div>
      </div>
    {:else}
      {@render choice(Unplug, tr('syncStop'), tr('syncStopDescription'), () => (confirmation = 'stop'), false)}
      {@render choice(Trash, tr('syncDelete'), tr('syncDeleteDescription'), () => (confirmation = 'delete'), true)}
    {/if}
  </section>
{/snippet}

<!-- Compact rows are reminders on the status screen; full rows introduce the feature. -->
{#snippet feature(FeatureIcon: LucideIcon, text: string, compact: boolean)}
  <li class="flex items-start gap-2.5">
    <FeatureIcon class={compact ? 'mt-px shrink-0 text-base-content/50' : 'mt-0.5 shrink-0 text-base-content/55'} size={compact ? 14 : 15} aria-hidden="true" />
    <span class={compact ? 'text-xs leading-snug text-base-content/65' : 'text-sm leading-snug text-base-content/80'}>{text}</span>
  </li>
{/snippet}

<!-- A full-row action with a one-line explanation of its consequence. -->
{#snippet choice(ChoiceIcon: LucideIcon, title: string, hint: string, onclick: () => void, danger: boolean)}
  <button
    class={[
      'flex w-full items-center gap-3 rounded-box border border-base-300 p-3 text-start transition-[background-color,transform] duration-150 hover:bg-base-200/50 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-60 motion-reduce:active:scale-100',
      danger && 'text-error'
    ]}
    type="button"
    {onclick}
    disabled={pending}
  >
    <span class={['grid size-9 shrink-0 place-items-center rounded-xl', danger ? 'bg-error/10' : 'bg-base-200 text-base-content/80']}>
      <ChoiceIcon size={18} aria-hidden="true" />
    </span>
    <span class="min-w-0 grow">
      <span class="block text-sm font-semibold">{title}</span>
      <span class={['block text-xs leading-snug', danger ? 'text-error/70' : 'text-base-content/60']}>{hint}</span>
    </span>
    <ChevronRight class="shrink-0 opacity-40" size={16} aria-hidden="true" />
  </button>
{/snippet}

{#snippet keyDisplay(key: string)}
  <div class="space-y-2.5 rounded-box border border-base-300 bg-base-200/40 p-3">
    <!-- A read-only field keeps the key reachable by Tab and selectable with the
         keyboard when clipboard access is unavailable. -->
    <textarea
      class="auth-recovery-key block w-full resize-none rounded-field border-0 bg-transparent p-0 font-mono tracking-wide wrap-anywhere field-sizing-content"
      rows="2"
      readonly
      value={key}
      dir="ltr"
      spellcheck="false"
      aria-label={tr('syncRecoveryKey')}
      onfocus={(event) => event.currentTarget.select()}
      onclick={(event) => event.currentTarget.select()}
    ></textarea>
    <button class="btn btn-block btn-sm" type="button" onclick={() => copyKey(key)}>
      {#if copied}
        <Check class="text-success" size={15} aria-hidden="true" />
        {tr('copied')}
      {:else}
        <Copy size={15} aria-hidden="true" />
        {tr('copy')}
      {/if}
    </button>
  </div>
{/snippet}

{#snippet callout(CalloutIcon: LucideIcon, text: string, tone: 'warning' | 'neutral')}
  <div
    class={[
      'flex items-start gap-2 rounded-box border p-3 text-xs leading-snug',
      tone === 'warning' ? 'border-warning/40 bg-warning/10' : 'border-base-300 bg-base-200/40 text-base-content/75'
    ]}
  >
    <CalloutIcon class={tone === 'warning' ? 'mt-px shrink-0 text-warning' : 'mt-px shrink-0'} size={14} aria-hidden="true" />
    <span>{text}</span>
  </div>
{/snippet}

{#snippet errorAlert(message: string)}
  {#if message}
    <div class="flex items-start gap-2 rounded-box border border-error/30 bg-error/5 p-3 text-sm text-error" role="alert" transition:fade={FADE_TRANSITION}>
      <CircleAlert class="mt-0.5 shrink-0" size={15} aria-hidden="true" />
      <span class="leading-snug">{message}</span>
    </div>
  {/if}
{/snippet}
