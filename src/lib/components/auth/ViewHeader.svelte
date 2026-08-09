<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ArrowLeft } from '@lucide/svelte';
  import { tr } from '../../i18n/messages';

  interface Props {
    title: string;
    onback: (event: MouseEvent) => void;
    /** Optional trailing controls. */
    actions?: Snippet;
  }

  let { title, onback, actions }: Props = $props();
</script>

<header class="flex items-center gap-2 border-b border-base-200 px-2 py-2">
  <button
    class="btn btn-ghost btn-sm btn-circle shrink-0"
    type="button"
    aria-label={tr('back')}
    onclick={onback}
  >
    <ArrowLeft size={18} aria-hidden="true" />
  </button>
  <h1 class="grow truncate text-base font-bold tracking-tight">{title}</h1>
  {@render actions?.()}
</header>
