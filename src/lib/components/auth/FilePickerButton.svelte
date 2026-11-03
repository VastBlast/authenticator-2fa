<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ClassValue } from 'svelte/elements';
  import { getErrorMessage } from '../../auth/errors';
  import { needsFilePickerWindow, openAppWindow, type AppRoute } from '../../extension/appWindow';
  import { tr } from '../../i18n/messages';

  interface Props {
    accept: string;
    /** Screen that continues in its own window when this page cannot host the picker. */
    route: AppRoute;
    class?: ClassValue;
    disabled?: boolean;
    onfiles: (files: File[]) => void;
    onerror: (message: string) => void;
    /** Receives whether choosing files opens a new window. */
    children: Snippet<[opensWindow: boolean]>;
  }

  let { accept, route, class: className, disabled = false, onfiles, onerror, children }: Props = $props();

  const opensWindow = needsFilePickerWindow();
  let input = $state<HTMLInputElement>();

  function choose() {
    if (!opensWindow) {
      input?.click();
      return;
    }
    openAppWindow(route).catch((error: unknown) => {
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
  title={opensWindow ? tr('opensInNewWindow') : undefined}
  {disabled}
  onclick={choose}
>
  {@render children(opensWindow)}
</button>
{#if !opensWindow}
  <input class="hidden" bind:this={input} type="file" {accept} multiple onchange={select} />
{/if}
