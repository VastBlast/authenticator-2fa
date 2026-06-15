<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    title?: string;
    compact?: boolean;
    bordered?: boolean;
    imageFull?: boolean;
    class?: string;
    children?: Snippet;
    actions?: Snippet;
  }
  
  let {
    title,
    compact = false,
    bordered = false,
    imageFull = false,
    class: className = '',
    children,
    actions,
    ...rest
  }: Props = $props();
  
  const classes = $derived([
    'card bg-base-200 shadow-xl',
    bordered && 'card-bordered',
    imageFull && 'image-full',
    className
  ].filter(Boolean).join(' '));
  
  const bodyClasses = $derived([
    'card-body',
    compact && 'card-compact'
  ].filter(Boolean).join(' '));
</script>

<div class={classes} {...rest}>
  <div class={bodyClasses}>
    {#if title}
      <h2 class="card-title">{title}</h2>
    {/if}
    
    {#if children}
      {@render children()}
    {/if}
    
    {#if actions}
      <div class="card-actions justify-end">
        {@render actions()}
      </div>
    {/if}
  </div>
</div>
