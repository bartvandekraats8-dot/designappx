/**
 * Shared IndexedDB connection — `xps-studio`.
 *
 * One database, one `openDB` call, one upgrade callback keyed on
 * `oldVersion` — the locked INC-3 rule ("INC-8 extends THIS database,
 * never a second one") applies to every store added after fonts, not just
 * the first one. Bump `DB_VERSION` and add an `if (oldVersion < N)` branch
 * per future increment; never remove an old branch (a client upgrading
 * straight from v1 to v3 must still run every intermediate migration).
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

import type { GarmentId, TextileColorId } from './garments'
import type { TechniqueId } from '../print/printCheck'

export interface StoredFont {
  family: string
  blob: Blob
  addedAt: number
}

export interface DesignRecord {
  id: string
  name: string
  garmentId: GarmentId
  colorId: TextileColorId
  technique: TechniqueId
  screenColorLimit: number
  artwork: { objects: Record<string, unknown>[] }
  thumbnail: string
  createdAt: number
  updatedAt: number
}

export interface VersionRecord {
  id: string
  designId: string
  artwork: { objects: Record<string, unknown>[] }
  thumbnail: string
  savedAt: number
}

export interface AutosaveRecord {
  id: 'current'
  designId: string | null
  designName: string
  garmentId: GarmentId
  colorId: TextileColorId
  technique: TechniqueId
  screenColorLimit: number
  artwork: { objects: Record<string, unknown>[] }
  updatedAt: number
}

interface XpsDB extends DBSchema {
  fonts: {
    key: string
    value: StoredFont
  }
  designs: {
    key: string
    value: DesignRecord
  }
  versions: {
    key: string
    value: VersionRecord
    indexes: { byDesign: string }
  }
  autosave: {
    key: string
    value: AutosaveRecord
  }
}

export const DB_NAME = 'xps-studio'
export const DB_VERSION = 2

let dbPromise: Promise<IDBPDatabase<XpsDB>> | null = null

export function db(): Promise<IDBPDatabase<XpsDB>> {
  dbPromise ??= openDB<XpsDB>(DB_NAME, DB_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore('fonts', { keyPath: 'family' })
      }
      if (oldVersion < 2) {
        database.createObjectStore('designs', { keyPath: 'id' })
        const versions = database.createObjectStore('versions', { keyPath: 'id' })
        versions.createIndex('byDesign', 'designId')
        database.createObjectStore('autosave', { keyPath: 'id' })
      }
    },
  })
  return dbPromise
}
