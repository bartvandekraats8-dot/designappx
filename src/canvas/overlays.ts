/**
 * Print-zone overlays — the paper artboard, bleed and safe-area guides, and
 * the corner registration marks.
 *
 * Overlays are ordinary Fabric objects living in the same world coordinates
 * as future artwork (zone top-left at 0,0), but they are:
 *   · never selectable or evented,
 *   · excluded from export via `isOverlay` (used as a `toDataURL` filter),
 *   · rendered zoom-compensated: guide strokes and registration marks keep a
 *     constant *screen* size, like ruler chrome, instead of fattening as the
 *     designer zooms in. `scaleOverlaysToZoom` is called on every view change.
 *
 * Colours are hex mirrors of the Atelier Dark tokens (`src/styles/tokens.css`)
 * because canvas fills cannot read CSS custom properties. If a token changes,
 * change it here too — each constant names its token.
 */

import { Circle, Group, Line, Rect, Shadow, type FabricObject } from 'fabric'

import { mmToWork } from '../lib/units'
import type { Garment } from '../data/garments'

/* Token mirrors — keep in sync with src/styles/tokens.css */
const PAPER = '#F9F8F4' /* --paper-100  hsl(40 36% 97%) */
const GUIDE_BLEED = '#6E6964' /* --slate-500  hsl(26 5% 41%) */
const GUIDE_SAFE = '#7A7168' /* --paper-ink-soft  hsl(28 8% 44%) */
const REGISTRATION = '#F5358A' /* --color-registration */
const PAPER_SHADOW = 'rgba(12, 9, 7, 0.55)' /* --shadow-paper, flattened */

/** Screen-space guide geometry (px at any zoom). */
const GUIDE_STROKE = 1.25
const GUIDE_DASH: readonly [number, number] = [7, 5]
const REG_SIZE = 22
const REG_STROKE = 1.25

/* Keyed on `object` rather than `FabricObject`: Fabric's `toDataURL` filter
   receives the StaticCanvas-flavoured base object type, which is not
   assignable to the interactive `FabricObject`. Identity is what we test,
   so the loose key sidesteps the variance without a cast. */
const overlaySet = new WeakSet<object>()

type OverlayKind = 'paper' | 'guide' | 'reg' | 'grid'
const overlayKind = new WeakMap<FabricObject, OverlayKind>()

function register(object: FabricObject, kind: OverlayKind): FabricObject {
  object.set({
    selectable: false,
    evented: false,
    excludeFromExport: true,
    objectCaching: false,
  })
  overlaySet.add(object)
  overlayKind.set(object, kind)
  return object
}

/** True for objects that belong to the zone chrome, not the artwork. */
export function isOverlay(object: object): boolean {
  return overlaySet.has(object)
}

function makeRegMark(centerX: number, centerY: number): FabricObject {
  const r = REG_SIZE / 2
  const gap = REG_SIZE * 0.14
  const circle = new Circle({
    left: 0,
    top: 0,
    originX: 'center',
    originY: 'center',
    radius: r * 0.42,
    fill: '',
    stroke: REGISTRATION,
    strokeWidth: REG_STROKE,
  })
  const lines = [
    new Line([0, -r, 0, -gap], {}),
    new Line([0, gap, 0, r], {}),
    new Line([-r, 0, -gap, 0], {}),
    new Line([gap, 0, r, 0], {}),
  ].map((line) => {
    line.set({
      originX: 'center',
      originY: 'center',
      stroke: REGISTRATION,
      strokeWidth: REG_STROKE,
    })
    return line
  })
  const group = new Group([circle, ...lines], {
    left: centerX,
    top: centerY,
    originX: 'center',
    originY: 'center',
    opacity: 0.9,
  })
  return register(group, 'reg')
}

/**
 * Build the full overlay set for a garment's print zone. World origin (0,0)
 * is the zone's top-left corner. Returned in back-to-front render order.
 */
