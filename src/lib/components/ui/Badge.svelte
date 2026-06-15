<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'neutral' | 'error' | 'warning' | 'info' | 'success';
    size?: 'xs' | 'sm' | 'md' | 'lg';
    outline?: boolean;
    class?: string;
    children?: Snippet;
  }
  
  let {
    variant = 'neutral',
    size = 'md',
    outline = false,
    class: className = '',
    children,
    ...rest
  }: Props = $props();
  
  const classes = $derived([
    'badge',
    variant !== 'neutral' && `badge-${variant}`,
    outline && 'badge-outline',
    size !== 'md' && `badge-${size}`,
    className
  ].filter(Boolean).join(' '));
</script>

<span class={classes} {...rest}>
  {#if children}
    {@render children()}
  {/if}
</span>
