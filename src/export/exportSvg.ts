/**
 * Vector SVG export — INC-7.
 *
 * Text stays as real `<text>` elements (per the locked project default:
 * true vector, still editable) with fonts embedded as base64 `@font-face`
 * data URIs (`fontEmbed.ts`) rather than external references, so the file
 * is self-contained. Physical size comes from SVG's own width/height-vs-
 * viewBox split: `width`/`height` carry real mm units, `viewBox` carries
 * the canvas's own work-px coordinates (4 px/mm) — no unit conversion of
 * the artwork itself is needed.
 *
 * Overlays never appear (fabric's `toSVG` already skips any object with
 * `excludeFromExport`, which every overlay sets — see `canvas/overlays.ts`).
 * Selection/layer scope reuses the same trick: out-of-scope artwork gets
 * `excludeFromExport` toggled on for the duration of the call, then restored.
 */

import type { Canvas, FabricObject } from 'fabric'

import type { Garment } from '../data/garments'
import { formatMm, mmToWork, workToMm } from '../lib/units'
import { artworkObjects } from '../canvas/history'
import type { XpsObject } from '../canvas/meta'
import { scopeCropBox, scopeObjects, type ExportScope } from '../canvas/renderZone'
import { collectUsedFonts, buildEmbeddedFontFaceCss } from './fontEmbed'
import { buildExportFilename, triggerBlobDownload } from './filename'

export interface SvgResult {
  svg: string
  widthMm: number
  heightMm: number
}

export async function buildZoneSvg(
  canvas: Canvas,
  garment: Garment,
  scope: ExportScope = { kind: 'zone' },
  customFonts: readonly string[] = [],
  /** Symmetric expansion beyond the scope's own box — the PDF bleed box. */
  marginMm = 0,
): Promise<SvgResult> {
  const zoneBox = scopeCropBox(canvas, garment, scope)
  const marginWorkPx = mmToWork(marginMm)
  const box =
    marginMm === 0
      ? zoneBox
      : {
          left: zoneBox.left - marginWorkPx,
          top: zoneBox.top - marginWorkPx,
          width: zoneBox.width + marginWorkPx * 2,
          height: zoneBox.height + marginWorkPx * 2,
        }
  const widthMm = workToMm(box.width)
  const heightMm = workToMm(box.height)

  const inScope: FabricObject[] =
    scope.kind === 'zone' ? artworkObjects(canvas) : scopeObjects(canvas, scope)
  const scopeIds =
    scope.kind === 'zone' ? null : new Set(inScope.map((o) => (o as XpsObject).xpsId))

  const restore: Array<[FabricObject, boolean | undefined]> = []
  if (scopeIds) {
    for (const object of artworkObjects(canvas)) {
      if (!scopeIds.has((object as XpsObject).xpsId)) {
        restore.push([object, object.excludeFromExport])
        object.excludeFromExport = true
      }
    }
  }

  let raw: string
  try {
    raw = canvas.toSVG({
      suppressPreamble: false,
      width: `${formatMm(widthMm)}mm`,
      height: `${formatMm(heightMm)}mm`,
      viewBox: { x: box.left, y: box.top, width: box.width, height: box.height },
    })
  } finally {
    for (const [object, prev] of restore) object.excludeFromExport = prev ?? false
  }

  const usedFonts = collectUsedFonts(inScope)
  const fontCss = await buildEmbeddedFontFaceCss(usedFonts, customFonts)
  const svg = fontCss ? raw.replace('<defs>\n', `<defs>\n${fontCss}`) : raw

  return { svg, widthMm, heightMm }
}

/** Build the zone SVG and trigger a browser download. */
export async function exportZoneSvg(
  canvas: Canvas,
  garment: Garment,
  designName: string,
  scope: ExportScope = { kind: 'zone' },
  customFonts: readonly string[] = [],
): Promise<SvgResult> {
  const result = await buildZoneSvg(canvas, garment, scope, customFonts)
  const blob = new Blob([result.svg], { type: 'image/svg+xml' })
  triggerBlobDownload(blob, `${buildExportFilename(designName, 'SVG')}.svg`)
  return result
}
