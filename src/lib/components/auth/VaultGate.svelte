<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { KeyRound, LockKeyhole } from '@lucide/svelte';
  import { FADE_TRANSITION } from './transitions';
  import { tr } from '../../i18n/messages';

  interface Props {
    hasVault: boolean;
    busy: boolean;
    oncreate: (password: string) => void | Promise<void>;
    onunlock: (password: string) => void | Promise<void>;
  }

  let { hasVault, busy, oncreate, onunlock }: Props = $props();
  let password = $state('');
  let confirmation = $state('');
  let localError = $state('');
  let passwordInput = $state<HTMLInputElement | undefined>();

  onMount(() => {
    passwordInput?.focus();
  });

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

<section class="grid h-full place-items-center p-6">
  <div class="grid w-full max-w-xs gap-6">
    <div class="grid justify-items-center gap-3 text-center">
      <div class="grid size-16 place-items-center rounded-2xl bg-primary text-primary-content shadow-md">
        {#if hasVault}
          <LockKeyhole size={32} aria-hidden="true" />
        {:else}
          <KeyRound size={32} aria-hidden="true" />
        {/if}
      </div>
      <div class="grid gap-1">
        <h1 class="text-xl font-bold tracking-tight">{hasVault ? tr('unlockTitle') : tr('setupTitle')}</h1>
        <p class="text-sm leading-snug text-base-content/60">{tr('tagline')}</p>
      </div>
    </div>

    <form class="grid gap-3" onsubmit={submit}>
      <label class="grid gap-1 text-sm font-medium">
        <span>{hasVault ? tr('password') : tr('newPassword')}</span>
        <input
          class="input w-full"
          type="password"
          bind:this={passwordInput}
          bind:value={password}
          autocomplete="current-password"
          required
        />
      </label>

      {#if !hasVault}
        <label class="grid gap-1 text-sm font-medium">
          <span>{tr('confirmPassword')}</span>
          <input class="input w-full" type="password" bind:value={confirmation} autocomplete="new-password" required />
        </label>
      {/if}

      {#if localError}
        <p class="text-sm text-error" transition:fade={FADE_TRANSITION} role="alert">{localError}</p>
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
