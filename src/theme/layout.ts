export const SPACING_UNIT = 4;

export const spacing = (multiplier: number) => SPACING_UNIT * multiplier;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

// Accessibility: every touchable target is at least 44pt.
export const TOUCH_MIN = 44;

export const grid = {
  columns: 3,
  gap: spacing(3),
} as const;
