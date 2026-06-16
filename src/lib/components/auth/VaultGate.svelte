<script lang="ts">
  import { KeyRound, LockKeyhole } from '@lucide/svelte';
  import type { MessageKey } from '../../i18n/messages';

  interface Props {
    hasVault: boolean;
    busy: boolean;
    tr: (key: MessageKey) => string;
    oncreate: (password: string) => void | Promise<void>;
    onunlock: (password: string) => void | Promise<void>;
  }

  let { hasVault, busy, tr, oncreate, onunlock }: Props = $props();
  let password = $state('');
  let confirmation = $state('');
  let localError = $state('');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    localError = '';

    if (!hasVault && password !== confirmation) {
      localError = 'Passwords do not match.';
      return;
    }

    if (hasVault) {
      await onunlock(password);
    } else {
      await oncreate(password);
    }
  }
</script>

<section class="grid min-h-dvh place-items-center py-6">
  <div class="grid w-full max-w-sm gap-5">
    <div class="grid gap-3">
      <div class="grid size-14 place-items-center rounded-box bg-primary text-primary-content shadow-sm">
        {#if hasVault}
          <LockKeyhole size={32} aria-hidden="true" />
        {:else}
          <KeyRound size={32} aria-hidden="true" />
        {/if}
      </div>
      <div class="grid gap-1">
        <h1 class="text-2xl font-bold leading-tight">{hasVault ? tr('unlockTitle') : tr('setupTitle')}</h1>
        <p class="text-sm leading-snug text-base-content/65">{tr('tagline')}</p>
      </div>
    </div>

    <form class="grid gap-3" onsubmit={submit}>
      <label class="grid gap-1.5 text-sm font-semibold">
        <span>{hasVault ? tr('password') : tr('newPassword')}</span>
        <input class="input w-full" type="password" bind:value={password} autocomplete="current-password" required />
      </label>

      {#if !hasVault}
        <label class="grid gap-1.5 text-sm font-semibold">
          <span>{tr('confirmPassword')}</span>
          <input class="input w-full" type="password" bind:value={confirmation} autocomplete="new-password" required />
        </label>
      {/if}

      {#if localError}
        <div class="alert alert-error py-2 text-sm" role="alert">{localError}</div>
      {/if}

      <button class="btn btn-primary btn-block" type="submit" disabled={busy}>
        {#if busy}
          <span class="loading loading-spinner loading-sm"></span>
        {/if}
        {hasVault ? tr('unlock') : tr('createVault')}
      </button>
    </form>
  </div>
</section>
