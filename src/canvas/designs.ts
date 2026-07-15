/**
 * Named-design orchestration — INC-8. Bridges the live canvas/store to the
 * pure `data/persistence.ts` CRUD: builds a `DesignRecord`/`VersionRecord`
 * from the current canvas, or forks/deletes an existing one. Loading a
 * design back onto the canvas is `StudioController.loadDesign`
 * (`CanvasStage.tsx` owns the overlay-rebuild + undo-baseline sequencing);
 * this module only ever reads the canvas, never mutates it.
 *
 * Every manual save appends a version (the DoD's "version snapshot per
 * manual save"); autosave (`autosave.ts`) never does — it only updates the
 * single working-draft slot.
 */

import type { Canvas } from 'fabric'

import type { DesignRecord } from '../data/db'
import { getGarment } from '../data/garments'
import {
  addVersion,
  deleteDesign,
  getDesign,
  putDesign,
} from '../data/persistence'
import { useStudio } from '../state/studio'
import { captureZoneDataUrl } from './renderZone'
import { serializeArtwork } from './history'
import { mmToWork } from '../lib/units'

const THUMB_LONG_EDGE_PX = 240

function makeId(): string {
  return `design-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function captureThumbnail(canvas: Canvas): string {
  const garment = getGarment(useStudio.getState().garmentId)
  const longEdgeMm = Math.max(garment.zone.widthMm, garment.zone.heightMm)
  const multiplier = THUMB_LONG_EDGE_PX / mmToWork(longEdgeMm)
  return captureZoneDataUrl(canvas, garment, multiplier).dataUrl
}

async function buildRecord(canvas: Canvas, id: string, createdAt: number): Promise<DesignRecord> {
  const state = useStudio.getState()
  const artwork = JSON.parse(serializeArtwork(canvas)) as DesignRecord['artwork']
  return {
    id,
    name: state.designName,
    garmentId: state.garmentId,
    colorId: state.colorId,
    technique: state.technique,
    screenColorLimit: state.screenColorLimit,
    artwork,
    thumbnail: captureThumbnail(canvas),
    createdAt,
    updatedAt: Date.now(),
  }
}

/** Save over the active design, or create one if nothing is open yet. */
export async function saveActiveDesign(canvas: Canvas): Promise<DesignRecord> {
  const state = useStudio.getState()
  const id = state.activeDesignId ?? makeId()
  const existing = state.activeDesignId ? await getDesign(id) : undefined
  const record = await buildRecord(canvas, id, existing?.createdAt ?? Date.now())

  await putDesign(record)
  await addVersion({
    id: `${id}:${record.updatedAt}`,
    designId: id,
    artwork: record.artwork,
    thumbnail: record.thumbnail,
    savedAt: record.updatedAt,
  })
  useStudio.getState().setActiveDesignId(id)
  useStudio.getState().setLastSavedAt(record.updatedAt)
  return record
}

/** Fork the current canvas state into a brand-new design, active from now on. */
export async function saveAsNewDesign(canvas: Canvas): Promise<DesignRecord> {
  useStudio.getState().setActiveDesignId(null)
  return saveActiveDesign(canvas)
}

/** Copy a saved design's stored data into a new record. Doesn't touch the live canvas. */
export async function duplicateDesign(id: string): Promise<DesignRecord | null> {
  const source = await getDesign(id)
  if (!source) return null
  const now = Date.now()
  const copy: DesignRecord = {
    ...source,
    id: makeId(),
    name: `${source.name} copy`,
    createdAt: now,
    updatedAt: now,
  }
  await putDesign(copy)
  return copy
}

export async function removeDesign(id: string): Promise<void> {
  await deleteDesign(id)
  if (useStudio.getState().activeDesignId === id) {
    useStudio.getState().setActiveDesignId(null)
    useStudio.getState().setLastSavedAt(null)
  }
}
