/**
 * XpsText — the studio's text object. Extends Fabric's Textbox and adds:
 *
 *   · effect: 'none' | 'arc' | 'wave'  (approved INC-3 effect set)
 *       arc  — signed bend −100…100: chars laid along a circular arc
 *              (positive arches up, negative valleys), tangent-rotated.
 *       wave — sine baseline offset (the "basic warp").
 *   · allCaps — transform-with-restore (xpsRawText keeps what was typed).
 *
 * Design constraints honoured:
 *   · Serialization-first: static type 'XpsText' + classRegistry
 *     registration. Effect props serialize via the global XPS_PROPS list
 *     (meta.ts) — toObject(propertiesToInclude) picks own-props by name, so
 *     no toObject override is needed and fabric's over-generic typing stays
 *     untouched. History (INC-2), JSON export (INC-7) and persistence
 *     (INC-8) handle effect text with zero special cases.
 *   · Effect text is not inline-editable (per-glyph rendering breaks
 *     Fabric's caret math — approved trade-off); content is edited via the
 *     Properties field. Straight text keeps native double-click editing.
 *   · Effect mode treats content as a single line (newlines become spaces)
 *     and renders uniform fill/stroke (no per-char styles, no underline).
 *   · toSVG for effect text (INC-7): one <text> element per glyph,
 *     positioned via `transform="translate(x y) rotate(deg)"` — the exact
 *     same local coordinates `_render` uses, so vector output matches the
 *     canvas pixel-for-pixel. Gradient fill/stroke on effect text exports
 *     as a flat solid (the gradient's first stop) rather than a true SVG
 *     gradient def — a documented simplification, not a silent guess (see
 *     `solidColorFor`); straight (non-effect) text is unaffected and keeps
 *     fabric's native gradient SVG export.
 *
 * Layout maths: glyph advances measured on an offscreen 2D context with the
 * exact font string; tracking = charSpacing/1000 em (Fabric's native unit,
 * exposed as ‰ in the panel). After layout, width/height are set to the
 * effect's real bounding box so selection chrome hugs the rendered result.
 */

import { Textbox, classRegistry, Gradient, type TClassProperties, type TOptions, type TextboxProps } from 'fabric'

export type TextEffect = 'none' | 'arc' | 'wave'

/** |amount| = 100 -> 252° of arc. Chosen so ±100 is dramatic but readable. */
const ARC_MAX_RAD = Math.PI * 1.4
const WAVE_CYCLES = 1
/** Ascent/descent approximation as fractions of fontSize (layout box). */
const ASCENT = 0.8
const DESCENT = 0.25

interface EffectGlyph {
  ch: string
  x: number
  y: number
  rot: number
}

const measureCtx = document.createElement('canvas').getContext('2d')

interface XpsTextExtra {
  effect: TextEffect
  effectAmount: number
  allCaps: boolean
  xpsRawText: string | null
}

export class XpsText extends Textbox {
  static type = 'XpsText'

  declare effect: TextEffect
  declare effectAmount: number
  declare allCaps: boolean
  declare xpsRawText: string | null

  private effectGlyphs: EffectGlyph[] = []

  /* Additions only — getDefaults() merges super's defaults. The annotation
     intersects the base static's own type so TS's weak-type check sees the
     shared optional props (fabric's Partial<TClassProperties<...>>). */
  static ownDefaults: Partial<TClassProperties<Textbox>> & XpsTextExtra = {
    effect: 'none',
    effectAmount: 50,
    allCaps: false,
    xpsRawText: null,
  }

  static cacheProperties = [
    ...Textbox.cacheProperties,
    'effect',
    'effectAmount',
    'allCaps',
  ]

  static getDefaults(): Record<string, unknown> {
    return { ...super.getDefaults(), ...XpsText.ownDefaults }
  }

  constructor(text: string, options?: TOptions<TextboxProps>) {
    super(text, options)
    if (this.effect !== 'none') {
      this.editable = false
      this.updateEffectLayout()
    }
  }

  /** The string the effect renders: caps applied, single line. */
  private displayText(): string {
    const raw = this.allCaps ? this.text.toUpperCase() : this.text
    return raw.replace(/\s*\n\s*/g, ' ')
  }

