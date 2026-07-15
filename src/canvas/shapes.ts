/**
 * Shape factories + fill construction.
 *
 * All geometry is created in WORK px (4 px per mm); strokes are specified in
 * mm and converted — they are artwork, so they scale with the print, unlike
 * the zoom-compensated guide chrome in overlays.ts.
 */

import { Ellipse, Gradient, Line, Polygon, Rect, type FabricObject } from 'fabric'

import { mmToWork } from '../lib/units'
import type { FillDesc, ShapeKind } from '../state/studio'
import { tagObject, type XpsObject } from './meta'

/** Default artwork ink — bold on paper, mirrors --slate-900-ish ink. */
export const DEFAULT_FILL = '#1C1B19'

export const SHAPE_LABELS: Record<ShapeKind, string> = {
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  polygon: 'Polygon',
  line: 'Line',
}

/** Points of a regular N-gon, radius `r`, flat-bottom-ish (apex up). */
export function ngonPoints(sides: number, r: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  const offset = -Math.PI / 2
  const step = (Math.PI * 2) / sides
  for (let i = 0; i < sides; i++) {
    const angle = offset + i * step
    points.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) })
  }
  return points
}

interface Box {
  left: number
  top: number
  width: number
  height: number
}

/** Create (untagged) preview geometry for the drag-draw interaction. */
export function createShape(kind: ShapeKind, sides: number, box: Box): FabricObject {
  const common = { fill: DEFAULT_FILL, strokeWidth: 0 }
  switch (kind) {
    case 'rect':
      return new Rect({ ...common, ...box })
    case 'ellipse':
      return new Ellipse({
        ...common,
        left: box.left,
        top: box.top,
        rx: box.width / 2,
        ry: box.height / 2,
      })
    case 'polygon': {
      const polygon = new Polygon(ngonPoints(sides, 50), { ...common })
      polygon.set({
        left: box.left,
        top: box.top,
        scaleX: box.width / Math.max(polygon.width, 0.001),
        scaleY: box.height / Math.max(polygon.height, 0.001),
      })
      return polygon
    }
    case 'line':
      return new Line([box.left, box.top, box.left + box.width, box.top + box.height], {
        stroke: DEFAULT_FILL,
        strokeWidth: mmToWork(1),
      })
  }
}

/** Finalize a drawn shape: identity, name, lock state. */
export function finalizeShape(object: FabricObject, kind: ShapeKind): XpsObject {
  return tagObject(object, SHAPE_LABELS[kind])
}

/* ---- Fill descriptors <-> fabric fills ---------------------------------- */

function linearCoordsFromAngle(angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180
  const dx = Math.cos(rad) / 2
  const dy = Math.sin(rad) / 2
  return { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy }
}

export function buildFill(desc: FillDesc): string | Gradient<'linear' | 'radial'> {
  if (desc.mode === 'solid') return desc.color
  if (desc.mode === 'linear') {
    return new Gradient({
      type: 'linear',
      gradientUnits: 'percentage',
      coords: linearCoordsFromAngle(desc.angle),
      colorStops: [
        { offset: 0, color: desc.from },
        { offset: 1, color: desc.to },
      ],
    })
  }
  return new Gradient({
    type: 'radial',
    gradientUnits: 'percentage',
    coords: { x1: 0.5, y1: 0.5, r1: 0, x2: 0.5, y2: 0.5, r2: 0.5 },
    colorStops: [
      { offset: 0, color: desc.from },
      { offset: 1, color: desc.to },
    ],
  })
}

/** Read an object's fill back into a descriptor (best effort, 2-stop). */
export function readFill(fill: unknown): FillDesc | null {
  if (typeof fill === 'string') return { mode: 'solid', color: fill }
  if (fill instanceof Gradient) {
    const stops = fill.colorStops
    const from = String(stops[0]?.color ?? '#000000')
    const to = String(stops[stops.length - 1]?.color ?? '#ffffff')
    if (fill.type === 'radial') return { mode: 'radial', from, to }
    const { x1, y1, x2, y2 } = fill.coords
    const angle =
      (Math.atan2((y2 as number) - (y1 as number), (x2 as number) - (x1 as number)) * 180) /
        Math.PI +
      90
    return { mode: 'linear', from, to, angle: Math.round(((angle % 360) + 360) % 360) }
  }
  return null
}
