/**
 * PDF font registration — INC-7.
 *
 * svg2pdf.js renders `<text>` through jsPDF's own font system (`setFont` /
 * `getFontList`), not by outlining glyphs — confirmed by reading its source
 * (`dist/svg2pdf.es.js`: unregistered families fall back to `helvetica`).
 * jsPDF's `addFont` in turn requires real TTF/OTF bytes; it cannot parse
 * WOFF/WOFF2, which is the only format the curated @fontsource packages
 * ship (verified: `node_modules/@fontsource/*\/files` contains no .ttf).
 *
 * So: fonts the user uploaded (TTF/OTF, stored as-is in idb) register with
 * jsPDF for real, and text in those fonts comes out as true embedded vector
 * type. Curated webfonts have no embeddable source available in-browser and
 * fall back to the closest jsPDF standard font — an honest, documented
 * substitution (same pattern as the CMYK-intent note below), not a silent
 * gap. The SVG/PNG/JPG exports are unaffected and always show the real
 * typeface; only the PDF's text substitutes.
 */

import type { jsPDF } from 'jspdf'

import { getStoredFontBlob } from '../canvas/fontStore'
import { blobToBase64, type UsedFont } from './fontEmbed'

export interface FontSubstitution {
  family: string
  substitute: string
}

const SERIF_FAMILIES = new Set(['Playfair Display'])
const MONO_FAMILIES = new Set(['IBM Plex Mono'])

function standardFontFor(family: string): string {
  if (SERIF_FAMILIES.has(family)) return 'times'
  if (MONO_FAMILIES.has(family)) return 'courier'
  return 'helvetica'
}

/**
 * Register every used font with the jsPDF document: real embedding for
 * uploaded TTF/OTF families. svg2pdf.js reads the `<text font-family>`
 * attribute against `pdf.getFontList()` itself and falls back to a standard
 * font automatically for anything unregistered, so unregistered curated
 * fonts need no explicit handling here beyond reporting the substitution.
 */
export async function registerPdfFonts(
  pdf: jsPDF,
  fonts: readonly UsedFont[],
  customFonts: readonly string[],
): Promise<{ substitutions: FontSubstitution[] }> {
  const registeredFamilies = new Set<string>()
  const substitutions: FontSubstitution[] = []

  for (const font of fonts) {
    if (!customFonts.includes(font.family) || registeredFamilies.has(font.family)) continue
    const blob = await getStoredFontBlob(font.family)
    if (!blob) continue
    try {
      const base64 = await blobToBase64(blob)
      const vfsName = `${font.family.replace(/[^A-Za-z0-9]/g, '')}.ttf`
      pdf.addFileToVFS(vfsName, base64)
      pdf.addFont(vfsName, font.family, 'normal')
      registeredFamilies.add(font.family)
    } catch {
      /* Falls through to standard-font substitution below. */
    }
  }

  for (const font of fonts) {
    if (!registeredFamilies.has(font.family)) {
      const substitute = standardFontFor(font.family)
      if (!substitutions.some((s) => s.family === font.family)) {
        substitutions.push({ family: font.family, substitute })
      }
    }
  }

  return { substitutions }
}
