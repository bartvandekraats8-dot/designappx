/**
 * Snapshot history — approved INC-2 architecture.
 *
 * Serializes *artwork only* (overlays filtered out) as JSON strings on a
 * bounded stack. Restore removes artwork, re-enlivens from the snapshot,
 * and leaves the overlay chrome untouched. The same serialization shape is
 * the seed for the INC-7 JSON project export and INC-8 persistence.
 *
 * This module owns only the stacks + (de)serialization; user-facing
 * undo/redo (which also republishes selection/layers) lives in sync.ts.
 */

import { util, type Canvas, type FabricObject } from 'fabric'

import { isOverlay } from './overlays'
import { applyLockState, XPS_PROPS, type XpsObject } from './meta'

const LIMIT = 50

let stack: string[] = []
let index = -1

export function artworkObjects(canvas: Canvas): FabricObject[] {
  return canvas.getObjects().filter((object) => !isOverlay(object))
}

export function serializeArtwork(canvas: Canvas): string {
  return JSON.stringify({
    objects: artworkObjects(canvas).map((object) =>
      object.toObject([...XPS_PROPS]),
    ),
  })
}

export async function restoreArtwork(canvas: Canvas, snapshot: string): Promise<void> {
  const parsed = JSON.parse(snapshot) as { objects: Record<string, unknown>[] }
  canvas.discardActiveObject()
  canvas.remove(...artworkObjects(canvas))
  const revived = (await util.enlivenObjects(parsed.objects)) as FabricObject[]
  for (const object of revived) applyLockState(object as XpsObject)
  canvas.add(...revived)
}

export function historyReset(canvas: Canvas): void {
  stack = [serializeArtwork(canvas)]
  index = 0
}

export function historyPush(canvas: Canvas): void {
  const snapshot = serializeArtwork(canvas)
  if (stack[index] === snapshot) return
  stack = stack.slice(0, index + 1)
  stack.push(snapshot)
  if (stack.length > LIMIT) stack.shift()
  index = stack.length - 1
}

export function canUndo(): boolean {
  return index > 0
}

export function canRedo(): boolean {
  return index < stack.length - 1
}

export function undoState(): string | null {
  if (!canUndo()) return null
  index -= 1
  return stack[index]
}

export function redoState(): string | null {
  if (!canRedo()) return null
  index += 1
  return stack[index]
}
