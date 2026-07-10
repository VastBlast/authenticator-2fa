<script lang="ts">
  import type { Snippet } from 'svelte';
  import {
    modalScrim,
    modalSurface,
    type MotionDialogPlacement
  } from './transitions';

  interface Props {
    children: Snippet;
    onclose: () => void;
    placement?: MotionDialogPlacement;
    surfaceClass?: string;
    closeLabel: string;
  }

  let {
    children,
    onclose,
    placement = 'center',
    surfaceClass = '',
    closeLabel
  }: Props = $props();
  let outroing = false;

  function closeFromCancel(event: Event) {
    event.preventDefault();
    onclose();
  }

  function closeFromEscape(event: KeyboardEvent) {
    if (outroing || event.key !== 'Escape' || event.defaultPrevented) {
      return;
    }
    event.preventDefault();
    onclose();
  }
</script>

<svelte:window onkeydown={closeFromEscape} />

<dialog
  class={['modal modal-open motion-dialog', placement === 'sheet' ? 'modal-bottom' : 'modal-middle']}
  open
  oncancel={closeFromCancel}
>
  <div
    class={['modal-box motion-dialog-surface', surfaceClass]}
    transition:modalSurface|global={{ placement }}
    onoutrostart={() => (outroing = true)}
  >
    {@render children()}
  </div>
  <button
    class="modal-backdrop motion-dialog-scrim"
    type="button"
    aria-label={closeLabel}
    onclick={onclose}
    transition:modalScrim|global
  ></button>
</dialog>

<style>
  .motion-dialog.modal {
    background-color: transparent;
    opacity: 1;
    transition: none;
  }

  .motion-dialog-surface.modal-box {
    opacity: 1;
    transform: none;
    transform-origin: center;
    translate: 0;
    scale: 1;
    transition: none;
    will-change: transform, opacity;
  }

  .modal-bottom .motion-dialog-surface {
    transform-origin: bottom center;
  }

  .motion-dialog-scrim.modal-backdrop {
    border: 0;
    background-color: rgb(0 0 0 / 0.38);
    backdrop-filter: blur(2px);
    will-change: opacity;
  }

  :global(.motion-dialog:has(~ .motion-dialog)) .motion-dialog-scrim {
    visibility: hidden;
    backdrop-filter: none;
  }

  :global(.motion-dialog ~ .motion-dialog) .motion-dialog-scrim {
    opacity: 1 !important;
  }

  @media (prefers-reduced-transparency: reduce) {
    .motion-dialog-scrim.modal-backdrop {
      background-color: rgb(0 0 0 / 0.5);
      backdrop-filter: none;
    }
  }

  @media (prefers-contrast: more) {
    .motion-dialog-scrim.modal-backdrop {
      background-color: rgb(0 0 0 / 0.55);
      backdrop-filter: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .motion-dialog-surface.modal-box {
      transform: none;
      will-change: opacity;
    }
  }
</style>
