/**
 * Fraunces = plant names and screen titles (Latin binomial in italic).
 * Archivo  = UI text, buttons, labels, body copy.
 *
 * Font family names must match exactly the filenames expo-font loads via the
 * plugin in app.config.ts (see @expo-google-fonts export names —
 * Fraunces_400Regular etc.).
 */
export const fontFamily = {
  displayRegular: 'Fraunces_400Regular',
  displaySemiBold: 'Fraunces_600SemiBold',
  displayItalic: 'Fraunces_400Regular_Italic',
  bodyRegular: 'Archivo_400Regular',
  bodyMedium: 'Archivo_500Medium',
} as const;

// Scale: 34 / 26 / 20 / 16 / 14 / 12. Body line height ×1.5.
export const fontSize = {
  display: 34,
  title: 26,
  subtitle: 20,
  body: 16,
  caption: 14,
  micro: 12,
} as const;

export const lineHeight = (size: number, multiplier = 1.5) => Math.round(size * multiplier);
