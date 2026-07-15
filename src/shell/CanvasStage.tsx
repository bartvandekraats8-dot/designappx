import { useEffect, useRef, useState, type RefObject } from 'react'
import { Canvas, FabricObject, Point } from 'fabric'

import { getGarment, type Garment } from '../data/garments'
import { WORK_PX_PER_MM } from '../lib/units'
import { useStudio, type LoadableDesign } from '../state/studio'
import {
  buildSnapGrid,
  buildZoneOverlays,
  ensureOverlayOrder,
  scaleOverlaysToZoom,
} from '../canvas/overlays'
import { restoreArtwork } from '../canvas/history'
import { applyToolMode, attachInteractions } from '../canvas/interactions'
import { registerOverlays, resetHistory, commit } from '../canvas/sync'
import { loadAutosave } from '../data/persistence'
import styles from './CanvasStage.module.css'

/*
 * The canvas stage — INC-2.
 *
 * A Fabric 7 canvas fills the viewport cell. World coordinates put the print
 * zone's top-left at (0,0) at 4 work-px per mm; the viewport transform does
 * all zooming/panning, published to the studio store so the rulers and the
 * status bar render from the same truth the canvas paints with.
 *
 * Zoom: mouse wheel / trackpad, cursor-anchored. Pan: space-hold drag or
 * middle-mouse drag (interactions.ts). Fit: controller (ToolRail button,
 * garment switch). Tool behaviour, drag-to-draw shapes, and the 5 mm snap
 * all live in interactions.ts; this component owns mounting, the overlay
 * lifecycle, and view maths.
 */

const MIN_ZOOM = 0.05
const MAX_ZOOM = 8
const FIT_MARGIN_PX = 56

/* Selection chrome — hex mirrors of Atelier Dark tokens (see tokens.css). */
const SELECTION_THEME = {
  cornerColor: '#F9F8F4',
  cornerStrokeColor: '#F5358A',
  cornerStyle: 'circle' as const,
  cornerSize: 9,
  transparentCorners: false,
  borderColor: '#F5358A',
  borderScaleFactor: 1.4,
  borderOpacityWhenMoving: 0.6,
}

/** Ruler label steps, mm. Chosen so major ticks stay >= ~56 screen px apart. */
const RULER_STEPS_MM = [1, 2, 5, 10, 20, 50, 100, 200, 500] as const
const RULER_MIN_MAJOR_PX = 56

function chooseRulerStep(pxPerMm: number): number {
  for (const step of RULER_STEPS_MM) {
    if (step * pxPerMm >= RULER_MIN_MAJOR_PX) return step
  }
  return RULER_STEPS_MM[RULER_STEPS_MM.length - 1]
}

function positiveMod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

interface RulerTick {
  mm: number
  screenPx: number
}

function buildTicks(
  lengthPx: number,
  pan: number,
  pxPerMm: number,
  stepMm: number,
): RulerTick[] {
  if (lengthPx <= 0) return []
  const stepPx = stepMm * pxPerMm
  const firstMm = Math.floor((0 - pan) / stepPx) * stepMm
  const lastMm = Math.ceil((lengthPx - pan) / stepPx) * stepMm
  const ticks: RulerTick[] = []
  for (let mm = firstMm; mm <= lastMm; mm += stepMm) {
    ticks.push({ mm, screenPx: pan + mm * pxPerMm })
    if (ticks.length > 200) break // hard guard; unreachable with sane steps
  }
  return ticks
}

interface OverlayRefs {
  overlaysRef: RefObject<FabricObject[]>
  gridRef: RefObject<FabricObject | null>
}

/** (Re)build the zone overlay set. Shared by the garment-change effect and
 *  `loadDesign` (INC-8), which needs it to run inline rather than wait a
 *  render cycle for the effect to notice the garment changed. */
function rebuildOverlaysFor(canvas: Canvas, garment: Garment, refs: OverlayRefs): void {
  canvas.remove(...refs.overlaysRef.current)
  const grid = buildSnapGrid(garment)
  grid.set({ visible: useStudio.getState().snapEnabled })
  refs.gridRef.current = grid
  const overlays = [...buildZoneOverlays(garment), grid]
  refs.overlaysRef.current = overlays
  registerOverlays(overlays)
  canvas.add(...overlays)
}

