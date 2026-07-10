import { cubicOut, quintInOut, quintOut } from 'svelte/easing';
import { prefersReducedMotion } from 'svelte/motion';
import type { TransitionConfig } from 'svelte/transition';

export type MotionDialogPlacement = 'center' | 'sheet';

const STRONG_EASE_OUT = quintOut;
const STANDARD_EASE_OUT = cubicOut;
const SPATIAL_EASE = quintInOut;

export const FADE_TRANSITION = { duration: 140, easing: STANDARD_EASE_OUT };
export const PANEL_TRANSITION = { duration: 150, easing: STRONG_EASE_OUT };

interface ViewTransitionOptions {
  instant?: boolean;
  x: number;
}

function opacityTransition(duration: number): TransitionConfig {
  return {
    duration: prefersReducedMotion.current ? 100 : duration,
    easing: STANDARD_EASE_OUT,
    css: (t) => `opacity: ${t}`
  };
}

function surfaceTransition(
  placement: MotionDialogPlacement,
  duration: number
): TransitionConfig {
  const reduced = prefersReducedMotion.current;

  return {
    duration: reduced ? 120 : duration,
    easing: STRONG_EASE_OUT,
    css: (t, u) => {
      if (reduced) {
        return `opacity: ${t}; transform: none`;
      }

      const y = placement === 'sheet' ? `${u * 100}%` : `${u * 6}px`;
      const scale = placement === 'center' ? 0.97 + t * 0.03 : 1;
      return `opacity: ${t}; transform: translate3d(0, ${y}, 0) scale(${scale})`;
    }
  };
}

export function panelReveal(_node: Element): TransitionConfig {
  const reduced = prefersReducedMotion.current;

  return {
    duration: reduced ? 100 : 180,
    easing: STRONG_EASE_OUT,
    css: (t, u) =>
      `opacity: ${t}; transform: translate3d(0, ${reduced ? 0 : u * 5}px, 0)`
  };
}

export function viewTransition(
  _node: Element,
  { instant = false, x }: ViewTransitionOptions
): TransitionConfig {
  const reduced = prefersReducedMotion.current;
  const shouldTranslate = !instant && !reduced;

  return {
    duration: instant ? 0 : reduced ? 110 : 190,
    easing: SPATIAL_EASE,
    css: (t, u) =>
      `opacity: ${t}; transform: translate3d(${shouldTranslate ? u * x : 0}px, 0, 0)`
  };
}

export function modalScrim(_node: Element): TransitionConfig {
  return opacityTransition(160);
}

export function modalSurface(
  _node: Element,
  { placement = 'center' }: { placement?: MotionDialogPlacement } = {}
): TransitionConfig {
  return surfaceTransition(placement, placement === 'sheet' ? 220 : 200);
}
