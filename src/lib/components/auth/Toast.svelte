<script lang="ts">
  import { CircleAlert, CircleCheck } from '@lucide/svelte';

  type Variant = 'notice' | 'error';

  interface Props {
    /** Current message to surface. Empty string hides the toast. */
    message: string;
    /** Visual treatment for the message. */
    variant?: Variant;
    /**
     * Monotonic trigger. Bumping it re-announces the toast even when the
     * message text is unchanged (e.g. copying the same code repeatedly).
     */
    nonce?: number;
  }

  let { message, variant = 'notice', nonce = 0 }: Props = $props();

  // Springy overshoot for entrances/pulses, sharp ease-in for the exit.
  const POP_EASE = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
  const OUT_EASE = 'cubic-bezier(0.4, 0, 1, 1)';

  let el = $state<HTMLDivElement | null>(null);
  // `shown` is null whenever nothing should be in the DOM, so the pill never
  // flashes empty on first open. It lingers through the exit animation.
  // It is written, never read, inside the effect below to avoid a self-loop;
  // the plain `visible` flag carries the present/absent logic instead.
  let shown = $state<{ text: string; variant: Variant } | null>(null);
  let visible = false;
  let pendingEntrance = false;
  let anim: Animation | null = null;

  function reducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  function play(keyframes: Keyframe[], duration: number, easing: string): Animation | null {
    if (!el) return null;
    anim?.cancel();
    if (reducedMotion()) {
      const last = keyframes[keyframes.length - 1];
      el.style.opacity = String(last.opacity ?? 1);
      el.style.transform = 'none';
      return null;
    }
    anim = el.animate(keyframes, { duration, easing, fill: 'forwards' });
    return anim;
  }

  function popIn() {
    play(
      [
        { opacity: 0, transform: 'translateY(10px) scale(0.9)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' }
      ],
      260,
      POP_EASE
    );
  }

  function bump() {
    play(
      [
        { transform: 'translateY(0) scale(1)', opacity: 1 },
        { transform: 'translateY(0) scale(1.06)', offset: 0.4, opacity: 1 },
        { transform: 'translateY(0) scale(1)', opacity: 1 }
      ],
      260,
      POP_EASE
    );
  }

  function slideOut() {
    const out = play(
      [
        { opacity: 1, transform: 'translateY(0) scale(1)' },
        { opacity: 0, transform: 'translateY(6px) scale(0.96)' }
      ],
      150,
      OUT_EASE
    );
    if (out) {
      // A natural finish means no newer message interrupted us: unmount.
      // (cancel() from a follow-up animation does not fire onfinish.)
      out.onfinish = () => {
        shown = null;
      };
    } else {
      shown = null;
    }
  }

  // React to incoming props.
  $effect(() => {
    const incoming = { text: message, variant, nonce };
    const { text, variant: next } = incoming;

    if (text) {
      const fresh = !visible;
      visible = true;
      shown = { text, variant: next };
      if (!el) {
        pendingEntrance = true; // element mounts this tick; animate once it exists
      } else if (fresh) {
        popIn();
      } else {
        bump();
      }
    } else if (visible) {
      visible = false;
      slideOut();
    }
  });

  // Run the entrance animation once the freshly mounted element is in the DOM.
  $effect(() => {
    if (el && pendingEntrance) {
      pendingEntrance = false;
      popIn();
    }
  });
</script>

{#if shown}
  <div class="toast toast-center toast-bottom pointer-events-none z-30 mb-2">
    <div
      bind:this={el}
      class="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg ring-1 ring-black/5 {shown.variant ===
      'error'
        ? 'bg-error text-error-content'
        : 'bg-primary text-primary-content'}"
      style="opacity: 0;"
      role={shown.variant === 'error' ? 'alert' : 'status'}
      aria-live={shown.variant === 'error' ? 'assertive' : 'polite'}
    >
      {#if shown.variant === 'error'}
        <CircleAlert size={16} aria-hidden="true" class="shrink-0" />
      {:else}
        <CircleCheck size={16} aria-hidden="true" class="shrink-0" />
      {/if}
      <span>{shown.text}</span>
    </div>
  </div>
{/if}
