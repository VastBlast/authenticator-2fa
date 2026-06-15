<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    open?: boolean;
    title?: string;
    class?: string;
    onclose?: () => void;
    children?: Snippet;
    actions?: Snippet;
  }
  
  let {
    open = $bindable(false),
    title,
    class: className = '',
    onclose,
    children,
    actions,
    ...rest
  }: Props = $props();
  
  function handleBackdropClick() {
    if (onclose) {
      onclose();
    } else {
      open = false;
    }
  }
</script>

{#if open}
  <dialog class="modal modal-open" {...rest}>
    <div class={`modal-box ${className}`}>
      {#if title}
        <h3 class="font-bold text-lg mb-4">{title}</h3>
      {/if}
      
      {#if children}
        {@render children()}
      {/if}
      
      {#if actions}
        <div class="modal-action">
          {@render actions()}
        </div>
      {/if}
    </div>
    <div class="modal-backdrop" role="button" tabindex="-1" onclick={handleBackdropClick} onkeydown={handleBackdropClick}></div>
  </dialog>
{/if}
