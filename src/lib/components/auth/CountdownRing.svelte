<script lang="ts">
  interface Props {
    remaining: number;
    period: number;
    showSeconds?: boolean;
  }

  let { remaining, period, showSeconds = false }: Props = $props();

  const RADIUS = 9;
  const CENTER = 12;
  const FULL_CIRCLE_THRESHOLD = 0.995;

  const fraction = $derived(period > 0 ? Math.max(0, Math.min(1, remaining / period)) : 0);
  const expiring = $derived(remaining <= 5);
  const piePath = $derived(createPiePath(fraction));

  function createPiePath(value: number): string {
    const angle = -Math.PI / 2 - value * Math.PI * 2;
    const endX = CENTER + RADIUS * Math.cos(angle);
    const endY = CENTER + RADIUS * Math.sin(angle);
    const largeArc = value > 0.5 ? 1 : 0;

    return [
      `M ${CENTER} ${CENTER}`,
      `L ${CENTER} ${CENTER - RADIUS}`,
      `A ${RADIUS} ${RADIUS} 0 ${largeArc} 0 ${endX.toFixed(3)} ${endY.toFixed(3)}`,
      'Z'
    ].join(' ');
  }
</script>

<div
  class="relative grid size-8 shrink-0 place-items-center"
  title={`${remaining}s`}
  role="timer"
  aria-label={`${remaining} seconds remaining`}
>
  <svg class="size-8" viewBox="0 0 24 24" aria-hidden="true">
    {#if fraction >= FULL_CIRCLE_THRESHOLD}
      <circle cx={CENTER} cy={CENTER} r={RADIUS} class={expiring ? 'fill-error' : 'fill-primary'} />
    {:else if fraction > 0}
      <path d={piePath} class={expiring ? 'fill-error' : 'fill-primary'} />
    {/if}
  </svg>
  {#if showSeconds}
    <span
      class={[
        'absolute grid size-5 place-items-center rounded-full bg-base-100/90 text-[0.625rem] font-semibold tabular-nums shadow-sm',
        expiring ? 'text-error' : 'text-base-content/70'
      ]}
    >
      {remaining}
    </span>
  {/if}
</div>
