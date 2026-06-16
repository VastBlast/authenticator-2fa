<script lang="ts">
  interface Props {
    remaining: number;
    period: number;
  }

  let { remaining, period }: Props = $props();

  const RADIUS = 9;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  const fraction = $derived(period > 0 ? Math.max(0, Math.min(1, remaining / period)) : 0);
  const offset = $derived(CIRCUMFERENCE * (1 - fraction));
  const expiring = $derived(remaining <= 5);
</script>

<div class="relative grid size-8 shrink-0 place-items-center" title={`${remaining}s`}>
  <svg class="size-8 -rotate-90" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r={RADIUS} fill="none" class="stroke-base-300" stroke-width="2.5" />
    <circle
      cx="12"
      cy="12"
      r={RADIUS}
      fill="none"
      class={expiring ? 'stroke-error' : 'stroke-primary'}
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-dasharray={CIRCUMFERENCE}
      stroke-dashoffset={offset}
      style="transition: stroke-dashoffset 1s linear, stroke 0.3s ease;"
    />
  </svg>
  <span
    class={[
      'absolute text-xs font-semibold tabular-nums',
      expiring ? 'text-error' : 'text-base-content/60'
    ]}
    role="timer"
    aria-label={`${remaining} seconds remaining`}
  >
    {remaining}
  </span>
</div>