export function CanvasStage() {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<Canvas | null>(null)
  const overlaysRef = useRef<FabricObject[]>([])
  const gridRef = useRef<FabricObject | null>(null)
  const historyReadyRef = useRef(false)

  const garmentId = useStudio((state) => state.garmentId)
  const activeTool = useStudio((state) => state.activeTool)
  const snapEnabled = useStudio((state) => state.snapEnabled)
  const view = useStudio((state) => state.view)
  const viewMode = useStudio((state) => state.viewMode)
  const registerController = useStudio((state) => state.registerController)

  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })

  /* ---- Mount the Fabric canvas once -------------------------------------- */
  useEffect(() => {
    const host = hostRef.current
    const canvasEl = canvasElRef.current
    if (!host || !canvasEl) return

    Object.assign(FabricObject.ownDefaults, SELECTION_THEME)

    const rect = host.getBoundingClientRect()
    const canvas = new Canvas(canvasEl, {
      width: Math.max(1, Math.floor(rect.width)),
      height: Math.max(1, Math.floor(rect.height)),
      selection: false,
      renderOnAddRemove: false,
      fireMiddleClick: true,
      selectionColor: 'rgba(245, 53, 138, 0.07)',
      selectionBorderColor: '#F5358A',
      selectionLineWidth: 1,
      preserveObjectStacking: true,
    })
    fabricRef.current = canvas
    setViewportSize({ width: canvas.getWidth(), height: canvas.getHeight() })

    const syncView = () => {
      const vpt = canvas.viewportTransform
      scaleOverlaysToZoom(overlaysRef.current, vpt[0])
      canvas.requestRenderAll()
      useStudio
        .getState()
        .setView({ zoom: vpt[0], panX: vpt[4], panY: vpt[5] })
    }

    const fit = () => {
      const garment = getGarment(useStudio.getState().garmentId)
      const zoneW = garment.zone.widthMm * WORK_PX_PER_MM
      const zoneH = garment.zone.heightMm * WORK_PX_PER_MM
      const vw = canvas.getWidth()
      const vh = canvas.getHeight()
      if (vw < 2 || vh < 2) return
      const zoom = clamp(
        Math.min(
          (vw - FIT_MARGIN_PX * 2) / zoneW,
          (vh - FIT_MARGIN_PX * 2) / zoneH,
        ),
        MIN_ZOOM,
        MAX_ZOOM,
      )
      canvas.setViewportTransform([
        zoom,
        0,
        0,
        zoom,
        (vw - zoneW * zoom) / 2,
        (vh - zoneH * zoom) / 2,
      ])
      syncView()
    }

    canvas.on('mouse:wheel', (opt) => {
      const event = opt.e
      event.preventDefault()
      event.stopPropagation()
      const nextZoom = clamp(
        canvas.getZoom() * Math.pow(0.999, event.deltaY),
        MIN_ZOOM,
        MAX_ZOOM,
      )
      canvas.zoomToPoint(new Point(event.offsetX, event.offsetY), nextZoom)
      syncView()
    })

    const detachInteractions = attachInteractions(canvas, syncView)

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry || !fabricRef.current) return
      const { width, height } = entry.contentRect
      if (width < 1 || height < 1) return
      canvas.setDimensions({
        width: Math.floor(width),
        height: Math.floor(height),
      })
      setViewportSize({ width: Math.floor(width), height: Math.floor(height) })
      canvas.requestRenderAll()
    })
    resizeObserver.observe(host)

    /** Replace canvas artwork + project state from a saved design or
     *  autosave record (INC-8). Rebuilds overlays inline so ordering is
     *  deterministic rather than racing the garment-change effect below
     *  (which will also re-run once `setGarment` below updates the store —
     *  a harmless redundant overlay rebuild + commit). */
    const loadDesign = async (design: LoadableDesign): Promise<void> => {
      const garment = getGarment(design.garmentId)
      rebuildOverlaysFor(canvas, garment, { overlaysRef, gridRef })
      await restoreArtwork(canvas, JSON.stringify(design.artwork))
      ensureOverlayOrder(canvas, overlaysRef.current)
      historyReadyRef.current = true
      resetHistory(canvas)

      const state = useStudio.getState()
      state.setGarment(design.garmentId)
      state.setColor(design.colorId)
      state.setTechnique(design.technique)
      state.setScreenColorLimit(design.screenColorLimit)
      state.setDesignName(design.designName)
      state.setActiveDesignId(design.id)
      commit(canvas)
      state.controller?.fit()
    }

    registerController({ fit, loadDesign, canvas })

    /* Overlay build + initial fit live in the garment effect below, which
       runs after this one on mount (and on every StrictMode remount).
       Boot-time autosave restore (reload-survival, INC-8) races that
       default-garment mount harmlessly: `loadDesign` rebuilds overlays and
       artwork again once the record (if any) arrives. */
    let cancelled = false
    void loadAutosave().then((record) => {
      if (cancelled || !record) return
      void loadDesign({
        id: record.designId,
        designName: record.designName,
        garmentId: record.garmentId,
        colorId: record.colorId,
        technique: record.technique,
        screenColorLimit: record.screenColorLimit,
        artwork: record.artwork,
      })
    })

    return () => {
      cancelled = true
      registerController(null)
      detachInteractions()
      resizeObserver.disconnect()
      overlaysRef.current = []
      gridRef.current = null
      historyReadyRef.current = false
      fabricRef.current = null
      void canvas.dispose()
    }
  }, [registerController])

  /* ---- (Re)build zone overlays when the garment changes ------------------ */
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const garment = getGarment(garmentId)
    rebuildOverlaysFor(canvas, garment, { overlaysRef, gridRef })

    if (!historyReadyRef.current) {
      historyReadyRef.current = true
      resetHistory(canvas)
    } else {
      // Keep the canonical stack after the overlay swap.
      commit(canvas)
    }

    useStudio.getState().controller?.fit()
  }, [garmentId])

  /* ---- Tool + snap side-effects ------------------------------------------ */
  useEffect(() => {
    const canvas = fabricRef.current
    if (canvas) applyToolMode(canvas)
  }, [activeTool])

  useEffect(() => {
    const canvas = fabricRef.current
    const grid = gridRef.current
    if (!canvas || !grid) return
    grid.set({ visible: snapEnabled })
    canvas.requestRenderAll()
  }, [snapEnabled])

  /* ---- Rulers ------------------------------------------------------------- */
  const pxPerMm = WORK_PX_PER_MM * view.zoom
  const stepMm = chooseRulerStep(pxPerMm)
  const stepPx = stepMm * pxPerMm
  const minorPx = stepPx / 5
  const hTicks = buildTicks(viewportSize.width, view.panX, pxPerMm, stepMm)
  const vTicks = buildTicks(viewportSize.height, view.panY, pxPerMm, stepMm)
  const hOffset = positiveMod(view.panX, stepPx)
  const vOffset = positiveMod(view.panY, stepPx)

  return (
    <section
      className={styles.stage}
      aria-label="Canvas"
      aria-hidden={viewMode !== 'design'}
      style={viewMode === 'design' ? undefined : { display: 'none' }}
    >
      <div className={styles.corner} aria-hidden="true">
        mm
      </div>

      <div
        className={styles.rulerH}
        aria-hidden="true"
        style={{
          backgroundImage: `repeating-linear-gradient(to right, var(--color-border) 0 1px, transparent 1px ${stepPx}px), repeating-linear-gradient(to right, var(--color-hairline) 0 1px, transparent 1px ${minorPx}px)`,
          backgroundSize: `${stepPx}px 10px, ${minorPx}px 6px`,
          backgroundPosition: `${hOffset}px bottom, ${hOffset}px bottom`,
          backgroundRepeat: 'repeat-x, repeat-x',
        }}
      >
        {hTicks.map((tick) => (
          <span
            key={tick.mm}
            className={styles.hLabel}
            style={{ left: `${tick.screenPx}px` }}
          >
            {tick.mm}
          </span>
        ))}
      </div>

      <div
        className={styles.rulerV}
        aria-hidden="true"
        style={{
          backgroundImage: `repeating-linear-gradient(to bottom, var(--color-border) 0 1px, transparent 1px ${stepPx}px), repeating-linear-gradient(to bottom, var(--color-hairline) 0 1px, transparent 1px ${minorPx}px)`,
          backgroundSize: `10px ${stepPx}px, 6px ${minorPx}px`,
          backgroundPosition: `right ${vOffset}px, right ${vOffset}px`,
          backgroundRepeat: 'repeat-y, repeat-y',
        }}
      >
        {vTicks.map((tick) => (
          <span
            key={tick.mm}
            className={styles.vLabel}
            style={{ top: `${tick.screenPx}px` }}
          >
            {tick.mm}
          </span>
        ))}
      </div>

      <div ref={hostRef} className={styles.viewport}>
        <canvas ref={canvasElRef} className={styles.canvas} />
      </div>
    </section>
  )
}
