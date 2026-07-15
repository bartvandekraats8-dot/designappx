/**
 * Canvas -> store publication + the commit pipeline.
 *
 * `commit(canvas)` is the single funnel every mutation flows through:
 * push a history snapshot, refresh the layer list, republish the selection,
 * update undo/redo flags. Undo/redo live here too (restore + republish).
 */

import type { Canvas } from 'fabric'

import { useStudio, type LayerRow } from '../state/studio'
import { kindOf, type XpsObject } from './meta'
import {
  artworkObjects,
  canRedo,
  canUndo,
  historyPush,
  historyReset,
  redoState,
  restoreArtwork,
  undoState,
} from './history'
import { ensureOverlayOrder } from './overlays'
import { buildSelectionSnapshot } from './transform'
import { evaluatePrintCheck } from '../print/printCheck'
import { getTextileColor } from '../data/garments'
import { scheduleAutosave } from './autosave'
import type { FabricObject } from 'fabric'

let overlayList: readonly FabricObject[] = []

/** CanvasStage registers the current overlay set so order can be enforced. */
export function registerOverlays(overlays: readonly FabricObject[]): void {
  overlayList = overlays
}

export function publishSelection(canvas: Canvas): void {
  useStudio.getState().setSelection(buildSelectionSnapshot(canvas))
}

export function refreshLayers(canvas: Canvas): void {
  const activeIds = new Set(
    canvas.getActiveObjects().map((object) => (object as XpsObject).xpsId),
  )
  const rows: LayerRow[] = artworkObjects(canvas)
    .map((object) => {
      const tagged = object as XpsObject
      return {
        id: tagged.xpsId ?? '',
        name: tagged.xpsName ?? 'Object',
        kind: kindOf(object),
        locked: tagged.xpsLocked === true,
        visible: object.visible !== false,
        active: activeIds.has(tagged.xpsId),
      }
    })
    .reverse() // panel shows top-first
  useStudio.getState().setLayers(rows)
}

/**
 * Re-run the INC-5 print check and publish the result. Called from the
 * commit/publish funnel for every artwork mutation, and directly by the
 * PrintCheck panel for store-only triggers (technique / colour / limit).
 */
export function refreshPrintCheck(canvas: Canvas): void {
  const { technique, colorId, screenColorLimit, setPrintWarnings } =
    useStudio.getState()
  setPrintWarnings(
    evaluatePrintCheck(canvas, {
      technique,
      garmentColorHex: getTextileColor(colorId).hex,
      screenColorLimit,
    }),
  )
}

function publishHistoryFlags(): void {
  useStudio.getState().setHistoryFlags(canUndo(), canRedo())
}

/** Order overlays, snapshot history, republish everything. */
export function commit(canvas: Canvas): void {
  ensureOverlayOrder(canvas, overlayList)
  historyPush(canvas)
  refreshLayers(canvas)
  publishSelection(canvas)
  publishHistoryFlags()
  refreshPrintCheck(canvas)
  scheduleAutosave(canvas)
  canvas.requestRenderAll()
}

/** Publish without a history entry (selection changes, live drags). */
export function publish(canvas: Canvas): void {
  refreshLayers(canvas)
  publishSelection(canvas)
  refreshPrintCheck(canvas)
}

export function resetHistory(canvas: Canvas): void {
  historyReset(canvas)
  publishHistoryFlags()
  refreshLayers(canvas)
  publishSelection(canvas)
  refreshPrintCheck(canvas)
}

async function applyState(canvas: Canvas, state: string | null): Promise<void> {
  if (state === null) return
  await restoreArtwork(canvas, state)
  ensureOverlayOrder(canvas, overlayList)
  refreshLayers(canvas)
  publishSelection(canvas)
  publishHistoryFlags()
  refreshPrintCheck(canvas)
  scheduleAutosave(canvas)
  canvas.requestRenderAll()
}

export async function undo(canvas: Canvas): Promise<void> {
  await applyState(canvas, undoState())
}

export async function redo(canvas: Canvas): Promise<void> {
  await applyState(canvas, redoState())
}

/**
 * Restore an arbitrary artwork snapshot (a version-history entry, INC-8)
 * with a *fresh* undo baseline — unlike undo/redo, which preserve stack
 * position, restoring a named version is a new starting point.
 */
export async function restoreSnapshot(canvas: Canvas, snapshot: string): Promise<void> {
  await restoreArtwork(canvas, snapshot)
  ensureOverlayOrder(canvas, overlayList)
  resetHistory(canvas)
  scheduleAutosave(canvas)
  canvas.requestRenderAll()
}
