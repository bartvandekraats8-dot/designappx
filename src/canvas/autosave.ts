/**
 * Debounced autosave — INC-8. Persists the *working draft* to a single idb
 * slot (`autosave` store, key `'current'`) so a reload never loses
 * in-progress edits. Deliberately separate from the named-design `designs`
 * store and its `versions` history: autosave never creates a version or
 * touches a saved design's own record — only an explicit "Save" does that
 * (`designs.ts`). On boot, if this slot has a record, it's what gets
 * restored (see `CanvasStage`'s `loadDesign` call) — ahead of whatever was
 * last explicitly saved, by design.
 */

import type { Canvas } from 'fabric'

import { useStudio } from '../state/studio'
import { saveAutosave } from '../data/persistence'
import { serializeArtwork } from './history'

const DEBOUNCE_MS = 1500

let timer: number | undefined

async function runAutosave(canvas: Canvas): Promise<void> {
  const state = useStudio.getState()
  const artwork = JSON.parse(serializeArtwork(canvas)) as {
    objects: Record<string, unknown>[]
  }
  await saveAutosave({
    id: 'current',
    designId: state.activeDesignId,
    designName: state.designName,
    garmentId: state.garmentId,
    colorId: state.colorId,
    technique: state.technique,
    screenColorLimit: state.screenColorLimit,
    artwork,
    updatedAt: Date.now(),
  })
}

/** Debounce autosave from the commit/undo/redo pipeline. */
export function scheduleAutosave(canvas: Canvas): void {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => void runAutosave(canvas), DEBOUNCE_MS)
}
