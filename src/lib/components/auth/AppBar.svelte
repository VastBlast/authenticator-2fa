<script lang="ts">
  import { Lock, Settings } from '@lucide/svelte';
  import appIconUrl from '../../../../assets/brand/icons/authenticator-2fa-icon.svg?url';
  import { authenticatorVault as vault } from '../../state/authenticator.svelte';
  import { tr } from '../../i18n/messages';

  interface Props {
    onsettings: (event: MouseEvent) => void;
  }

  let { onsettings }: Props = $props();
</script>

<header class="flex items-center gap-2 border-b border-base-200 px-3 py-2.5">
  <img class="size-5 shrink-0" src={appIconUrl} alt="" aria-hidden="true" draggable="false" />
  <h1 class="grow truncate text-base font-bold tracking-tight">{tr('appName')}</h1>

  {#if vault.passwordProtected}
    <button
      class="btn btn-ghost btn-sm btn-circle"
      type="button"
      aria-label={tr('lock')}
      title={tr('lock')}
      onclick={() => vault.lock()}
    >
      <Lock size={18} aria-hidden="true" />
    </button>
  {/if}
  <a
    class="btn btn-ghost btn-sm shrink-0 px-2"
    href="https://github.com/VastBlast/authenticator-2fa"
    target="_blank"
    rel="noopener noreferrer"
    aria-label={tr('sourceCode')}
    title={tr('sourceCode')}
  >
    <svg class="size-4.5" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path
        d="M12 .5a12 12 0 0 0-3.8 23.38c.6.12.82-.26.82-.58v-2.05c-3.34.73-4.04-1.42-4.04-1.42-.55-1.38-1.34-1.75-1.34-1.75-1.08-.74.09-.73.09-.73 1.2.08 1.83 1.24 1.83 1.24 1.07 1.82 2.8 1.3 3.49.99.1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.17 0 0 1.01-.32 3.3 1.23a11.45 11.45 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.17.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 5.93.43.37.82 1.1.82 2.22v3.29c0 .32.21.7.83.58A12 12 0 0 0 12 .5Z"
      />
    </svg>
    <span class="text-xs">{tr('sourceCode')}</span>
  </a>
  <button
    class="btn btn-ghost btn-sm btn-circle"
    type="button"
    aria-label={tr('settings')}
    title={tr('settings')}
    onclick={onsettings}
  >
    <Settings size={18} aria-hidden="true" />
  </button>
</header>
