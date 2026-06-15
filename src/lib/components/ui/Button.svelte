<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'link' | 'neutral' | 'error' | 'warning' | 'info' | 'success';
    size?: 'xs' | 'sm' | 'md' | 'lg';
    outline?: boolean;
    wide?: boolean;
    block?: boolean;
    circle?: boolean;
    square?: boolean;
    loading?: boolean;
    disabled?: boolean;
    class?: string;
    onclick?: () => void;
    type?: 'button' | 'submit' | 'reset';
    children?: Snippet;
  }
  
  let {
    variant = 'neutral',
    size = 'md',
    outline = false,
    wide = false,
    block = false,
    circle = false,
    square = false,
    loading = false,
    disabled = false,
    class: className = '',
    onclick,
    type = 'button',
    children,
    ...rest
  }: Props = $props();
  
  const classes = $derived([
    'btn',
    variant !== 'neutral' && `btn-${variant}`,
    outline && 'btn-outline',
    size !== 'md' && `btn-${size}`,
    wide && 'btn-wide',
    block && 'btn-block',
    circle && 'btn-circle',
    square && 'btn-square',
    loading && 'btn-disabled loading',
    className
  ].filter(Boolean).join(' '));
</script>

<button 
  {type}
  class={classes}
  {disabled}
  {onclick}
  {...rest}
>
  {#if children}
    {@render children()}
  {/if}
</button>
