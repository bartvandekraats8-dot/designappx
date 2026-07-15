/**
 * Curated design fonts — the approved 10-font list (streetwear-bold ->
 * minimal), self-hosted via @fontsource so SVG/PDF exports can embed them
 * (INC-7). Weight lists are per-family and honest: single-weight display
 * faces expose exactly one weight; the UI never offers a weight that would
 * silently fake-bold.
 *
 * Licensing: Permanent Marker is Apache-2.0; all others are OFL.
 * IBM Plex Mono has no variable build — explicit weight-file imports only
 * (project rule; also applied to every family here for consistency).
 */

/* Side-effect CSS imports: latin subsets, 400 + 700 where the family has
   them. Vite dedupes files also imported by the shell (main.tsx). */
import '@fontsource/archivo-black/400.css'
import '@fontsource/anton/400.css'
import '@fontsource/bebas-neue/400.css'
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/700.css'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/700.css'
import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/700.css'
import '@fontsource/permanent-marker/400.css'
import '@fontsource/unbounded/400.css'
import '@fontsource/unbounded/700.css'

export interface CuratedFont {
  family: string
  weights: readonly number[]
  license: 'OFL' | 'Apache-2.0'
}

export const CURATED_FONTS: readonly CuratedFont[] = [
  { family: 'Archivo Black', weights: [400], license: 'OFL' },
  { family: 'Anton', weights: [400], license: 'OFL' },
  { family: 'Bebas Neue', weights: [400], license: 'OFL' },
  { family: 'Space Grotesk', weights: [400, 700], license: 'OFL' },
  { family: 'Inter', weights: [400, 700], license: 'OFL' },
  { family: 'DM Sans', weights: [400, 700], license: 'OFL' },
  { family: 'IBM Plex Mono', weights: [400, 700], license: 'OFL' },
  { family: 'Playfair Display', weights: [400, 700], license: 'OFL' },
  { family: 'Permanent Marker', weights: [400], license: 'Apache-2.0' },
  { family: 'Unbounded', weights: [400, 700], license: 'OFL' },
]

export const DEFAULT_FONT_FAMILY = 'Archivo Black'

export function weightsFor(family: string, customFonts: readonly string[]): readonly number[] {
  const curated = CURATED_FONTS.find((font) => font.family === family)
  if (curated) return curated.weights
  // Uploaded fonts register a single face; expose it as its natural weight.
  return customFonts.includes(family) ? [400] : [400, 700]
}

/** Resolve a browser-loaded state for family+weight before canvas measuring. */
export async function ensureFontLoaded(family: string, weight: number): Promise<void> {
  try {
    await document.fonts.load(`${weight} 16px "${family}"`)
  } catch {
    /* Missing faces fall back to browser defaults; measuring still works. */
  }
}
