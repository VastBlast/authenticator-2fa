<script lang="ts">
  import { Lock, Settings, ShieldCheck } from '@lucide/svelte';
  import { authenticatorVault as vault } from '../../state/authenticator.svelte';
  import { tr } from '../../i18n/messages';

  interface Props {
    onsettings: () => void;
  }

  let { onsettings }: Props = $props();
</script>

<header class="flex items-center gap-2 border-b border-base-200 px-3 py-2.5">
  <ShieldCheck class="shrink-0 text-primary" size={22} aria-hidden="true" />
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
