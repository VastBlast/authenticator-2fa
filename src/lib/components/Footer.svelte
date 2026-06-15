<script lang="ts">
  import { Coffee, Heart } from '../icons';
  import Icon from './Icon.svelte';

  const currentYear = new Date().getFullYear();
</script>

<footer class="footer footer-center p-4 text-base-content mt-8">
  <aside>
    <div class="flex items-center gap-2 text-sm">
      <span>Made with</span>
      <Icon icon={Heart} size={16} class="text-error animate-pulse" />
      <span
        >by <a
          href="https://ko-fi.com/trentbrew"
          target="_blank"
          rel="noopener noreferrer"
          class="link link-hover font-semibold">Trent Brew</a
        ></span
      >
    </div>
    <div class="flex items-center gap-4 text-xs opacity-70 mt-2">
      <span>© {currentYear} • MIT License</span>
      <a
        href="https://ko-fi.com/trentbrew"
        target="_blank"
        rel="noopener noreferrer"
        class="link link-hover flex items-center gap-1"
      >
        <Icon icon={Coffee} size={14} />
        Buy me a coffee
      </a>
    </div>
  </aside>
</footer>
