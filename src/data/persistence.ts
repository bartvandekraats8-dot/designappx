/**
 * Design/version/autosave persistence — INC-8. Pure IndexedDB CRUD; no
 * Fabric/canvas knowledge (that orchestration — building a record from the
 * live canvas, restoring one back onto it — lives in `canvas/designs.ts`
 * and `canvas/autosave.ts`). Failures degrade to session-only behaviour
 * (private browsing, quota) rather than throwing, matching the INC-3 font
 * store's own fallback pattern.
 */

import { db, type AutosaveRecord, type DesignRecord, type VersionRecord } from './db'

/** Bound version-history growth per design; oldest beyond this are pruned. */
const MAX_VERSIONS_PER_DESIGN = 20

export async function listDesigns(): Promise<DesignRecord[]> {
  try {
    const all = await (await db()).getAll('designs')
    return all.sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

export async function getDesign(id: string): Promise<DesignRecord | undefined> {
  try {
    return await (await db()).get('designs', id)
  } catch {
    return undefined
  }
}

export async function putDesign(record: DesignRecord): Promise<void> {
  try {
    await (await db()).put('designs', record)
  } catch {
    /* Quota/private mode: the in-memory session state still has the design. */
  }
}

export async function deleteDesign(id: string): Promise<void> {
  try {
    const database = await db()
    const tx = database.transaction(['designs', 'versions'], 'readwrite')
    await tx.objectStore('designs').delete(id)
    const versionIds = await tx.objectStore('versions').index('byDesign').getAllKeys(id)
    await Promise.all(versionIds.map((key) => tx.objectStore('versions').delete(key)))
    await tx.done
  } catch {
    /* ignore */
  }
}

export async function listVersions(designId: string): Promise<VersionRecord[]> {
  try {
    const all = await (await db()).getAllFromIndex('versions', 'byDesign', designId)
    return all.sort((a, b) => b.savedAt - a.savedAt)
  } catch {
    return []
  }
}

export async function addVersion(record: VersionRecord): Promise<void> {
  try {
    const database = await db()
    await database.put('versions', record)
    const existing = await database.getAllFromIndex('versions', 'byDesign', record.designId)
    if (existing.length > MAX_VERSIONS_PER_DESIGN) {
      const oldest = existing.sort((a, b) => a.savedAt - b.savedAt).slice(0, existing.length - MAX_VERSIONS_PER_DESIGN)
      await Promise.all(oldest.map((entry) => database.delete('versions', entry.id)))
    }
  } catch {
    /* ignore */
  }
}

export async function loadAutosave(): Promise<AutosaveRecord | null> {
  try {
    return (await (await db()).get('autosave', 'current')) ?? null
  } catch {
    return null
  }
}

export async function saveAutosave(record: AutosaveRecord): Promise<void> {
  try {
    await (await db()).put('autosave', record)
  } catch {
    /* ignore */
  }
}
