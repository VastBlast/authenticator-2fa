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

<section class="gate">
  <div class="brand-lock">
    {#if hasVault}
      <LockKeyhole size={34} aria-hidden="true" />
    {:else}
      <KeyRound size={34} aria-hidden="true" />
    {/if}
  </div>
  <h1>{hasVault ? tr('unlockTitle') : tr('setupTitle')}</h1>
  <p>{tr('tagline')}</p>

  <form class="gate-form" onsubmit={submit}>
    <label class="field">
      <span>{hasVault ? tr('password') : tr('newPassword')}</span>
      <input class="input" type="password" bind:value={password} autocomplete="current-password" required />
    </label>

    {#if !hasVault}
      <label class="field">
        <span>{tr('confirmPassword')}</span>
        <input class="input" type="password" bind:value={confirmation} autocomplete="new-password" required />
      </label>
    {/if}

    {#if localError}
      <div class="alert alert-error" role="alert">{localError}</div>
    {/if}

    <button class="btn btn-primary btn-block" type="submit" disabled={busy}>
      {hasVault ? tr('unlock') : tr('createVault')}
    </button>
  </form>
</section>
