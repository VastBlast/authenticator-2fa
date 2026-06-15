<script lang="ts">
  import { theme, toggleTheme } from "../stores/theme";
  import { Moon, Sun } from "../icons";
  import Icon from "./Icon.svelte";
</script>

<button class="btn btn-circle" onclick={toggleTheme} aria-label="Toggle theme">
  {#if $theme === "light"}
    <Icon icon={Moon} size={24} class="text-current" />
  {:else}
    <Icon icon={Sun} size={24} class="text-current" />
  {/if}
</button>