  private fontString(): string {
    return `${this.fontStyle || 'normal'} ${this.fontWeight} ${this.fontSize}px "${this.fontFamily}"`
  }

  /** Recompute glyph placement + real bounds. Call after any prop change. */
  updateEffectLayout(): void {
    if (this.effect === 'none' || !measureCtx) return
    const text = this.displayText()
    const fontSize = this.fontSize
    const tracking = (this.charSpacing / 1000) * fontSize
    measureCtx.font = this.fontString()

    const chars = [...text]
    const advances = chars.map(
      (ch) => measureCtx.measureText(ch).width + tracking,
    )
    const totalW = Math.max(
      advances.reduce((sum, advance) => sum + advance, 0) - tracking,
      1,
    )

    const glyphs: EffectGlyph[] = []
    let cursor = 0

    if (this.effect === 'arc') {
      const theta = (this.effectAmount / 100) * ARC_MAX_RAD
      if (Math.abs(theta) < 0.02) {
        this.layoutStraightFallback(chars, advances, totalW)
        return
      }
      const sign = Math.sign(theta)
      const magnitude = Math.abs(theta)
      const radius = totalW / magnitude
      for (let i = 0; i < chars.length; i++) {
        const mid = cursor + advances[i] / 2
        const phi = (mid / totalW - 0.5) * magnitude
        glyphs.push({
          ch: chars[i],
          x: radius * Math.sin(phi),
          y: sign * (radius - radius * Math.cos(phi)),
          rot: sign * phi,
        })
        cursor += advances[i]
      }
    } else {
      const amplitude = (this.effectAmount / 100) * fontSize * 0.5
      for (let i = 0; i < chars.length; i++) {
        const mid = cursor + advances[i] / 2
        glyphs.push({
          ch: chars[i],
          x: mid - totalW / 2,
          y: amplitude * Math.sin((mid / totalW) * Math.PI * 2 * WAVE_CYCLES),
          rot: 0,
        })
        cursor += advances[i]
      }
    }

    this.applyGlyphBounds(glyphs, advances, fontSize)
  }

  private layoutStraightFallback(
    chars: string[],
    advances: number[],
    totalW: number,
  ): void {
    const glyphs: EffectGlyph[] = []
    let cursor = 0
    for (let i = 0; i < chars.length; i++) {
      glyphs.push({ ch: chars[i], x: cursor + advances[i] / 2 - totalW / 2, y: 0, rot: 0 })
      cursor += advances[i]
    }
    this.applyGlyphBounds(glyphs, advances, this.fontSize)
  }

  private applyGlyphBounds(
    glyphs: EffectGlyph[],
    advances: number[],
    fontSize: number,
  ): void {
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    glyphs.forEach((glyph, i) => {
      const half = advances[i] / 2
      minX = Math.min(minX, glyph.x - half)
      maxX = Math.max(maxX, glyph.x + half)
      minY = Math.min(minY, glyph.y - fontSize * ASCENT)
      maxY = Math.max(maxY, glyph.y + fontSize * DESCENT)
    })
    if (!Number.isFinite(minX)) {
      minX = maxX = minY = maxY = 0
    }
    const width = Math.max(maxX - minX, 1)
    const height = Math.max(maxY - minY, 1)
    // Normalize glyphs so the bbox center is the object center.
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    this.effectGlyphs = glyphs.map((glyph) => ({
      ...glyph,
      x: glyph.x - cx,
      y: glyph.y - cy,
    }))
    this.set({ width, height, dirty: true })
    this.setCoords()
  }

  /** Resolve fill/stroke to a canvas style; our gradients are 2-stop
   *  percentage-unit, so a direct conversion beats fabric internals. */
  private liveStyle(
    ctx: CanvasRenderingContext2D,
    value: unknown,
  ): string | CanvasGradient | null {
    if (typeof value === 'string') return value
    if (value instanceof Gradient) {
      const w = this.width
      const h = this.height
      const c = value.coords as Record<string, number>
      const gradient =
        value.type === 'radial'
          ? ctx.createRadialGradient(
              c.x1 * w - w / 2, c.y1 * h - h / 2, (c.r1 ?? 0) * Math.min(w, h),
              c.x2 * w - w / 2, c.y2 * h - h / 2, (c.r2 ?? 0.5) * Math.min(w, h),
            )
          : ctx.createLinearGradient(
              c.x1 * w - w / 2, c.y1 * h - h / 2,
              c.x2 * w - w / 2, c.y2 * h - h / 2,
            )
      for (const stop of value.colorStops) {
        gradient.addColorStop(stop.offset, stop.color)
      }
      return gradient
    }
    return null
  }

