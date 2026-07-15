/**
 * Artwork object metadata — identity, display name, lock state.
 *
 * These live as own-properties on the Fabric objects (not in a side table)
 * because they must travel through `toObject(XPS_PROPS)` into history
 * snapshots (INC-2), the JSON project export (INC-7), and persistence
 * (INC-8). The `XpsObject` intersection type is the single contained cast
 * boundary for them.
 *
 * INC-4 adds the image-source props (xpsSourceKind/Width/Height): the
 * *original*, pre-crop raster dimensions, needed because Fabric's own
 * `width`/`height`/`cropX`/`cropY` describe only the current crop window,
 * not the source it was cut from — see `src/canvas/xpsImage.ts`.
 */

import type { FabricObject } from 'fabric'

export interface XpsMeta {
  xpsId: string
  xpsName: string
  xpsLocked: boolean
}

export type XpsObject = FabricObject & Partial<XpsMeta>

/**
 * Property names serialized into every artwork snapshot (history, JSON
 * export, persistence) and every duplicate-clone. Includes the XpsText
 * effect props: toObject picks own-props by name, and objects that lack a
 * prop serialize it as undefined, which JSON.stringify drops — so one list
 * serves every object type.
 */
export const XPS_PROPS = [
  'xpsId',
  'xpsName',
  'xpsLocked',
  'effect',
  'effectAmount',
  'allCaps',
  'xpsRawText',
  'xpsSourceKind',
  'xpsSourceWidth',
  'xpsSourceHeight',
] as const

let idCounter = 0
const nameCounters = new Map<string, number>()

export function nextId(): string {
  idCounter += 1
  return `obj-${Date.now().toString(36)}-${idCounter}`
}

export function nextName(kindLabel: string): string {
  const n = (nameCounters.get(kindLabel) ?? 0) + 1
  nameCounters.set(kindLabel, n)
  return `${kindLabel} ${n}`
}

/** Lowercase fabric type tag ('rect', 'ellipse', 'polygon', 'line', 'group'). */
export function kindOf(object: FabricObject): string {
  const ctor = object.constructor as { type?: string }
  return (ctor.type ?? 'object').toLowerCase()
}

export function tagObject(
  object: FabricObject,
  kindLabel: string,
): XpsObject {
  const tagged = object as XpsObject
  tagged.xpsId = nextId()
  tagged.xpsName = nextName(kindLabel)
  tagged.xpsLocked = false
  return tagged
}

/** Re-apply interaction flags derived from lock state (used after restore). */
export function applyLockState(object: XpsObject): void {
  const locked = object.xpsLocked === true
  object.set({ selectable: !locked, evented: !locked })
}

export function findById(
  objects: readonly FabricObject[],
  id: string,
): XpsObject | undefined {
  return objects.find((entry) => (entry as XpsObject).xpsId === id) as
    | XpsObject
    | undefined
}
