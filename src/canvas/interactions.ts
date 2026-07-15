/**
 * Pointer + keyboard interaction layer for the canvas.
 *
 * Owns: tool-mode switching (marquee selection only for the select tool),
 * drag-to-draw shapes (with shift constrain), the 5 mm snap-to-grid on move,
 * approved panning gestures (space-hold drag + middle-mouse drag), and
 * publishing selection / live-drag state to the store.
 *
 * All handlers read live state via `useStudio.getState()` — never via React
 * closures — so a single attach survives every tool/setting change.
 */

import { Line, Point, type Canvas, type FabricObject, type TPointerEventInfo } from 'fabric'

import { mmToWork } from '../lib/units'
import { getGarment } from '../data/garments'
import { useStudio } from '../state/studio'
import { createShape, finalizeShape } from './shapes'
import { createTextAt, XpsText } from './xpsText'
import { createImageFromFile, pickImageFile } from './xpsImage'
import { commit, publish, publishSelection } from './sync'

const SNAP_STEP_WORK = mmToWork(5)
const MIN_DRAW_WORK = mmToWork(2)
const DEFAULT_SIZE_WORK = mmToWork(40)

export function applyToolMode(canvas: Canvas): void {
  const tool = useStudio.getState().activeTool
  canvas.selection = tool === 'select'
  canvas.skipTargetFind = tool === 'shape'
  canvas.defaultCursor = tool === 'shape' ? 'crosshair' : 'default'
}

interface DrawState {
  originX: number
  originY: number
  object: FabricObject
}

