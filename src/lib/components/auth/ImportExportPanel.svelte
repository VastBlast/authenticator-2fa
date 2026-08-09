<script lang="ts">
  import { fade } from 'svelte/transition';
  import { Download, Upload } from '@lucide/svelte';
  import ExportPanel from './ExportPanel.svelte';
  import ImportPanel from './ImportPanel.svelte';
  import ViewHeader from './ViewHeader.svelte';
  import { PANEL_TRANSITION } from './transitions';
  import type { AppSettings, AuthenticatorAccount, ImportResult } from '../../auth/types';
  import { tr } from '../../i18n/messages';

  interface Props {
    accounts: AuthenticatorAccount[];
    settings: AppSettings;
    onimport: (text: string) => Promise<ImportResult>;
    onimportencrypted: (text: string, password: string) => Promise<ImportResult>;
    onclose: () => void;
  }

  const TABS = [
    { id: 'import', icon: Upload },
    { id: 'export', icon: Download }
  ] as const;

  let { accounts, settings, onimport, onimportencrypted, onclose }: Props = $props();

  let tab = $state<'import' | 'export'>('import');

  function closeOnEscape(event: KeyboardEvent) {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      onclose();
    }
  }
</script>

<svelte:window onkeydown={closeOnEscape} />

<div class="flex h-full flex-col overflow-hidden bg-base-100">
  <ViewHeader title={tr('importExport')} onback={onclose} />

  <div class="px-3 pt-3">
    <div class="join w-full" role="group" aria-label={tr('importExport')}>
      {#each TABS as item (item.id)}
        {@const TabIcon = item.icon}
        <button
          class={['btn join-item flex-1 btn-sm', tab === item.id && 'btn-primary']}
          type="button"
          aria-pressed={tab === item.id}
          onclick={() => (tab = item.id)}
        >
          <TabIcon size={15} aria-hidden="true" />
          {tr(item.id)}
        </button>
      {/each}
    </div>
  </div>

  <div class="grow overflow-y-auto p-3">
    {#if tab === 'import'}
      <div in:fade={PANEL_TRANSITION}>
        <ImportPanel {onimport} {onimportencrypted} />
      </div>
    {:else}
      <div in:fade={PANEL_TRANSITION}>
        <ExportPanel {accounts} {settings} />
      </div>
    {/if}
  </div>
</div>
