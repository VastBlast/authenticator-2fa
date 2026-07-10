<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { prefersReducedMotion } from 'svelte/motion';
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

  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

  let el = $state<HTMLDivElement | null>(null);
  // `shown` is null whenever nothing should be in the DOM, so the pill never
  // flashes empty on first open. It lingers through the exit animation.
  // It is written, never read, inside the effect below to avoid a self-loop;
  // the plain `visible` flag carries the present/absent logic instead.
  let shown = $state<{ text: string; variant: Variant } | null>(null);
  let visible = false;
  let pendingEntrance = false;
  let anim: Animation | null = null;

  function play(
    keyframes: Keyframe[],
    reducedKeyframes: Keyframe[],
    duration: number,
    reducedDuration = 110
  ): Animation | null {
    if (!el) return null;

    // Read the painted state before canceling so rapid updates reverse without
    // jumping back to the element's inline starting style.
    const style = getComputedStyle(el);
    const opacity = Number.parseFloat(style.opacity);
    const presentation = {
      opacity: Number.isFinite(opacity) ? opacity : 0,
      transform: style.transform === 'none' ? 'translateY(0) scale(1)' : style.transform
    };
    anim?.cancel();

    if (prefersReducedMotion.current) {
      el.style.transform = 'none';
      anim = el.animate(
        [{ opacity: presentation.opacity }, ...reducedKeyframes],
        { duration: reducedDuration, easing: EASE_OUT, fill: 'forwards' }
      );
      return anim;
    }

    anim = el.animate(
      [
        {
          opacity: presentation.opacity,
          transform: presentation.transform
        },
        ...keyframes
      ],
      { duration, easing: EASE_OUT, fill: 'forwards' }
    );
    return anim;
  }

  function popIn() {
    play(
      [
        { opacity: 1, transform: 'translateY(0) scale(1)' }
      ],
      [{ opacity: 1 }],
      200
    );
  }

  function acknowledgeRepeat() {
    play(
      [
        { transform: 'translateY(0) scale(0.98)', offset: 0.45, opacity: 1 },
        { transform: 'translateY(0) scale(1)', opacity: 1 }
      ],
      [
        { opacity: 0.86, offset: 0.45 },
        { opacity: 1 }
      ],
      140
    );
  }

  function slideOut() {
    const out = play(
      [
        { opacity: 0, transform: 'translateY(4px) scale(0.98)' }
      ],
      [{ opacity: 0 }],
      130,
      120
    );
    if (out) {
      out.onfinish = () => {
        if (anim !== out || visible || message) return;
        anim = null;
        shown = null;
      };
    } else if (!visible) {
      shown = null;
    }
  }

  // React to incoming props.
  $effect(() => {
    const incoming = { text: message, variant, nonce };
    const { text, variant: next } = incoming;

    untrack(() => {
      if (text) {
        const fresh = !visible;
        visible = true;
        shown = { text, variant: next };
        if (!el) {
          pendingEntrance = true; // element mounts this tick; animate once it exists
        } else if (fresh) {
          popIn();
        } else {
          acknowledgeRepeat();
        }
      } else if (visible) {
        visible = false;
        slideOut();
      }
    });
  });

  // Run the entrance animation once the freshly mounted element is in the DOM.
  $effect(() => {
    if (el && pendingEntrance) {
      pendingEntrance = false;
      popIn();
    }
  });

  onDestroy(() => {
    if (anim) {
      anim.onfinish = null;
      anim.cancel();
      anim = null;
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
      style="opacity: 0; transform: translateY(8px) scale(0.96);"
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