export function attachInteractions(
  canvas: Canvas,
  syncView: () => void,
): () => void {
  let spaceHeld = false
  let panning = false
  let panLast: { x: number; y: number } | null = null
  let drawing: DrawState | null = null

  /* ---- keyboard: space-hold pan mode ------------------------------------ */
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code !== 'Space' || spaceHeld) return
    const target = event.target as HTMLElement | null
    if (target?.closest('input, textarea, [contenteditable="true"]')) return
    event.preventDefault()
    spaceHeld = true
    canvas.skipTargetFind = true
    canvas.selection = false
    canvas.setCursor('grab')
  }
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.code !== 'Space') return
    spaceHeld = false
    panning = false
    panLast = null
    applyToolMode(canvas)
    canvas.setCursor(canvas.defaultCursor)
  }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  /* ---- pointer ----------------------------------------------------------- */
  const onMouseDown = (opt: TPointerEventInfo<MouseEvent | TouchEvent>) => {
    const event = opt.e
    const isMiddle = 'button' in event && event.button === 1
    if (spaceHeld || isMiddle) {
      panning = true
      panLast = { x: opt.viewportPoint.x, y: opt.viewportPoint.y }
      canvas.setCursor('grabbing')
      return
    }
    const { activeTool, shapeKind, polygonSides, setNotice, setTool } =
      useStudio.getState()
    if (activeTool === 'text') {
      const point = opt.scenePoint
      setTool('select')
      void createTextAt(canvas, point.x, point.y).then(() => {
        applyToolMode(canvas)
      })
      return
    }
    if (activeTool === 'image') {
      const point = opt.scenePoint
      setTool('select')
      applyToolMode(canvas)
      const garment = getGarment(useStudio.getState().garmentId)
      const maxLongEdgeMm = Math.min(120, Math.min(garment.zone.widthMm, garment.zone.heightMm) * 0.6)
      void pickImageFile().then(async (file) => {
        if (!file) return
        try {
          const { object } = await createImageFromFile(file, point.x, point.y, maxLongEdgeMm)
          canvas.add(object)
          canvas.setActiveObject(object)
          commit(canvas)
        } catch (error) {
          setNotice(error instanceof Error ? error.message : 'Could not place that image.')
        }
      })
      return
    }
    if (activeTool !== 'shape') return
    const p = opt.scenePoint
    const object = createShape(shapeKind, polygonSides, {
      left: p.x,
      top: p.y,
      width: 0,
      height: 0,
    })
    object.set({ selectable: false, evented: false })
    canvas.add(object)
    drawing = { originX: p.x, originY: p.y, object }
  }

  const onMouseMove = (opt: TPointerEventInfo<MouseEvent | TouchEvent>) => {
    if (panning && panLast) {
      const dx = opt.viewportPoint.x - panLast.x
      const dy = opt.viewportPoint.y - panLast.y
      panLast = { x: opt.viewportPoint.x, y: opt.viewportPoint.y }
      canvas.relativePan(new Point(dx, dy))
      canvas.setCursor('grabbing')
      syncView()
      return
    }
    if (!drawing) return
    const { shapeKind } = useStudio.getState()
    const shift = 'shiftKey' in opt.e && opt.e.shiftKey === true
    const p = opt.scenePoint
    let dx = p.x - drawing.originX
    let dy = p.y - drawing.originY

    if (shapeKind === 'line') {
      if (shift) {
        // constrain to 45° steps
        const angle = Math.atan2(dy, dx)
        const step = Math.PI / 4
        const snapped = Math.round(angle / step) * step
        const len = Math.hypot(dx, dy)
        dx = Math.cos(snapped) * len
        dy = Math.sin(snapped) * len
      }
      // Lines are cheap: rebuild each move rather than trusting coord setters.
      canvas.remove(drawing.object)
      drawing.object = new Line(
        [drawing.originX, drawing.originY, drawing.originX + dx, drawing.originY + dy],
        {
          stroke: (drawing.object as Line).stroke,
          strokeWidth: (drawing.object as Line).strokeWidth,
          selectable: false,
          evented: false,
        },
      )
      canvas.add(drawing.object)
      canvas.requestRenderAll()
      return
    }

    if (shift) {
      const size = Math.max(Math.abs(dx), Math.abs(dy))
      dx = Math.sign(dx || 1) * size
      dy = Math.sign(dy || 1) * size
    }
    const left = Math.min(drawing.originX, drawing.originX + dx)
    const top = Math.min(drawing.originY, drawing.originY + dy)
    const width = Math.abs(dx)
    const height = Math.abs(dy)
    const object = drawing.object
    if (object.isType('Ellipse')) {
      object.set({ left, top, rx: width / 2, ry: height / 2, width, height })
    } else if (object.isType('Polygon')) {
      object.set({
        left,
        top,
        scaleX: width / Math.max(object.width, 0.001),
        scaleY: height / Math.max(object.height, 0.001),
      })
    } else {
      object.set({ left, top, width, height })
    }
    object.setCoords()
    canvas.requestRenderAll()
  }

  const onMouseUp = () => {
    if (panning) {
      panning = false
      panLast = null
      canvas.setCursor(spaceHeld ? 'grab' : canvas.defaultCursor)
      return
    }
    if (!drawing) return
    const { shapeKind, setTool } = useStudio.getState()
    let object = drawing.object
    drawing = null

    // Degenerate drag (or plain click) -> drop in a default-size shape.
    const tooSmall =
      shapeKind === 'line'
        ? Math.hypot(object.width, object.height) < MIN_DRAW_WORK
        : object.width * object.scaleX < MIN_DRAW_WORK ||
          object.height * object.scaleY < MIN_DRAW_WORK
    if (tooSmall) {
      const originLeft = object.left
      const originTop = object.top
      canvas.remove(object)
      object = createShape(shapeKind, useStudio.getState().polygonSides, {
        left: originLeft - DEFAULT_SIZE_WORK / 2,
        top: originTop - DEFAULT_SIZE_WORK / 2,
        width: DEFAULT_SIZE_WORK,
        height: shapeKind === 'line' ? 0 : DEFAULT_SIZE_WORK,
      })
      canvas.add(object)
    }

    finalizeShape(object, shapeKind)
    object.set({ selectable: true, evented: true })
    object.setCoords()
    setTool('select')
    applyToolMode(canvas)
    canvas.setActiveObject(object)
    commit(canvas)
  }

  /* ---- snap + live readouts ---------------------------------------------- */
  const onObjectMoving = (opt: { target: FabricObject }) => {
    if (useStudio.getState().snapEnabled) {
      const target = opt.target
      target.set({
        left: Math.round(target.left / SNAP_STEP_WORK) * SNAP_STEP_WORK,
        top: Math.round(target.top / SNAP_STEP_WORK) * SNAP_STEP_WORK,
      })
    }
    publishSelection(canvas)
  }
  const onObjectTransforming = () => publishSelection(canvas)
  const onObjectModified = () => commit(canvas)
  const onSelection = () => publish(canvas)
  const onTextChanged = () => publishSelection(canvas)
  const onEditingExited = (opt: { target?: FabricObject }) => {
    /* Inline edits of all-caps text: re-sync the raw text to what was
       actually typed so toggling caps off never restores stale content. */
    const target = opt.target
    if (target instanceof XpsText && target.allCaps) {
      target.xpsRawText = target.text
    }
    commit(canvas)
  }

  canvas.on('mouse:down', onMouseDown)
  canvas.on('mouse:move', onMouseMove)
  canvas.on('mouse:up', onMouseUp)
  canvas.on('object:moving', onObjectMoving)
  canvas.on('object:scaling', onObjectTransforming)
  canvas.on('object:rotating', onObjectTransforming)
  canvas.on('object:modified', onObjectModified)
  canvas.on('selection:created', onSelection)
  canvas.on('selection:updated', onSelection)
  canvas.on('selection:cleared', onSelection)
  canvas.on('text:changed', onTextChanged)
  canvas.on('text:editing:exited', onEditingExited)

  applyToolMode(canvas)

  return () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    canvas.off('mouse:down', onMouseDown)
    canvas.off('mouse:move', onMouseMove)
    canvas.off('mouse:up', onMouseUp)
    canvas.off('object:moving', onObjectMoving)
    canvas.off('object:scaling', onObjectTransforming)
    canvas.off('object:rotating', onObjectTransforming)
    canvas.off('object:modified', onObjectModified)
    canvas.off('selection:created', onSelection)
    canvas.off('selection:updated', onSelection)
    canvas.off('selection:cleared', onSelection)
    canvas.off('text:changed', onTextChanged)
    canvas.off('text:editing:exited', onEditingExited)
  }
}
