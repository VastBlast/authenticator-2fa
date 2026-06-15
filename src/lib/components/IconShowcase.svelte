<script lang="ts">
  import Icon from './Icon.svelte';
  import { 
    Home, 
    Settings, 
    HelpCircle, 
    Moon, 
    Sun, 
    Search,
    Plus,
    Check,
    AlertCircle,
    Info 
  } from '../icons';
  
  const icons = [
    { component: Home, name: 'Home' },
    { component: Settings, name: 'Settings' },
    { component: HelpCircle, name: 'Help Circle' },
    { component: Moon, name: 'Moon' },
    { component: Sun, name: 'Sun' },
    { component: Search, name: 'Search' },
    { component: Plus, name: 'Plus' },
    { component: Check, name: 'Check' },
    { component: AlertCircle, name: 'Alert Circle' },
    { component: Info, name: 'Info' },
  ];
</script>

<div class="p-6 space-y-4">
  <h2 class="text-2xl font-bold">Icon System Showcase</h2>
  
  <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
    {#each icons as icon}
      <div class="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-base-200 transition-colors">
        <Icon icon={icon.component} size={32} class="text-current" />
        <span class="text-xs text-center">{icon.name}</span>
      </div>
    {/each}
  </div>
  
  <div class="divider">Size Variations</div>
  
  <div class="flex gap-4 items-center">
    <Icon icon={Home} size={16} />
    <Icon icon={Home} size={24} />
    <Icon icon={Home} size={32} />
    <Icon icon={Home} size={48} />
  </div>
  
  <div class="divider">Stroke Width Variations</div>
  
  <div class="flex gap-4 items-center">
    <Icon icon={Settings} size={32} strokeWidth={1} />
    <Icon icon={Settings} size={32} strokeWidth={2} />
    <Icon icon={Settings} size={32} strokeWidth={3} />
  </div>
  
  <div class="divider">Color Variations</div>
  
  <div class="flex gap-4 items-center">
    <Icon icon={Check} size={32} class="text-success" />
    <Icon icon={AlertCircle} size={32} class="text-warning" />
    <Icon icon={Info} size={32} class="text-info" />
  </div>
</div>
