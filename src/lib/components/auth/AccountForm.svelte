<script lang="ts">
  import type { AccountDraft, AuthenticatorAccount, OtpAlgorithm, OtpType } from '../../auth/types';
  import { tr } from '../../i18n/messages';

  interface Props {
    initial?: AuthenticatorAccount | null;
    onsubmit: (draft: AccountDraft) => void | Promise<void>;
    oncancel: () => void;
  }

  let { initial = null, onsubmit, oncancel }: Props = $props();
  const formInitial = getInitialSnapshot();

  let issuer = $state(formInitial?.issuer ?? '');
  let label = $state(formInitial?.label ?? '');
  let secret = $state(formInitial?.secret ?? '');
  let type = $state<OtpType>(formInitial?.type ?? 'totp');
  let algorithm = $state<OtpAlgorithm>(formInitial?.algorithm ?? 'SHA-1');
  let digits = $state(formInitial?.digits ?? 6);
  let period = $state(formInitial?.period ?? 30);
  let counter = $state(formInitial?.counter ?? 0);

  const isSteam = $derived(type === 'steam');
  const isHotp = $derived(type === 'hotp');

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    await onsubmit({
      issuer,
      label,
      secret,
      type,
      algorithm,
      digits: isSteam ? 5 : Number(digits),
      period: Number(period),
      counter: Number(counter)
    });
  }

  function getInitialSnapshot(): AuthenticatorAccount | null {
    return initial ? { ...initial } : null;
  }
</script>

<form class="grid gap-3" onsubmit={submit}>
  <label class="grid gap-1 text-sm font-medium">
    <span>{tr('issuer')}</span>
    <input class="input input-sm w-full" bind:value={issuer} autocomplete="off" placeholder="Google, GitHub…" />
  </label>

  <label class="grid gap-1 text-sm font-medium">
    <span>{tr('account')}</span>
    <input class="input input-sm w-full" bind:value={label} autocomplete="off" required />
  </label>

  <label class="grid gap-1 text-sm font-medium">
    <span>{tr('secret')}</span>
    <textarea class="textarea min-h-20 w-full font-mono text-sm" bind:value={secret} spellcheck="false" required></textarea>
  </label>

  <div class="grid grid-cols-2 gap-3">
    <label class="grid gap-1 text-sm font-medium">
      <span>{tr('type')}</span>
      <select class="select select-sm w-full" bind:value={type}>
        <option value="totp">{tr('totp')}</option>
        <option value="hotp">{tr('hotp')}</option>
        <option value="steam">{tr('steam')}</option>
      </select>
    </label>

    <label class="grid gap-1 text-sm font-medium">
      <span>{tr('algorithm')}</span>
      <select class="select select-sm w-full" bind:value={algorithm} disabled={isSteam}>
        <option value="SHA-1">SHA-1</option>
        <option value="SHA-256">SHA-256</option>
        <option value="SHA-512">SHA-512</option>
      </select>
    </label>

    <label class="grid gap-1 text-sm font-medium">
      <span>{tr('digits')}</span>
      <input class="input input-sm w-full" type="number" min="5" max="10" bind:value={digits} disabled={isSteam} />
    </label>

    <label class="grid gap-1 text-sm font-medium">
      <span>{isHotp ? tr('counter') : tr('period')}</span>
      {#if isHotp}
        <input class="input input-sm w-full" type="number" min="0" bind:value={counter} />
      {:else}
        <input class="input input-sm w-full" type="number" min="5" max="300" bind:value={period} />
      {/if}
    </label>
  </div>

  <div class="modal-action mt-1 grid grid-cols-2 gap-2">
    <button class="btn btn-sm" type="button" onclick={oncancel}>{tr('cancel')}</button>
    <button class="btn btn-primary btn-sm" type="submit">{tr('save')}</button>
  </div>
</form>
