<script lang="ts">
  import { theme, toggleTheme } from '../stores/theme';
  import { Moon, Sun, Bell, Volume2, Palette, Shield } from '../icons';
  import Icon from '../components/Icon.svelte';

  let notifications = $state(true);
  let soundEnabled = $state(false);
  let autoSave = $state(true);
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center gap-3">
    <Icon icon={Shield} size={32} class="text-primary" />
    <div>
      <h1 class="text-3xl font-bold">Settings</h1>
      <p class="text-sm opacity-70">Customize your extension preferences</p>
    </div>
  </div>

  <!-- Theme Settings -->
  <div class="card bg-base-200 shadow-xl">
    <div class="card-body">
      <h2 class="card-title">
        <Icon icon={Palette} size={24} />
        Appearance
      </h2>
      
      <div class="form-control">
        <label class="label cursor-pointer">
          <span class="label-text">Theme</span>
          <div class="flex items-center gap-3">
            <Icon icon={$theme === 'light' ? Sun : Moon} size={20} />
            <input 
              type="checkbox" 
              class="toggle toggle-primary" 
              checked={$theme === 'dark'}
              onchange={toggleTheme}
            />
          </div>
        </label>
      </div>
      
      <div class="divider"></div>
      
      <div class="alert alert-info">
        <Icon icon={Moon} size={20} />
        <span>Current theme: <strong class="capitalize">{$theme}</strong></span>
      </div>
    </div>
  </div>

  <!-- Notifications Settings -->
  <div class="card bg-base-200 shadow-xl">
    <div class="card-body">
      <h2 class="card-title">
        <Icon icon={Bell} size={24} />
        Notifications
      </h2>
      
      <div class="form-control">
        <label class="label cursor-pointer">
          <span class="label-text">Enable notifications</span>
          <input 
            type="checkbox" 
            class="toggle toggle-secondary" 
            bind:checked={notifications}
          />
        </label>
      </div>
      
      <div class="form-control">
        <label class="label cursor-pointer">
          <span class="label-text">Sound effects</span>
          <input 
            type="checkbox" 
            class="toggle toggle-accent" 
            bind:checked={soundEnabled}
            disabled={!notifications}
          />
        </label>
      </div>
    </div>
  </div>

  <!-- General Settings -->
  <div class="card bg-base-200 shadow-xl">
    <div class="card-body">
      <h2 class="card-title">General</h2>
      
      <div class="form-control">
        <label class="label cursor-pointer">
          <span class="label-text">Auto-save preferences</span>
          <input 
            type="checkbox" 
            class="toggle toggle-success" 
            bind:checked={autoSave}
          />
        </label>
      </div>
      
      <div class="divider"></div>
      
      <div class="form-control w-full">
        <label class="label" for="language-select">
          <span class="label-text">Default language</span>
        </label>
        <select id="language-select" class="select select-bordered w-full">
          <option selected>English</option>
          <option>Spanish</option>
          <option>French</option>
          <option>German</option>
        </select>
      </div>
    </div>
  </div>

  <!-- Actions -->
  <div class="card bg-base-200 shadow-xl">
    <div class="card-body">
      <h2 class="card-title">Data Management</h2>
      <div class="flex flex-wrap gap-2">
        <button class="btn btn-outline btn-primary">Export Data</button>
        <button class="btn btn-outline btn-secondary">Import Settings</button>
        <button class="btn btn-outline btn-error">Clear Cache</button>
      </div>
    </div>
  </div>
</div>
