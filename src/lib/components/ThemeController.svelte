<script lang="ts">
  import {
    theme,
    setTheme,
    AVAILABLE_THEMES,
    type Theme,
  } from '../stores/theme';
  import { Palette, Check } from '../icons';
  import Icon from './Icon.svelte';

  let showThemeModal = $state(false);

  const themeGroups = {
    'Light Themes': [
      'light',
      'cupcake',
      'bumblebee',
      'emerald',
      'corporate',
      'retro',
      'garden',
      'lofi',
      'pastel',
      'fantasy',
      'wireframe',
      'cmyk',
      'autumn',
      'acid',
      'lemonade',
      'winter',
    ],
    'Dark Themes': [
      'dark',
      'synthwave',
      'cyberpunk',
      'valentine',
      'halloween',
      'forest',
      'aqua',
      'black',
      'luxury',
      'dracula',
      'business',
      'night',
      'coffee',
      'dim',
      'nord',
      'sunset',
    ],
  };

  function selectTheme(newTheme: Theme) {
    setTheme(newTheme);
    showThemeModal = false;
  }

  function capitalizeTheme(theme: string): string {
    return theme.charAt(0).toUpperCase() + theme.slice(1);
  }
</script>

<div class="dropdown dropdown-end">
  <button
    tabindex="0"
    class="btn btn-circle btn-ghost"
    aria-label="Change theme"
  >
    <Icon icon={Palette} size={20} />
  </button>

  <div
    class="dropdown-content z-[1] card card-compact w-80 max-h-96 overflow-y-auto p-2 shadow-2xl bg-base-200 mt-3"
  >
    <div class="card-body">
      <h3 class="card-title text-sm">
        <Icon icon={Palette} size={18} />
        Choose Theme
      </h3>

      {#each Object.entries(themeGroups) as [groupName, themes]}
        <div class="mb-3">
          <div class="text-xs font-semibold opacity-60 mb-2">{groupName}</div>
          <div class="grid grid-cols-2 gap-2">
            {#each themes as themeName}
              <button
                class="btn btn-sm justify-start {$theme === themeName
                  ? 'btn-primary'
                  : 'btn-ghost'}"
                onclick={() => selectTheme(themeName as Theme)}
                data-theme={themeName}
              >
                <div class="flex items-center justify-between w-full">
                  <span class="text-xs">{capitalizeTheme(themeName)}</span>
                  {#if $theme === themeName}
                    <Icon icon={Check} size={14} />
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        </div>
      {/each}

      <div class="divider my-1"></div>
    </div>
  </div>
</div>
