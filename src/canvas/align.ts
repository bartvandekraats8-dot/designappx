/**
 * Align & distribute — approved semantics:
 *   · target 'zone'      — align/distribute against the print-zone rect;
 *                          works for any selection size (single centers etc.)
 *   · target 'selection' — align against the union bounds of the selected
 *                          objects (needs ≥2; distribute needs ≥3)
 *
 * The classic robust approach: dissolve the ActiveSelection, operate on
 * plain objects in scene coordinates, reselect. This sidesteps every
 * relative-coordinate subtlety a scaled/rotated ActiveSelection introduces.
 */

import { ActiveSelection, type Canvas, type FabricObject } from 'fabric'

import { mmToWork } from '../lib/units'
import type { Garment } from '../data/garments'

export type AlignOp = 'left' | 'centerH' | 'right' | 'top' | 'middle' | 'bottom'
export type AlignTarget = 'selection' | 'zone'

interface SceneBox {
  object: FabricObject
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

function sceneBoxes(objects: FabricObject[]): SceneBox[] {
  return objects.map((object) => {
    const bounds = object.getBoundingRect()
    return {
      object,
      left: bounds.left,
      top: bounds.top,
      right: bounds.left + bounds.width,
      bottom: bounds.top + bounds.height,
      width: bounds.width,
      height: bounds.height,
    }
  })
}

function unionOf(boxes: SceneBox[]) {
  return {
    left: Math.min(...boxes.map((box) => box.left)),
    top: Math.min(...boxes.map((box) => box.top)),
    right: Math.max(...boxes.map((box) => box.right)),
    bottom: Math.max(...boxes.map((box) => box.bottom)),
  }
}

function shift(box: SceneBox, dx: number, dy: number): void {
  box.object.set({
    left: box.object.left + dx,
    top: box.object.top + dy,
  })
  box.object.setCoords()
}

function withDissolvedSelection(
  canvas: Canvas,
  fn: (objects: FabricObject[]) => boolean,
): boolean {
  const objects = canvas.getActiveObjects()
  if (objects.length === 0) return false
  canvas.discardActiveObject()
  const changed = fn(objects)
  if (objects.length === 1) canvas.setActiveObject(objects[0])
  else canvas.setActiveObject(new ActiveSelection(objects, { canvas }))
  canvas.requestRenderAll()
  return changed
}

export function alignSelection(
  canvas: Canvas,
  garment: Garment,
  op: AlignOp,
  target: AlignTarget,
): boolean {
  return withDissolvedSelection(canvas, (objects) => {
    if (target === 'selection' && objects.length < 2) return false
    const boxes = sceneBoxes(objects)
    const frame =
      target === 'zone'
        ? {
            left: 0,
            top: 0,
            right: mmToWork(garment.zone.widthMm),
            bottom: mmToWork(garment.zone.heightMm),
          }
        : unionOf(boxes)
    for (const box of boxes) {
      switch (op) {
        case 'left':
          shift(box, frame.left - box.left, 0)
          break
        case 'centerH':
          shift(box, (frame.left + frame.right) / 2 - (box.left + box.right) / 2, 0)
          break
        case 'right':
          shift(box, frame.right - box.right, 0)
          break
        case 'top':
          shift(box, 0, frame.top - box.top)
          break
        case 'middle':
          shift(box, 0, (frame.top + frame.bottom) / 2 - (box.top + box.bottom) / 2)
          break
        case 'bottom':
          shift(box, 0, frame.bottom - box.bottom)
          break
      }
    }
    return true
  })
}

export function distributeSelection(
  canvas: Canvas,
  garment: Garment,
  axis: 'h' | 'v',
  target: AlignTarget,
): boolean {
  return withDissolvedSelection(canvas, (objects) => {
    if (target === 'selection' && objects.length < 3) return false
    if (objects.length < 2) return false
    const boxes = sceneBoxes(objects)
    const horizontal = axis === 'h'
    boxes.sort((a, b) => (horizontal ? a.left - b.left : a.top - b.top))

    if (target === 'zone') {
      // Equal gaps across the zone, margins included.
      const span = horizontal
        ? mmToWork(garment.zone.widthMm)
        : mmToWork(garment.zone.heightMm)
      const totalSize = boxes.reduce(
        (sum, box) => sum + (horizontal ? box.width : box.height),
        0,
      )
      const gap = (span - totalSize) / (boxes.length + 1)
      let cursor = gap
      for (const box of boxes) {
        if (horizontal) shift(box, cursor - box.left, 0)
        else shift(box, 0, cursor - box.top)
        cursor += (horizontal ? box.width : box.height) + gap
      }
      return true
    }

    // Selection target: keep extremes, equalize gaps between.
    const first = boxes[0]
    const last = boxes[boxes.length - 1]
    const innerSpan = horizontal
      ? last.left - (first.left + first.width)
      : last.top - (first.top + first.height)
    const middles = boxes.slice(1, -1)
    const middleSize = middles.reduce(
      (sum, box) => sum + (horizontal ? box.width : box.height),
      0,
    )
    const gap = (innerSpan - middleSize) / (middles.length + 1)
    let cursor =
      (horizontal ? first.left + first.width : first.top + first.height) + gap
    for (const box of middles) {
      if (horizontal) shift(box, cursor - box.left, 0)
      else shift(box, 0, cursor - box.top)
      cursor += (horizontal ? box.width : box.height) + gap
    }
    return true
  })
}