  override _render(ctx: CanvasRenderingContext2D): void {
    if (this.effect === 'none') {
      super._render(ctx)
      return
    }
    if (this.effectGlyphs.length === 0) this.updateEffectLayout()
    ctx.save()
    ctx.font = this.fontString()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    const fill = this.liveStyle(ctx, this.fill)
    const stroke =
      this.strokeWidth > 0 ? this.liveStyle(ctx, this.stroke) : null
    // Glyph y is the visual center of the em box; baseline sits lower.
    const baselineShift = (this.fontSize * (ASCENT - DESCENT)) / 2
    for (const glyph of this.effectGlyphs) {
      ctx.save()
      ctx.translate(glyph.x, glyph.y)
      if (glyph.rot !== 0) ctx.rotate(glyph.rot)
      if (fill) {
        ctx.fillStyle = fill
        ctx.fillText(glyph.ch, 0, baselineShift)
      }
      if (stroke) {
        ctx.strokeStyle = stroke
        ctx.lineWidth = this.strokeWidth
        ctx.strokeText(glyph.ch, 0, baselineShift)
      }
      ctx.restore()
    }
    ctx.restore()
  }

  /** Solid-colour resolution for SVG export: gradients fall back to their
   *  first stop (documented simplification — see class docs). */
  private solidColorFor(value: unknown): string | null {
    if (typeof value === 'string') return value
    if (value instanceof Gradient) {
      return value.colorStops[0]?.color ?? null
    }
    return null
  }

  private static escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  override _toSVG(reviver?: (markup: string) => string): string[] {
    if (this.effect === 'none') return super._toSVG(reviver)
    if (this.effectGlyphs.length === 0) this.updateEffectLayout()

    const baselineShift = (this.fontSize * (ASCENT - DESCENT)) / 2
    const fillColor = this.solidColorFor(this.fill)
    const strokeColor =
      this.strokeWidth > 0 ? this.solidColorFor(this.stroke) : null
    const escape = XpsText.escapeXml

    const parts: string[] = ['COMMON_PARTS']
    for (const glyph of this.effectGlyphs) {
      const rotateDeg = (glyph.rot * 180) / Math.PI
      const transform = `translate(${glyph.x} ${glyph.y})${
        glyph.rot ? ` rotate(${rotateDeg})` : ''
      }`
      const style = [
        fillColor ? `fill: ${fillColor}; ` : 'fill: none; ',
        strokeColor ? `stroke: ${strokeColor}; stroke-width: ${this.strokeWidth}; ` : '',
        'white-space: pre;',
      ].join('')
      parts.push(
        `\t\t<text xml:space="preserve" x="0" y="${baselineShift}" ` +
          `font-family="${escape(this.fontFamily.replace(/"/g, "'"))}" ` +
          `font-size="${this.fontSize}" ` +
          (this.fontStyle ? `font-style="${escape(this.fontStyle)}" ` : '') +
          (this.fontWeight ? `font-weight="${escape(String(this.fontWeight))}" ` : '') +
          `text-anchor="middle" transform="${transform}" style="${style}">` +
          `${escape(glyph.ch)}</text>\n`,
      )
    }
    return parts
  }

  override toSVG(reviver?: (markup: string) => string): string {
    if (this.effect === 'none') return super.toSVG(reviver)
    return this._createBaseSVGMarkup(this._toSVG(reviver), {
      reviver,
      noStyle: true,
      withShadow: true,
    })
  }
}

classRegistry.setClass(XpsText)

/* ---- Creation + panel-facing prop setter --------------------------------- */

import type { Canvas } from 'fabric'
import { mmToWork } from '../lib/units'
import { tagObject } from './meta'
import { DEFAULT_FILL } from './shapes'
import { DEFAULT_FONT_FAMILY, ensureFontLoaded } from '../data/fonts'
import { commit, publishSelection } from './sync'

const DEFAULT_TEXT = 'Your text'
const DEFAULT_SIZE_MM = 12
const DEFAULT_BOX_MM = 80

