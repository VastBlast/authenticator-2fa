<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ClassValue } from 'svelte/elements';
  import { getErrorMessage } from '../../auth/errors';
  import { getFilePickerHandoff, openAppPage, type AppRoute } from '../../extension/appWindow';
  import { tr } from '../../i18n/messages';

  interface Props {
    accept: string;
    /** Screen that continues in its own window or tab when this page cannot receive files. */
    route: AppRoute;
    class?: ClassValue;
    disabled?: boolean;
    onfiles: (files: File[]) => void;
    onerror: (message: string) => void;
    /** Receives whether choosing files opens a new window or tab. */
    children: Snippet<[opensElsewhere: boolean]>;
  }

  let { accept, route, class: className, disabled = false, onfiles, onerror, children }: Props = $props();

  const HANDOFF_TITLES = { window: 'opensInNewWindow', tab: 'opensInNewTab' } as const;
  const handoff = getFilePickerHandoff();
  let input = $state<HTMLInputElement>();

  function choose() {
    if (!handoff) {
      input?.click();
      return;
    }
    openAppPage(route, handoff).catch((error: unknown) => {
      onerror(getErrorMessage(error, tr('importFailed')));
    });
  }

  function select(event: Event & { currentTarget: HTMLInputElement }) {
    const files = Array.from(event.currentTarget.files ?? []);
    // Reset so picking the same file again still fires a change event.
    event.currentTarget.value = '';
    if (files.length > 0) {
      onfiles(files);
    }
  }
</script>

<button
  class={className}
  type="button"
  title={handoff ? tr(HANDOFF_TITLES[handoff]) : undefined}
  {disabled}
  onclick={choose}
>
  {@render children(handoff !== null)}
</button>
{#if !handoff}
  <input class="hidden" bind:this={input} type="file" {accept} multiple onchange={select} />
{/if}
