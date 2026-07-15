/**
 * Print-technique check — INC-5.
 *
 * A pure rule engine that inspects the artwork on the canvas and produces
 * *advisory* warnings for the selected print technique. Nothing here ever
 * blocks an action or an export (per the phased plan's DoD): the output is
 * a plain list the UI renders, with per-warning dismissal handled in the
 * store.
 *
 * Evaluation model:
 *   · Runs inside the publish/commit funnel (sync.ts) so every artwork
 *     mutation refreshes it, and from the PrintCheck panel's effect for
 *     store-only triggers (technique / garment colour / colour-limit
 *     changes, which don't touch the canvas).
 *   · Walks artwork objects recursively through groups, carrying the
 *     cumulative scale so size-based rules (text mm height, stroke mm) see
 *     the *rendered* size, not the pre-scale geometry.
 *
 * Rule catalogue (all advisory, per MVP prompt <technique_warnings>):
 *   DTG          — thin/small light-coloured text over a darker fabric.
 *   Screen print — distinct-colour count over the configurable limit
 *                  (default 4 spot colours — locked project decision);
 *                  gradients flagged (halftone / spot-colour suggestion).
 *   Embroidery   — text under ~4 mm cap height; gradient fills (can't be
 *                  stitched); strokes under 1 mm (fine detail); thread
 *                  colour count surfaced as info.
 *   Sublimation  — polyester / light-fabric note; active warning on dark
 *                  garment colours (dye-sub is transparent dye, it cannot
 *                  print light-on-dark).
 *
 * Colour accounting: distinct normalised solid fills + stroke colours;
 * each gradient contributes its two stops AND raises its own flag where
 * the technique cares. Colours that can't be parsed (unexpected formats)
 * are skipped rather than guessed.
 *
 * Warning ids are stable (`technique:rule:objectId|global`) so dismissal
 * survives re-evaluation: a dismissed warning stays hidden until its id
 * drops out of the evaluation (condition fixed, technique switched) — if
 * the condition later re-triggers, the warning legitimately reappears.
 */

import { Gradient, Group, type Canvas, type FabricObject } from 'fabric'

import { workToMm } from '../lib/units'
import { artworkObjects } from '../canvas/history'
import { XpsText } from '../canvas/xpsText'
import { XpsImage } from '../canvas/xpsImage'
import type { XpsObject } from '../canvas/meta'

/* ---- Techniques (const list + derived union — no enums, TS6) ------------ */

export const TECHNIQUES = [
  {
    id: 'dtg',
    label: 'DTG',
    blurb: 'Direct-to-garment. Full colour and gradients print well; fine light detail on dark fabric can fill in.',
  },
  {
    id: 'screen',
    label: 'Screen print',
    blurb: 'One screen per spot colour. Strongest with a limited, deliberate palette.',
  },
  {
    id: 'embroidery',
    label: 'Embroidery',
    blurb: 'Stitched thread. Solid colours only; small text and fine detail don\u2019t survive the needle.',
  },
  {
    id: 'sublimation',
    label: 'Sublimation',
    blurb: 'Dye infused into polyester. Light fabrics only \u2014 the dye is transparent.',
  },
] as const

export type TechniqueId = (typeof TECHNIQUES)[number]['id']

export function getTechnique(id: TechniqueId) {
  return TECHNIQUES.find((entry) => entry.id === id) ?? TECHNIQUES[0]
}

/* ---- Warning shape ------------------------------------------------------- */

export type WarningSeverity = 'warning' | 'info'

export interface PrintWarning {
  /** Stable id: `technique:rule:objectId|global` — dismissal key. */
  id: string
  technique: TechniqueId
  severity: WarningSeverity
  message: string
  /** Layer name, when the warning points at a specific object. */
  objectName?: string
}

/* ---- Thresholds ---------------------------------------------------------- */

/** DTG: light text below this rendered size over a darker fabric fills in. */
const DTG_SMALL_TEXT_MM = 8
/** Minimum luminance gap for the "light on dark" comparison to fire. */
const LUMINANCE_DELTA = 0.25
/** Embroidery: cap height below this doesn't stitch legibly. */
const EMBROIDERY_MIN_TEXT_MM = 4
/** Cap-height approximation as a fraction of font size. */
const CAP_HEIGHT_RATIO = 0.7
/** Embroidery: strokes thinner than this are "fine detail". */
const EMBROIDERY_MIN_STROKE_MM = 1
/** Sublimation: garments darker than this luminance won't show dye. */
const SUBLIMATION_DARK_LUMINANCE = 0.5