/** T-tool click: place a Textbox in editing mode with content selected. */
export async function createTextAt(
  canvas: Canvas,
  x: number,
  y: number,
): Promise<void> {
  await ensureFontLoaded(DEFAULT_FONT_FAMILY, 400)
  const textbox = new XpsText(DEFAULT_TEXT, {
    left: x,
    top: y - mmToWork(DEFAULT_SIZE_MM) / 2,
    width: mmToWork(DEFAULT_BOX_MM),
    fontSize: mmToWork(DEFAULT_SIZE_MM),
    fontFamily: DEFAULT_FONT_FAMILY,
    fontWeight: 400,
    fill: DEFAULT_FILL,
    strokeWidth: 0,
  })
  tagObject(textbox, 'Text')
  canvas.add(textbox)
  canvas.setActiveObject(textbox)
  textbox.enterEditing()
  textbox.selectAll()
  commit(canvas)
}

export interface TextPatch {
  content?: string
  fontFamily?: string
  fontWeight?: number
  sizeMm?: number
  tracking?: number
  lineHeight?: number
  align?: string
  allCaps?: boolean
  effect?: TextEffect
  effectAmount?: number
}

/**
 * Apply a panel patch. Handles the allCaps transform-with-restore rules,
 * font readiness before re-measure, and the editable flag for effect text.
 */
let contentCommitTimer: number | undefined

export async function setTextProps(
  canvas: Canvas,
  textbox: XpsText,
  patch: TextPatch,
): Promise<void> {
  if (textbox.isEditing) textbox.exitEditing()
  const contentOnly =
    patch.content !== undefined && Object.keys(patch).length === 1

  if (patch.fontFamily !== undefined || patch.fontWeight !== undefined) {
    await ensureFontLoaded(
      patch.fontFamily ?? textbox.fontFamily,
      patch.fontWeight ?? (Number(textbox.fontWeight) || 400),
    )
  }

  const props: Record<string, unknown> = {}
  if (patch.fontFamily !== undefined) props.fontFamily = patch.fontFamily
  if (patch.fontWeight !== undefined) props.fontWeight = patch.fontWeight
  if (patch.sizeMm !== undefined) props.fontSize = mmToWork(Math.max(1, patch.sizeMm))
  if (patch.tracking !== undefined) props.charSpacing = patch.tracking
  if (patch.lineHeight !== undefined) props.lineHeight = Math.max(0.5, patch.lineHeight)
  if (patch.align !== undefined) props.textAlign = patch.align
  if (patch.effect !== undefined) props.effect = patch.effect
  if (patch.effectAmount !== undefined) {
    props.effectAmount = Math.max(-100, Math.min(100, patch.effectAmount))
  }

  /* allCaps transform-with-restore + content edits (see class docs). */
  const nextCaps = patch.allCaps ?? textbox.allCaps
  if (patch.content !== undefined) {
    props.text = nextCaps ? patch.content.toUpperCase() : patch.content
    props.xpsRawText = nextCaps ? patch.content : null
  } else if (patch.allCaps !== undefined && patch.allCaps !== textbox.allCaps) {
    if (patch.allCaps) {
      props.xpsRawText = textbox.text
      props.text = textbox.text.toUpperCase()
    } else {
      props.text = textbox.xpsRawText ?? textbox.text
      props.xpsRawText = null
    }
  }
  if (patch.allCaps !== undefined) props.allCaps = patch.allCaps

  textbox.set(props)

  const effectActive = textbox.effect !== 'none'
  textbox.editable = !effectActive
  if (effectActive) {
    textbox.updateEffectLayout()
  } else if (patch.effect !== undefined) {
    // Returning from an effect: restore natural textbox layout.
    textbox.initDimensions()
    textbox.setCoords()
  }

  /* Content typed in the panel arrives per keystroke; a commit per
     character would flood the 50-step history. Render + publish live,
     commit once the typing pauses. Everything else commits immediately. */
  if (contentOnly) {
    canvas.requestRenderAll()
    publishSelection(canvas)
    window.clearTimeout(contentCommitTimer)
    contentCommitTimer = window.setTimeout(() => commit(canvas), 600)
  } else {
    commit(canvas)
  }
}
