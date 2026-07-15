/**
 * Shared print-zone rasterization — artwork only, overlays excluded.
 *
 * Factored out of `exportPng.ts` (INC-1) so every raster export format (PNG,
 * JPG, the mockup preview's live capture) shares one verified viewport-reset
 * code path instead of separate copies.
 *
 * Contract (verified against fabric@7.4.0 `StaticCanvas.toCanvasElement`):
 * the crop box passed to `toDataURL` lives in viewport-transformed space and
 * the current zoom multiplies into the output, so the viewport transform is
 * reset to identity for the duration of the capture — the output size is
 * then exactly `cropWidth * multiplier`.
 *
 * INC-7 adds export scope: the whole zone (default), the current selection,
 * or a single named layer — each crops to that content's own bounding box
 * rather than the full zone, so a per-layer/selection export isn't mostly
 * empty canvas.
 */

import type { Canvas, FabricObject, TMat2D } from 'fabric'

import type { Garment } from '../data/garments'
import { mmToWork } from '../lib/units'
import { isOverlay } from './overlays'
import { artworkObjects } from './history'
import type { XpsObject } from './meta'

const IDENTITY: TMat2D = [1, 0, 0, 1, 0, 0]

export type ExportScope =
  | { kind: 'zone' }
  | { kind: 'selection' }
  | { kind: 'layer'; id: string }

/** Objects included in the given scope (overlays always excluded). */
export function scopeObjects(canvas: Canvas, scope: ExportScope): FabricObject[] {
  const artwork = artworkObjects(canvas)
  if (scope.kind === 'zone') return artwork
  if (scope.kind === 'selection') return canvas.getActiveObjects()
  return artwork.filter((object) => (object as XpsObject).xpsId === scope.id)
}

export interface CropBox {
  left: number
  top: number
  width: number
  height: number
}

const SCOPE_MARGIN_WORK_PX = 8

/** Bounding box (identity-viewport canvas space) of the scope's objects. */
export function scopeCropBox(
  canvas: Canvas,
  garment: Garment,
  scope: ExportScope,
): CropBox {
  if (scope.kind === 'zone') {
    return {
      left: 0,
      top: 0,
      width: mmToWork(garment.zone.widthMm),
      height: mmToWork(garment.zone.heightMm),
    }
  }
  const objects = scopeObjects(canvas, scope)
  if (objects.length === 0) {
    return { left: 0, top: 0, width: mmToWork(garment.zone.widthMm), height: mmToWork(garment.zone.heightMm) }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const object of objects) {
    const rect = object.getBoundingRect()
    minX = Math.min(minX, rect.left)
    minY = Math.min(minY, rect.top)
    maxX = Math.max(maxX, rect.left + rect.width)
    maxY = Math.max(maxY, rect.top + rect.height)
  }
  return {
    left: minX - SCOPE_MARGIN_WORK_PX,
    top: minY - SCOPE_MARGIN_WORK_PX,
    width: maxX - minX + SCOPE_MARGIN_WORK_PX * 2,
    height: maxY - minY + SCOPE_MARGIN_WORK_PX * 2,
  }
}

export interface CaptureOptions {
  scope?: ExportScope
  format?: 'png' | 'jpeg'
  quality?: number
  /** Opaque backdrop for JPEG (which has no alpha channel). */
  backgroundColor?: string
}

export interface CaptureResult {
  dataUrl: string
  widthWorkPx: number
  heightWorkPx: number
}

/** Capture a scope of the artwork as a data URL, overlays always excluded. */
export function captureZoneDataUrl(
  canvas: Canvas,
  garment: Garment,
  multiplier: number,
  options: CaptureOptions = {},
): CaptureResult {
  const scope = options.scope ?? { kind: 'zone' }
  const box = scopeCropBox(canvas, garment, scope)
  const targetIds =
    scope.kind === 'zone'
      ? null
      : new Set(scopeObjects(canvas, scope).map((o) => (o as XpsObject).xpsId))

  const previousVpt = [...canvas.viewportTransform] as TMat2D
  const previousBg = canvas.backgroundColor
  canvas.setViewportTransform(IDENTITY)
  if (options.backgroundColor) canvas.backgroundColor = options.backgroundColor
  try {
    const dataUrl = canvas.toDataURL({
      format: options.format ?? 'png',
      quality: options.quality ?? 1,
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
      multiplier,
      enableRetinaScaling: false,
      filter: (object) =>
        !isOverlay(object) && (targetIds === null || targetIds.has((object as XpsObject).xpsId)),
    })
    return { dataUrl, widthWorkPx: box.width, heightWorkPx: box.height }
  } finally {
    canvas.setViewportTransform(previousVpt)
    canvas.backgroundColor = previousBg
    canvas.requestRenderAll()
  }
}