export const DEFAULT_SCREEN_COLOR_LIMIT = 4

/* ---- Colour utilities ---------------------------------------------------- */

/** Parse #rgb/#rrggbb or rgb()/rgba() to [0..255] channels; null otherwise. */
function parseColor(value: string): [number, number, number] | null {
  const v = value.trim().toLowerCase()
  const hex3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v)
  if (hex3) {
    return [
      parseInt(hex3[1] + hex3[1], 16),
      parseInt(hex3[2] + hex3[2], 16),
      parseInt(hex3[3] + hex3[3], 16),
    ]
  }
  const hex6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/.exec(v)
  if (hex6) {
    return [parseInt(hex6[1], 16), parseInt(hex6[2], 16), parseInt(hex6[3], 16)]
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(v)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  return null
}

/** Canonical `#rrggbb` for de-duplication; null when unparseable. */
function normalizeColor(value: string): string | null {
  const rgb = parseColor(value)
  if (!rgb) return null
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

/** WCAG relative luminance, 0 (black) .. 1 (white); null if unparseable. */
export function relativeLuminance(value: string): number | null {
  const rgb = parseColor(value)
  if (!rgb) return null
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/* ---- Artwork walking ------------------------------------------------------ */

interface WalkedObject {
  object: FabricObject
  /** Cumulative |scale| through group nesting — rendered size factors. */
  scaleX: number
  scaleY: number
}

function walk(objects: FabricObject[], sx: number, sy: number, out: WalkedObject[]): void {
  for (const object of objects) {
    if (object.visible === false) continue
    const nsx = sx * Math.abs(object.scaleX ?? 1)
    const nsy = sy * Math.abs(object.scaleY ?? 1)
    if (object instanceof Group) {
      walk(object.getObjects(), nsx, nsy, out)
    } else {
      out.push({ object, scaleX: nsx, scaleY: nsy })
    }
  }
}

function flattenArtwork(canvas: Canvas): WalkedObject[] {
  const out: WalkedObject[] = []
  walk(artworkObjects(canvas), 1, 1, out)
  return out
}

function nameOf(object: FabricObject): string {
  return (object as XpsObject).xpsName ?? 'Object'
}

function idOf(object: FabricObject): string {
  return (object as XpsObject).xpsId ?? 'unknown'
}

interface ColorAccount {
  /** Distinct normalised solid colours (fills, gradient stops, strokes). */
  colors: Set<string>
  /** Objects carrying a gradient fill. */
  gradientObjects: WalkedObject[]
  /** True when any placed raster/vector image is present (uncountable). */
  hasImage: boolean
}

function accountColors(items: WalkedObject[]): ColorAccount {
  const colors = new Set<string>()
  const gradientObjects: WalkedObject[] = []
  let hasImage = false
  for (const item of items) {
    const { object } = item
    if (object instanceof XpsImage) {
      hasImage = true
      continue
    }
    const fill = object.fill
    if (fill instanceof Gradient) {
      gradientObjects.push(item)
      for (const stop of fill.colorStops ?? []) {
        const n = normalizeColor(String(stop.color))
        if (n) colors.add(n)
      }
    } else if (typeof fill === 'string' && fill) {
      const n = normalizeColor(fill)
      if (n) colors.add(n)
    }
    if (typeof object.stroke === 'string' && object.stroke && (object.strokeWidth ?? 0) > 0) {
      const n = normalizeColor(object.stroke)
      if (n) colors.add(n)
    }
  }
  return { colors, gradientObjects, hasImage }
}

/** A text object's dominant fill colour for luminance rules (gradient → first stop). */
function textFillColor(text: XpsText): string | null {
  const fill = text.fill
  if (fill instanceof Gradient) {
    const first = fill.colorStops?.[0]
    return first ? String(first.color) : null
  }
  return typeof fill === 'string' && fill ? fill : null
}

/* ---- Rule evaluation ------------------------------------------------------ */

export interface PrintCheckInput {
  technique: TechniqueId
  garmentColorHex: string
  screenColorLimit: number
}

export function evaluatePrintCheck(canvas: Canvas, input: PrintCheckInput): PrintWarning[] {
  const items = flattenArtwork(canvas)
  const warnings: PrintWarning[] = []
  const { technique } = input
  const push = (
    rule: string,
    severity: WarningSeverity,
    message: string,
    object?: FabricObject,
  ) => {
    warnings.push({
      id: `${technique}:${rule}:${object ? idOf(object) : 'global'}`,
      technique,
      severity,
      message,
      objectName: object ? nameOf(object) : undefined,
    })
  }

  const garmentLum = relativeLuminance(input.garmentColorHex)

  if (technique === 'dtg') {
    for (const { object, scaleY } of items) {
      if (!(object instanceof XpsText)) continue
      const renderedMm = workToMm(object.fontSize * scaleY)
      if (renderedMm >= DTG_SMALL_TEXT_MM) continue
      const fill = textFillColor(object)
      const fillLum = fill ? relativeLuminance(fill) : null
      if (fillLum === null || garmentLum === null) continue
      if (fillLum - garmentLum >= LUMINANCE_DELTA) {
        push(
          'thin-light-text',
          'warning',
          `Light text under ${DTG_SMALL_TEXT_MM} mm on a darker fabric \u2014 fine strokes may fill in with pretreatment. Consider a larger size or heavier weight.`,
          object,
        )
      }
    }
  }

  if (technique === 'screen') {
    const account = accountColors(items)
    if (account.colors.size > input.screenColorLimit) {
      push(
        'color-count',
        'warning',
        `${account.colors.size} distinct colours \u2014 over the ${input.screenColorLimit}-screen limit. Each colour is a separate screen; consolidate to spot colours.`,
      )
    }
    for (const item of account.gradientObjects) {
      push(
        'gradient',
        'warning',
        'Gradient fill \u2014 screen print reproduces gradients as halftone dots. Consider a spot-colour redesign or accept halftoning.',
        item.object,
      )
    }
    if (account.hasImage) {
      push(
        'image',
        'info',
        'Placed image \u2014 photographic art screen-prints as CMYK/simulated-process halftones, not counted toward the spot-colour tally.',
      )
    }
  }

  if (technique === 'embroidery') {
    const account = accountColors(items)
    for (const { object, scaleY } of items) {
      if (object instanceof XpsText) {
        const capMm = workToMm(object.fontSize * scaleY) * CAP_HEIGHT_RATIO
        if (capMm < EMBROIDERY_MIN_TEXT_MM) {
          push(
            'small-text',
            'warning',
            `Text \u2248${capMm.toFixed(1)} mm cap height \u2014 below the ~${EMBROIDERY_MIN_TEXT_MM} mm embroidery minimum. Letters will close up when stitched.`,
            object,
          )
        }
      }
    }
    for (const item of account.gradientObjects) {
      push(
        'gradient',
        'warning',
        'Gradient fill \u2014 thread is a solid colour; gradients can\u2019t be stitched. Convert to solid fills or stepped bands.',
        item.object,
      )
    }
    for (const { object, scaleX, scaleY } of items) {
      const strokeMm = workToMm((object.strokeWidth ?? 0) * ((scaleX + scaleY) / 2))
      if (typeof object.stroke === 'string' && object.stroke && strokeMm > 0 && strokeMm < EMBROIDERY_MIN_STROKE_MM) {
        push(
          'fine-stroke',
          'warning',
          `Stroke \u2248${strokeMm.toFixed(1)} mm \u2014 finer than a stitched satin line (~${EMBROIDERY_MIN_STROKE_MM} mm). Thicken or drop the outline.`,
          object,
        )
      }
    }
    if (account.hasImage) {
      push(
        'image',
        'warning',
        'Placed image \u2014 photographic detail cannot be embroidered; artwork must be redrawn as solid stitch regions.',
      )
    }
    push(
      'thread-count',
      'info',
      `Thread colours in design: ${account.colors.size || 0}. Each is a separate thread change.`,
    )
  }

  if (technique === 'sublimation') {
    push(
      'fabric',
      'info',
      'Sublimation requires high-polyester fabric; the dye bonds to polyester only.',
    )
    if (garmentLum !== null && garmentLum < SUBLIMATION_DARK_LUMINANCE) {
      push(
        'dark-garment',
        'warning',
        'Dark garment colour selected \u2014 sublimation dye is transparent and will not show on dark fabric. Choose white or a light colour.',
      )
    }
  }

  return warnings
}
