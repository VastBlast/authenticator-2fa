<script lang="ts">
  import { Eye, EyeOff } from '@lucide/svelte';
  import { tr } from '../../i18n/messages';

  interface Props {
    value: string;
    label: string;
    autocomplete?: 'current-password' | 'new-password' | 'off';
    hint?: string;
    invalid?: boolean;
    disabled?: boolean;
    oninput?: () => void;
  }

  let {
    value = $bindable(),
    label,
    autocomplete = 'off',
    hint = '',
    invalid = false,
    disabled = false,
    oninput
  }: Props = $props();

  const fieldId = $props.id();
  const hintId = `${fieldId}-hint`;
  let revealed = $state(false);

  // `type` has to stay dynamic for the reveal toggle, which rules out
  // `bind:value`, so the value is written back by hand.
  function handleInput(event: Event & { currentTarget: HTMLInputElement }) {
    value = event.currentTarget.value;
    oninput?.();
  }
</script>

<div class="grid gap-1.5">
  <label class="text-sm font-medium" for={fieldId}>{label}</label>
  <div class={['input w-full items-center gap-1 pe-1', invalid && 'border-error']}>
    <input
      id={fieldId}
      class="grow"
      type={revealed ? 'text' : 'password'}
      {value}
      {autocomplete}
      {disabled}
      aria-describedby={hint ? hintId : undefined}
      aria-invalid={invalid || undefined}
      autocapitalize="off"
      spellcheck="false"
      oninput={handleInput}
    />
    <button
      class="btn btn-ghost btn-xs btn-circle shrink-0"
      type="button"
      aria-label={tr('showPassword')}
      aria-pressed={revealed}
      {disabled}
      onclick={() => (revealed = !revealed)}
    >
      {#if revealed}
        <EyeOff size={15} aria-hidden="true" />
      {:else}
        <Eye size={15} aria-hidden="true" />
      {/if}
    </button>
  </div>
  {#if hint}
    <span id={hintId} class={['text-xs', invalid ? 'text-error' : 'text-base-content/55']}>{hint}</span>
  {/if}
</div>
