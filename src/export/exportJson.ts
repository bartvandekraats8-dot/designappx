/**
 * JSON project export/import — INC-7. Wraps the INC-2 snapshot
 * serialization (`history.ts`'s `serializeArtwork`/`restoreArtwork`, the
 * same shape already proven by undo/redo) with the project-level state
 * that isn't part of the canvas itself, so a re-import restores everything
 * the designer had set, not just the artwork.
 */

import type { Canvas } from 'fabric'

import type { GarmentId, TextileColorId } from '../data/garments'
import type { TechniqueId } from '../print/printCheck'
import { serializeArtwork, restoreArtwork } from '../canvas/history'
import { buildExportFilename, triggerBlobDownload } from './filename'

const SCHEMA_VERSION = 1

export interface ProjectFile {
  schemaVersion: 1
  designName: string
  garmentId: GarmentId
  colorId: TextileColorId
  technique: TechniqueId
  screenColorLimit: number
  exportedAt: string
  artwork: { objects: Record<string, unknown>[] }
}

export interface ProjectMeta {
  designName: string
  garmentId: GarmentId
  colorId: TextileColorId
  technique: TechniqueId
  screenColorLimit: number
}

export function buildProjectJson(canvas: Canvas, meta: ProjectMeta): string {
  const artwork = JSON.parse(serializeArtwork(canvas)) as ProjectFile['artwork']
  const file: ProjectFile = {
    schemaVersion: SCHEMA_VERSION,
    designName: meta.designName,
    garmentId: meta.garmentId,
    colorId: meta.colorId,
    technique: meta.technique,
    screenColorLimit: meta.screenColorLimit,
    exportedAt: new Date().toISOString(),
    artwork,
  }
  return JSON.stringify(file, null, 2)
}

export function exportProjectJson(canvas: Canvas, meta: ProjectMeta): string {
  const json = buildProjectJson(canvas, meta)
  const blob = new Blob([json], { type: 'application/json' })
  triggerBlobDownload(blob, `${buildExportFilename(meta.designName, 'project')}.json`)
  return json
}

function isProjectFile(value: unknown): value is ProjectFile {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    candidate.schemaVersion === SCHEMA_VERSION &&
    typeof candidate.designName === 'string' &&
    typeof candidate.garmentId === 'string' &&
    typeof candidate.colorId === 'string' &&
    typeof candidate.technique === 'string' &&
    typeof candidate.screenColorLimit === 'number' &&
    !!candidate.artwork &&
    Array.isArray((candidate.artwork as { objects?: unknown }).objects)
  )
}

/** Restore artwork onto the canvas and return the project-level state to apply to the store. */
export async function importProjectJson(canvas: Canvas, jsonText: string): Promise<ProjectMeta> {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (!isProjectFile(parsed)) {
    throw new Error('That file is not a recognised [X] Print Studio project.')
  }
  await restoreArtwork(canvas, JSON.stringify(parsed.artwork))
  return {
    designName: parsed.designName,
    garmentId: parsed.garmentId as GarmentId,
    colorId: parsed.colorId as TextileColorId,
    technique: parsed.technique as TechniqueId,
    screenColorLimit: parsed.screenColorLimit,
  }
}
