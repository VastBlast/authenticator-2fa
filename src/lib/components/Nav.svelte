<script lang="ts">
  import { MENU_ITEMS } from '../constants/menu';
  import { currentPage } from '../stores/navigation';
  import Icon from './Icon.svelte';
  
  function getPageForMenuItem(label: string): string {
    return label.toLowerCase();
  }
</script>

<aside class="h-16 bg-base-200 p-2 w-full bottom-0 fixed border-t border-base-300">
  <nav class="flex flex-row gap-4 justify-center">
    {#each MENU_ITEMS as item}
      {@const isActive = getPageForMenuItem(item.label) === $currentPage}
      <button 
        class="btn btn-ghost btn-square {isActive ? 'btn-active' : ''}" 
        onclick={item.action}
        aria-label={item.label}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon icon={item.icon} size={24} class="text-current" />
        <span class="sr-only">{item.label}</span>
      </button>
    {/each}
  </nav>
</aside>
