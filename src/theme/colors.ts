/**
 * "Pocket herbarium" color palette.
 *
 * NOTE — contrast fix: lichen (#A8BE9A) on paper (#E9EDE4) gives ~1.7:1
 * contrast, far below the 4.5:1 needed for text. So lichen stays DECORATIVE
 * only: frames, dashed empty-slot borders, hairlines. Everywhere text is
 * needed (including the Latin name), moss is used instead (~7.9:1). Approved
 * plan decision — see the plan file's "Decision 2".
 */
export const colors = {
  ink: '#16241C', // primary text, dark surfaces, camera chrome
  paper: '#E9EDE4', // primary background
  moss: '#2F5D45', // primary action, high confidence, text-safe stand-in for lichen
  lichen: '#A8BE9A', // SECONDARY/DECORATION — frame, dashed border, hairline. DO NOT use for text.
  bloom: '#C4426B', // accent — at most one place on screen at a time
  signal: '#E4A62B', // uncertainty / warning state

  // derived helpers
  hairline: 'rgba(22, 36, 28, 0.12)', // thin line/border over ink
  overlay: 'rgba(22, 36, 28, 0.55)', // in-progress overlay on top of the camera
  mossTint: 'rgba(47, 93, 69, 0.10)', // filled background behind moss text/badges
  signalTint: 'rgba(228, 166, 43, 0.16)', // filled background behind signal text/badges
} as const;

export type ColorToken = keyof typeof colors;
