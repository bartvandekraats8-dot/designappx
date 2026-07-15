/**
 * Font embedding for vector export (SVG/PDF) — INC-7.
 *
 * Fabric's own `createSVGFontFacesMarkup()` only emits `@font-face { src:
 * url('...') }` pointing at `config.fontPaths` — an external reference, not
 * an embedded one, so it doesn't survive the exported file leaving this
 * origin (a print shop opening it offline, for instance). This module
 * builds real embedded `@font-face` rules instead: curated fonts are
 * resolved by scanning `document.styleSheets` for the `@fontsource` rule
 * that's actually loaded (no hardcoded path table to drift out of sync);
 * uploaded fonts are read directly from their idb blob (`fontStore.ts`).
 * Either way the font bytes are fetched and inlined as a base64 data URI,
 * so the exported file is self-contained.
 */

import { Group, type FabricObject } from 'fabric'

import { XpsText } from '../canvas/xpsText'
import { getStoredFontBlob } from '../canvas/fontStore'

export interface UsedFont {
  family: string
  weight: number
  style: string
}

function walkText(objects: FabricObject[], out: XpsText[]): void {
  for (const object of objects) {
    if (object instanceof Group) {
      walkText(object.getObjects(), out)
    } else if (object instanceof XpsText) {
      out.push(object)
    }
  }
}

/** Distinct (family, weight, style) combinations used within `objects`. */
export function collectUsedFonts(objects: readonly FabricObject[]): UsedFont[] {
  const texts: XpsText[] = []
  walkText([...objects], texts)

  const seen = new Map<string, UsedFont>()
  for (const text of texts) {
    const weight = Number(text.fontWeight) || 400
    const style = text.fontStyle || 'normal'
    const key = `${text.fontFamily}|${weight}|${style}`
    if (!seen.has(key)) seen.set(key, { family: text.fontFamily, weight, style })
  }
  return [...seen.values()]
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function guessFormat(url: string): string {
  if (/\.woff2(\?|$)/i.test(url)) return 'woff2'
  if (/\.woff(\?|$)/i.test(url)) return 'woff'
  if (/\.[ot]tf(\?|$)/i.test(url)) return url.toLowerCase().includes('.otf') ? 'opentype' : 'truetype'
  return 'woff2'
}

/** Find the loaded @font-face rule for (family, weight, style) and fetch its src. */
async function fetchCuratedFontSrc(
  family: string,
  weight: number,
  style: string,
): Promise<{ blob: Blob; url: string } | null> {
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue // cross-origin stylesheet; not one of ours
    }
    for (const rule of Array.from(rules)) {
      if (rule.type !== CSSRule.FONT_FACE_RULE) continue
      const fontFace = rule as CSSFontFaceRule
      const ruleFamily = fontFace.style.getPropertyValue('font-family').replace(/["']/g, '').trim()
      if (ruleFamily.toLowerCase() !== family.toLowerCase()) continue
      const ruleWeightRaw = fontFace.style.getPropertyValue('font-weight').trim()
      const ruleWeights = ruleWeightRaw.split(/\s+/).map(Number).filter((n) => !Number.isNaN(n))
      const weightMatches =
        ruleWeights.length === 0 ||
        (ruleWeights.length === 1 ? ruleWeights[0] === weight : weight >= ruleWeights[0] && weight <= ruleWeights[1])
      if (!weightMatches) continue
      const ruleStyle = fontFace.style.getPropertyValue('font-style').trim() || 'normal'
      if (ruleStyle !== style) continue

      const src = fontFace.style.getPropertyValue('src')
      const match = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(src)
      if (!match) continue
      const url = new URL(match[1], sheet.href ?? document.baseURI).href
      try {
        const response = await fetch(url)
        if (!response.ok) continue
        return { blob: await response.blob(), url }
      } catch {
        continue
      }
    }
  }
  return null
}

/** Build a self-contained `<style>@font-face{...}</style>` block for the given fonts. */
export async function buildEmbeddedFontFaceCss(
  fonts: readonly UsedFont[],
  customFonts: readonly string[],
): Promise<string> {
  const blocks: string[] = []
  for (const font of fonts) {
    const isCustom = customFonts.includes(font.family)
    const resolved = isCustom
      ? await getStoredFontBlob(font.family).then((blob) => (blob ? { blob, url: '' } : null))
      : await fetchCuratedFontSrc(font.family, font.weight, font.style)
    if (!resolved) continue

    const base64 = await blobToBase64(resolved.blob)
    const format = isCustom ? guessFormat(font.family) : guessFormat(resolved.url)
    const mime = resolved.blob.type || 'font/woff2'
    blocks.push(
      `@font-face { font-family: '${font.family.replace(/'/g, "\\'")}'; ` +
        `font-weight: ${font.weight}; font-style: ${font.style}; ` +
        `src: url(data:${mime};base64,${base64}) format('${format}'); }`,
    )
  }
  if (blocks.length === 0) return ''
  return `<style type="text/css"><![CDATA[\n${blocks.join('\n')}\n]]></style>\n`
}
