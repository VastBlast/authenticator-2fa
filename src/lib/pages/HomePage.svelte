<script lang="ts">
  import { onMount } from 'svelte';
  import { navigateTo } from '../stores/navigation';
  import Footer from '../components/Footer.svelte';

  let count = $state(0);

  function increment() {
    count++;
  }

  onMount(() => {
    console.log('HomePage mounted');
  });
</script>

<div class="space-y-6">
  <!-- Hero Card -->
  <div
    class="card bg-gradient-to-br from-primary to-secondary text-primary-content shadow-xl"
  >
    <div class="card-body">
      <h2 class="card-title text-3xl">My Chrome Extension</h2>
      <p class="text-lg opacity-90">
        Your AI-powered Chrome extension built with Svelte 5
      </p>
      <div class="card-actions justify-end mt-4">
        <button class="btn btn-ghost">Get Started</button>
      </div>
    </div>
  </div>

  <!-- Stats -->
  <div class="stats stats-vertical lg:stats-horizontal shadow w-full">
    <div class="stat">
      <div class="stat-figure text-primary">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          class="inline-block w-8 h-8 stroke-current"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          ></path>
        </svg>
      </div>
      <div class="stat-title">Total Clicks</div>
      <div class="stat-value text-primary">{count}</div>
      <div class="stat-desc">Keep clicking!</div>
    </div>

    <div class="stat">
      <div class="stat-figure text-secondary">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          class="inline-block w-8 h-8 stroke-current"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 10V3L4 14h7v7l9-11h-7z"
          ></path>
        </svg>
      </div>
      <div class="stat-title">Status</div>
      <div class="stat-value text-secondary">Active</div>
      <div class="stat-desc">Extension running</div>
    </div>
  </div>

  <!-- Interactive Card -->
  <div class="card bg-base-200 shadow-xl">
    <div class="card-body">
      <h2 class="card-title">Counter Demo</h2>
      <p>Test Svelte 5 reactivity with this simple counter.</p>
      <div class="flex items-center gap-4 mt-4">
        <button class="btn btn-primary" onclick={increment}
          >{count + `${count == 1 ? ' click' : ' clicks'}`}</button
        >
        <button class="btn btn-outline btn-error" onclick={() => (count = 0)}>
          Reset
        </button>
      </div>
    </div>
  </div>

  <!-- Feature Cards Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h3 class="card-title text-lg">Modern Stack</h3>
        <p class="text-sm">
          Built with Svelte 5, Vite, TypeScript, and TailwindCSS
        </p>
      </div>
    </div>

    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h3 class="card-title text-lg">DaisyUI Components</h3>
        <p class="text-sm">
          Beautiful, accessible UI components out of the box
        </p>
        <div class="card-actions justify-end">
          <button
            class="btn btn-sm btn-primary"
            onclick={() => navigateTo('components')}
          >
            View Demo →
          </button>
        </div>
      </div>
    </div>

    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h3 class="card-title text-lg">Lucide Icons</h3>
        <p class="text-sm">High-quality SVG icons that work with Chrome CSP</p>
      </div>
    </div>

    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h3 class="card-title text-lg">Type Safety</h3>
        <p class="text-sm">Full TypeScript support for better DX</p>
      </div>
    </div>
  </div>

  <Footer />
</div>
