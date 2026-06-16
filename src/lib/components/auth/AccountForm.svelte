<script lang="ts">
  import type { AccountDraft, AuthenticatorAccount, OtpAlgorithm, OtpType } from '../../auth/types';
  import type { MessageKey } from '../../i18n/messages';

  interface Props {
    initial?: AuthenticatorAccount | null;
    tr: (key: MessageKey) => string;
    onsubmit: (draft: AccountDraft) => void | Promise<void>;
    oncancel: () => void;
  }

  let { initial = null, tr, onsubmit, oncancel }: Props = $props();
  const formInitial = getInitialSnapshot();

  let issuer = $state(formInitial?.issuer ?? '');
  let label = $state(formInitial?.label ?? '');
  let secret = $state(formInitial?.secret ?? '');
  let type = $state<OtpType>(formInitial?.type ?? 'totp');
  let algorithm = $state<OtpAlgorithm>(formInitial?.algorithm ?? 'SHA-1');
  let digits = $state(formInitial?.digits ?? 6);
  let period = $state(formInitial?.period ?? 30);
  let counter = $state(formInitial?.counter ?? 0);
  let pinned = $state(formInitial?.pinned ?? false);

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
      counter: Number(counter),
      pinned
    });
  }

  function getInitialSnapshot(): AuthenticatorAccount | null {
    return initial ? { ...initial } : null;
  }
</script>

<form class="form-stack" onsubmit={submit}>
  <label class="field">
    <span>{tr('issuer')}</span>
    <input class="input" bind:value={issuer} autocomplete="off" />
  </label>

  <label class="field">
    <span>{tr('account')}</span>
    <input class="input" bind:value={label} autocomplete="off" required />
  </label>

  <label class="field">
    <span>{tr('secret')}</span>
    <textarea class="textarea secret-field" bind:value={secret} spellcheck="false" required></textarea>
  </label>

  <div class="field-grid">
    <label class="field">
      <span>{tr('type')}</span>
      <select class="select" bind:value={type}>
        <option value="totp">{tr('totp')}</option>
        <option value="hotp">{tr('hotp')}</option>
        <option value="steam">{tr('steam')}</option>
      </select>
    </label>

    <label class="field">
      <span>{tr('algorithm')}</span>
      <select class="select" bind:value={algorithm} disabled={isSteam}>
        <option value="SHA-1">SHA-1</option>
        <option value="SHA-256">SHA-256</option>
        <option value="SHA-512">SHA-512</option>
      </select>
    </label>
  </div>

  <div class="field-grid">
    <label class="field">
      <span>{tr('digits')}</span>
      <input class="input" type="number" min="5" max="10" bind:value={digits} disabled={isSteam} />
    </label>

    <label class="field">
      <span>{isHotp ? tr('counter') : tr('period')}</span>
      {#if isHotp}
        <input class="input" type="number" min="0" bind:value={counter} />
      {:else}
        <input class="input" type="number" min="5" max="300" bind:value={period} />
      {/if}
    </label>
  </div>

  <label class="inline-field">
    <input class="toggle" type="checkbox" bind:checked={pinned} />
    <span>{tr('pinned')}</span>
  </label>

  <div class="dialog-actions">
    <button class="btn" type="button" onclick={oncancel}>{tr('cancel')}</button>
    <button class="btn btn-primary" type="submit">{tr('save')}</button>
  </div>
</form>
