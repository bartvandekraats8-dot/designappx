/**
 * mm-precise transform math + the selection snapshot builder.
 *
 * Conventions (documented for the panel UI):
 *   · X / Y — the *bounding box* top-left in mm, zone-origin relative. For a
 *     rotated object this is the visual bounds corner, matching what design
 *     tools report.
 *   · W / H — the object's own geometry × scale (unrotated dimensions),
 *     excluding stroke. Editing W/H rescales geometry, never bakes it.
 */

import { ActiveSelection, Group, type Canvas, type FabricObject } from 'fabric'

import { mmToWork, workToMm } from '../lib/units'
import type { ImageSnapshot, SelectionSnapshot, TextSnapshot } from '../state/studio'
import { kindOf, type XpsObject } from './meta'
import { readFill } from './shapes'
import { XpsText } from './xpsText'
import { XpsImage, computeDpi, isBelowDpiThreshold, readCropInsetsMm } from './xpsImage'

export function geometrySize(object: FabricObject): { w: number; h: number } {
  return {
    w: object.width * object.scaleX,
    h: object.height * object.scaleY,
  }
}

export function buildSelectionSnapshot(canvas: Canvas): SelectionSnapshot | null {
  const active = canvas.getActiveObject()
  if (!active) return null
  const objects = canvas.getActiveObjects()
  const isMulti = active instanceof ActiveSelection
  const bounds = active.getBoundingRect()
  const { w, h } = geometrySize(active)
  const single = !isMulti ? (active as XpsObject) : null
  const kind = isMulti ? 'selection' : kindOf(active)
  const isGroup = !isMulti && active instanceof Group

  let image: ImageSnapshot | null = null
  if (active instanceof XpsImage) {
    const dpi = computeDpi(active)
    image = {
      kind: active.xpsSourceKind,
      placedWidthPx: Math.round(active.width),
      placedHeightPx: Math.round(active.height),
      dpi,
      belowThreshold: isBelowDpiThreshold(dpi),
      cropInsetsMm: readCropInsetsMm(active),
    }
  }

  let text: TextSnapshot | null = null
  if (active instanceof XpsText) {
    text = {
      content: active.text,
      fontFamily: active.fontFamily,
      fontWeight: Number(active.fontWeight) || 400,
      sizeMm: workToMm(active.fontSize),
      tracking: active.charSpacing,
      lineHeight: active.lineHeight,
      align: active.textAlign,
      allCaps: active.allCaps,
      effect: active.effect,
      effectAmount: active.effectAmount,
    }
  }

  return {
    count: objects.length,
    kind,
    xMm: workToMm(bounds.left),
    yMm: workToMm(bounds.top),
    wMm: workToMm(w),
    hMm: workToMm(h),
    angle: Math.round((((active.angle ?? 0) % 360) + 360) % 360),
    canResizeW: w > 0.01,
    canResizeH: h > 0.01,
    locked: single?.xpsLocked === true,
    fill: single && !isGroup && kind !== 'line' ? readFill(single.fill) : null,
    strokeColor:
      single && !isGroup
        ? typeof single.stroke === 'string' && single.strokeWidth > 0
          ? single.stroke
          : kind === 'line' && typeof single.stroke === 'string'
            ? single.stroke
            : null
        : null,
    strokeMm: single && !isGroup ? workToMm(single.strokeWidth ?? 0) : 0,
    text,
    image,
  }
}

export interface BoxPatch {
  xMm?: number
  yMm?: number
  wMm?: number
  hMm?: number
  angle?: number
}

/** Apply a numeric mm patch to the active object (single or selection). */
export function applyBoxPatch(canvas: Canvas, patch: BoxPatch): void {
  const active = canvas.getActiveObject()
  if (!active) return

  if (patch.angle !== undefined) {
    const center = active.getCenterPoint()
    active.set({ angle: ((patch.angle % 360) + 360) % 360 })
    active.setPositionByOrigin(center, 'center', 'center')
  }

  if (patch.wMm !== undefined && active.width > 0.01) {
    active.set({ scaleX: mmToWork(patch.wMm) / active.width })
  }
  if (patch.hMm !== undefined && active.height > 0.01) {
    active.set({ scaleY: mmToWork(patch.hMm) / active.height })
  }
  active.setCoords()

  // Position via bounding-rect delta so rotated objects land exactly.
  if (patch.xMm !== undefined || patch.yMm !== undefined) {
    const bounds = active.getBoundingRect()
    const dx = patch.xMm !== undefined ? mmToWork(patch.xMm) - bounds.left : 0
    const dy = patch.yMm !== undefined ? mmToWork(patch.yMm) - bounds.top : 0
    active.set({ left: active.left + dx, top: active.top + dy })
    active.setCoords()
  }
  canvas.requestRenderAll()
}

export function flipActive(canvas: Canvas, axis: 'x' | 'y'): void {
  const active = canvas.getActiveObject()
  if (!active) return
  if (axis === 'x') active.set({ flipX: !active.flipX })
  else active.set({ flipY: !active.flipY })
  active.setCoords()
  canvas.requestRenderAll()
}
