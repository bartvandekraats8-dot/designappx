/**
 * Print-zone PNG export at 300 DPI — the pipeline INC-1 exists to de-risk.
 *
 * Contract (verified against fabric@7.4.0 `StaticCanvas.toCanvasElement`):
 *
 *   · The crop box passed to `toDataURL` lives in *viewport-transformed*
 *     space, and the current zoom multiplies into the output. We therefore
 *     reset the viewport transform to identity for the duration of the
 *     export, making the crop box equal to zone world coordinates and the
 *     output size exactly `workPx * EXPORT_MULTIPLIER`.
 *   · `enableRetinaScaling` defaults to `false` inside `toDataURL`, so the
 *     multiplier is applied exactly (no devicePixelRatio contamination).
 *   · Overlays (paper, guides, registration marks) are excluded via the
 *     `filter` predicate — no visibility juggling, no render races.
 *   · The canvas background is never set, so the PNG is truly transparent.
 *
 * Known limitation, deliberate: `toDataURL` writes no pHYs (physical DPI)
 * chunk into the PNG. Pixel dimensions are the print contract at 300 DPI;
 * DPI metadata lives in the INC-7 spec sheet instead.
 */

import type { Canvas } from 'fabric'

import type { Garment } from '../data/garments'
import { EXPORT_MULTIPLIER, mmToExportPx } from '../lib/units'
import { buildExportFilename, triggerDownload } from '../export/filename'
import { captureZoneDataUrl, type ExportScope } from './renderZone'

export interface ExportResult {
  filename: string
  widthPx: number
  heightPx: number
}

/**
 * Export a print-zone scope as a transparent PNG at 300 DPI and trigger a
 * browser download. Artwork only — overlays are filtered out.
 */
export function exportZonePng(
  canvas: Canvas,
  garment: Garment,
  designName: string,
  scope: ExportScope = { kind: 'zone' },
): ExportResult {
  const { dataUrl, widthWorkPx, heightWorkPx } = captureZoneDataUrl(
    canvas,
    garment,
    EXPORT_MULTIPLIER,
    { scope },
  )

  const filename = `${buildExportFilename(designName, 'PNG')}.png`
  triggerDownload(dataUrl, filename)

  return {
    filename,
    widthPx: Math.floor(widthWorkPx * EXPORT_MULTIPLIER),
    heightPx: Math.floor(heightWorkPx * EXPORT_MULTIPLIER),
  }
}

/** Re-exported for callers that only need the zone's full-size 300 DPI pixel dimensions. */
export function zoneExportPx(garment: Garment): { widthPx: number; heightPx: number } {
  return {
    widthPx: mmToExportPx(garment.zone.widthMm),
    heightPx: mmToExportPx(garment.zone.heightMm),
  }
}
