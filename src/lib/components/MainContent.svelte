<script lang="ts">
  import { onMount } from 'svelte';

  let count = $state(0)

  function increment() {
    count++;
    console.log('increment', count);
  }

  onMount(() => {
    console.log('MainContent mounted');
  });
</script>

<div class="card bg-base-200 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">Chrome Extension Side Panel</h2>
    <p>Welcome to your Svelte-powered Chrome extension!</p>
    <div class="flex items-center gap-4 mt-4">
      <button class="btn btn-primary" onclick={increment}>
        Count: {count}
      </button>
    </div>
  </div>
</div>
