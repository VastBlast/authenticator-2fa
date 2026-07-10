interface AutoScrollInput {
  pointerY: number;
  top: number;
  bottom: number;
  scrollTop: number;
  maxScrollTop: number;
}

export function getAutoScrollVelocity(
  { pointerY, top, bottom, scrollTop, maxScrollTop }: AutoScrollInput,
  threshold = 56,
  maxVelocity = 1080
): number {
  const topDistance = pointerY - top;
  const bottomDistance = bottom - pointerY;

  if (topDistance < threshold && scrollTop > 0) {
    return -Math.min(maxVelocity, ((threshold - topDistance) / threshold) * maxVelocity);
  }
  if (bottomDistance < threshold && scrollTop < maxScrollTop) {
    return Math.min(maxVelocity, ((threshold - bottomDistance) / threshold) * maxVelocity);
  }
  return 0;
}

export function rubberbandOffset(value: number, min: number, max: number, dimension: number): number {
  const bound = value < min ? min : value > max ? max : null;
  if (bound === null) {
    return value;
  }
  if (dimension <= 0) {
    return bound;
  }

  const overshoot = value - bound;
  // Keep tracking continuous while progressively resisting movement past an edge.
  return bound + (overshoot * dimension * 0.55) / (dimension + 0.55 * Math.abs(overshoot));
}

export function moveItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  if (
    fromIndex < 0 ||
    fromIndex >= next.length ||
    toIndex < 0 ||
    toIndex >= next.length ||
    fromIndex === toIndex
  ) {
    return next;
  }

  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