export function buildZoneOverlays(garment: Garment): FabricObject[] {
  const w = mmToWork(garment.zone.widthMm)
  const h = mmToWork(garment.zone.heightMm)
  const bleed = mmToWork(garment.bleedMm)
  const safe = mmToWork(garment.safeMm)

  const paper = register(
    new Rect({
      left: 0,
      top: 0,
      width: w,
      height: h,
      fill: PAPER,
      rx: 2,
      ry: 2,
      shadow: new Shadow({
        color: PAPER_SHADOW,
        blur: 42,
        offsetX: 0,
        offsetY: 12,
      }),
    }),
    'paper',
  )

  const bleedGuide = register(
    new Rect({
      left: -bleed,
      top: -bleed,
      width: w + bleed * 2,
      height: h + bleed * 2,
      fill: '',
      stroke: GUIDE_BLEED,
      strokeWidth: GUIDE_STROKE,
      strokeDashArray: [...GUIDE_DASH],
    }),
    'guide',
  )

  const safeGuide = register(
    new Rect({
      left: safe,
      top: safe,
      width: w - safe * 2,
      height: h - safe * 2,
      fill: '',
      stroke: GUIDE_SAFE,
      strokeWidth: GUIDE_STROKE,
      strokeDashArray: [...GUIDE_DASH],
      opacity: 0.75,
    }),
    'guide',
  )

  const regMarks = [
    makeRegMark(0, 0),
    makeRegMark(w, 0),
    makeRegMark(0, h),
    makeRegMark(w, h),
  ]

  return [paper, bleedGuide, safeGuide, ...regMarks]
}

/**
 * Keep guide strokes and registration marks at constant screen size under
 * the given viewport zoom. Cheap — a handful of objects — and called from
 * the canvas' view-sync path.
 */
export function scaleOverlaysToZoom(
  objects: readonly FabricObject[],
  zoom: number,
): void {
  const safeZoom = Math.max(zoom, 0.0001)
  for (const object of objects) {
    const kind = overlayKind.get(object)
    if (kind === 'guide') {
      object.set({
        strokeWidth: GUIDE_STROKE / safeZoom,
        strokeDashArray: [GUIDE_DASH[0] / safeZoom, GUIDE_DASH[1] / safeZoom],
      })
      object.setCoords()
    } else if (kind === 'reg') {
      object.set({ scaleX: 1 / safeZoom, scaleY: 1 / safeZoom })
      object.setCoords()
    }
  }
}

/* Snap-grid colour: safe-guide tone at low alpha, on paper only. */
const GRID_LINE = 'rgba(122, 113, 104, 0.16)'
const GRID_STEP_MM = 5
const GRID_STROKE_WORK = 0.6

/**
 * 5 mm snap grid as a single cached Group clipped to the zone. World-space
 * on purpose (scales with zoom, like real layout paper); toggled via
 * `visible` from the snap setting. Kind 'grid' is exempt from
 * `scaleOverlaysToZoom`.
 */
export function buildSnapGrid(garment: Garment): FabricObject {
  const w = mmToWork(garment.zone.widthMm)
  const h = mmToWork(garment.zone.heightMm)
  const step = mmToWork(GRID_STEP_MM)
  const lines: FabricObject[] = []
  for (let x = step; x < w; x += step) {
    lines.push(
      new Line([x, 0, x, h], {
        stroke: GRID_LINE,
        strokeWidth: GRID_STROKE_WORK,
      }),
    )
  }
  for (let y = step; y < h; y += step) {
    lines.push(
      new Line([0, y, w, y], {
        stroke: GRID_LINE,
        strokeWidth: GRID_STROKE_WORK,
      }),
    )
  }
  const group = new Group(lines, { left: 0, top: 0 })
  group.set({ objectCaching: true })
  return register(group, 'grid')
}

/**
 * Enforce the canonical stack: [paper, grid, ...artwork, guides, reg marks].
 * Layer-panel index math relies on this exact layout (artwork starts at
 * index 2). Call after any add / reorder / restore.
 */
export function ensureOverlayOrder(
  canvas: { getObjects: () => FabricObject[]; moveObjectTo: (o: FabricObject, i: number) => void },
  overlays: readonly FabricObject[],
): void {
  const paper = overlays.find((o) => overlayKind.get(o) === 'paper')
  const grid = overlays.find((o) => overlayKind.get(o) === 'grid')
  const top = overlays.filter((o) => {
    const kind = overlayKind.get(o)
    return kind === 'guide' || kind === 'reg'
  })
  if (paper) canvas.moveObjectTo(paper, 0)
  if (grid) canvas.moveObjectTo(grid, 1)
  const total = canvas.getObjects().length
  for (const object of top) canvas.moveObjectTo(object, total - 1)
}

/** Index where artwork starts in the canonical stack (after paper + grid). */
export const ARTWORK_START_INDEX = 2
