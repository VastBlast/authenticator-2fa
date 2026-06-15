<script lang="ts">
  import type { Component } from 'svelte';
  
  interface Props {
    icon: Component<any>;
    size?: number | string;
    strokeWidth?: number;
    class?: string;
  }
  
  let { 
    icon, 
    size = 24, 
    strokeWidth = 2,
    class: className = '',
    ...rest 
  }: Props = $props();
</script>

<svelte:component 
  this={icon} 
  {size} 
  strokeWidth={strokeWidth}
  class={className}
  {...rest}
/>
