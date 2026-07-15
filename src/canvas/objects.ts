/**
 * Layer / object operations: reorder, lock, visibility, rename, duplicate,
 * delete, group, ungroup. All operate in scene coordinates; grouping uses
 * the Fabric 7 layout manager (verified: `Group.removeAll()` restores
 * children to scene coords via `exitGroup(child, false)`).
 */

import { ActiveSelection, Group, type Canvas, type FabricObject } from 'fabric'

import { mmToWork } from '../lib/units'
import { artworkObjects } from './history'
import {
  applyLockState,
  findById,
  nextId,
  tagObject,
  XPS_PROPS,
  type XpsObject,
} from './meta'
import { ARTWORK_START_INDEX } from './overlays'

export function layerById(canvas: Canvas, id: string): XpsObject | undefined {
  return findById(artworkObjects(canvas), id)
}

export function selectLayer(canvas: Canvas, id: string, additive: boolean): void {
  const object = layerById(canvas, id)
  if (!object || object.xpsLocked) return
  if (additive) {
    const current = canvas.getActiveObjects().filter((o) => o !== object)
    const selection = new ActiveSelection([...current, object], { canvas })
    canvas.discardActiveObject()
    canvas.setActiveObject(selection)
  } else {
    canvas.setActiveObject(object)
  }
  canvas.requestRenderAll()
}

/** Move a layer one step within the artwork band. dir 1 = toward front. */
export function moveLayer(canvas: Canvas, id: string, dir: 1 | -1): boolean {
  const artwork = artworkObjects(canvas)
  const object = findById(artwork, id)
  if (!object) return false
  const current = artwork.indexOf(object)
  const target = current + dir
  if (target < 0 || target >= artwork.length) return false
  canvas.moveObjectTo(object, ARTWORK_START_INDEX + target)
  canvas.requestRenderAll()
  return true
}

export function setLayerLocked(canvas: Canvas, id: string, locked: boolean): void {
  const object = layerById(canvas, id)
  if (!object) return
  object.xpsLocked = locked
  applyLockState(object)
  if (locked && canvas.getActiveObjects().includes(object)) {
    canvas.discardActiveObject()
  }
  canvas.requestRenderAll()
}

export function setLayerVisible(canvas: Canvas, id: string, visible: boolean): void {
  const object = layerById(canvas, id)
  if (!object) return
  object.set({ visible })
  if (!visible && canvas.getActiveObjects().includes(object)) {
    canvas.discardActiveObject()
  }
  canvas.requestRenderAll()
}

export function renameLayer(canvas: Canvas, id: string, name: string): void {
  const object = layerById(canvas, id)
  if (!object) return
  object.xpsName = name.trim() || object.xpsName
}

export function deleteSelection(canvas: Canvas): boolean {
  const objects = canvas.getActiveObjects()
  if (objects.length === 0) return false
  canvas.discardActiveObject()
  canvas.remove(...objects)
  canvas.requestRenderAll()
  return true
}

const DUPLICATE_OFFSET_MM = 5

export async function duplicateSelection(canvas: Canvas): Promise<boolean> {
  const objects = canvas.getActiveObjects() as XpsObject[]
  if (objects.length === 0) return false
  canvas.discardActiveObject()
  const offset = mmToWork(DUPLICATE_OFFSET_MM)
  const clones: FabricObject[] = []
  for (const object of objects) {
    const clone = (await object.clone([...XPS_PROPS])) as XpsObject
    clone.xpsId = nextId()
    clone.xpsName = `${object.xpsName ?? 'Object'} copy`
    clone.xpsLocked = false
    applyLockState(clone)
    clone.set({ left: clone.left + offset, top: clone.top + offset })
    clone.setCoords()
    clones.push(clone)
  }
  canvas.add(...clones)
  if (clones.length === 1) canvas.setActiveObject(clones[0])
  else canvas.setActiveObject(new ActiveSelection(clones, { canvas }))
  canvas.requestRenderAll()
  return true
}

export function groupSelection(canvas: Canvas): boolean {
  const objects = canvas.getActiveObjects()
  if (objects.length < 2) return false
  canvas.discardActiveObject()
  canvas.remove(...objects)
  const group = new Group(objects)
  tagObject(group, 'Group')
  canvas.add(group)
  canvas.setActiveObject(group)
  canvas.requestRenderAll()
  return true
}

export function ungroupSelection(canvas: Canvas): boolean {
  const active = canvas.getActiveObject()
  if (!active || active instanceof ActiveSelection || !(active instanceof Group)) {
    return false
  }
  const children = active.removeAll() as FabricObject[]
  canvas.remove(active)
  for (const child of children) {
    applyLockState(child as XpsObject)
    child.setCoords()
  }
  canvas.add(...children)
  canvas.setActiveObject(new ActiveSelection(children, { canvas }))
  canvas.requestRenderAll()
  return true
}
