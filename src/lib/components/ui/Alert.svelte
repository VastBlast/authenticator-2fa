<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Info, AlertCircle, Check, X } from '../../icons';
  import Icon from '../Icon.svelte';
  
  interface Props {
    variant?: 'info' | 'success' | 'warning' | 'error';
    class?: string;
    showIcon?: boolean;
    children?: Snippet;
  }
  
  let {
    variant = 'info',
    class: className = '',
    showIcon = true,
    children,
    ...rest
  }: Props = $props();
  
  const classes = $derived([
    'alert',
    `alert-${variant}`,
    className
  ].filter(Boolean).join(' '));
  
  const iconMap = {
    info: Info,
    success: Check,
    warning: AlertCircle,
    error: X
  };
</script>

<div class={classes} role="alert" {...rest}>
  {#if showIcon}
    <Icon icon={iconMap[variant]} size={20} />
  {/if}
  {#if children}
    <span>{@render children()}</span>
  {/if}
</div>
