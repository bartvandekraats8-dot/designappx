/**
 * Print-zone JPG export — INC-7. JPEG has no alpha channel, so the capture
 * needs a real opaque backdrop; `captureZoneDataUrl`'s `backgroundColor`
 * option temporarily sets `canvas.backgroundColor` for the capture (a
 * canvas-level property, independent of the overlay `filter` predicate) and
 * restores it afterward.
 */

import type { Canvas } from 'fabric'

import type { Garment } from '../data/garments'
import { EXPORT_MULTIPLIER } from '../lib/units'
import { buildExportFilename, triggerDownload } from './filename'
import { captureZoneDataUrl, type ExportScope } from '../canvas/renderZone'

export interface JpgResult {
  filename: string
  widthPx: number
  heightPx: number
}

const JPG_QUALITY = 0.92

export function exportZoneJpg(
  canvas: Canvas,
  garment: Garment,
  designName: string,
  backgroundColor: string,
  scope: ExportScope = { kind: 'zone' },
): JpgResult {
  const { dataUrl, widthWorkPx, heightWorkPx } = captureZoneDataUrl(
    canvas,
    garment,
    EXPORT_MULTIPLIER,
    { scope, format: 'jpeg', quality: JPG_QUALITY, backgroundColor },
  )

  const filename = `${buildExportFilename(designName, 'JPG')}.jpg`
  triggerDownload(dataUrl, filename)

  return {
    filename,
    widthPx: Math.floor(widthWorkPx * EXPORT_MULTIPLIER),
    heightPx: Math.floor(heightWorkPx * EXPORT_MULTIPLIER),
  }
}
