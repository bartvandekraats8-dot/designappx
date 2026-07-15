/**
 * Studio store (zustand 5) — app-level state.
 *
 * The Fabric canvas remains the source of truth for artwork; this store
 * holds UI state plus *published snapshots* of canvas facts (selection box,
 * layer list, history flags) so React chrome never reaches into Fabric to
 * render. Mutations flow the other way: chrome calls operations with
 * `controller.canvas`, then those operations re-publish.
 */

import { create } from 'zustand'
import type { Canvas } from 'fabric'

import {
  getGarment,
  type GarmentId,
  type TextileColorId,
} from '../data/garments'
import type { ToolId } from './tools'
import {
  DEFAULT_SCREEN_COLOR_LIMIT,
  type PrintWarning,
  type TechniqueId,
} from '../print/printCheck'

export interface ViewTransform {
  zoom: number
  panX: number
  panY: number
}

export type ShapeKind = 'rect' | 'ellipse' | 'polygon' | 'line'

export interface TextSnapshot {
  content: string
  fontFamily: string
  fontWeight: number
  sizeMm: number
  /** Tracking in per-mille of an em (fabric charSpacing native unit). */
  tracking: number
  lineHeight: number
  align: string
  allCaps: boolean
  effect: 'none' | 'arc' | 'wave'
  effectAmount: number
}

/** Published snapshot of an XpsImage — INC-4. */
export interface ImageSnapshot {
  kind: 'raster' | 'svg'
  /** Current crop-window pixel size (post-crop, pre-scale). */
  placedWidthPx: number
  placedHeightPx: number
  /** null for vector (SVG) sources — DPI is not a meaningful concept there. */
  dpi: number | null
  belowThreshold: boolean
  cropInsetsMm: { top: number; right: number; bottom: number; left: number }
}

export type FillDesc =
  | { mode: 'solid'; color: string }
  | { mode: 'linear'; from: string; to: string; angle: number }
  | { mode: 'radial'; from: string; to: string }

/** Published snapshot of the current canvas selection, in mm. */
export interface SelectionSnapshot {
  count: number
  kind: string
  xMm: number
  yMm: number
  wMm: number
  hMm: number
  angle: number
  /** False when the base geometry cannot be scaled via W/H (zero-dim line axis). */
  canResizeW: boolean
  canResizeH: boolean
  locked: boolean
  /** null for multi-selections and groups (appearance editing is single-object). */
  fill: FillDesc | null
  strokeColor: string | null
  strokeMm: number
  /** Present when the selection is a single text object. */
  text: TextSnapshot | null
  /** Present when the selection is a single image object. */
  image: ImageSnapshot | null
}

export interface LayerRow {
  id: string
  name: string
  kind: string
  locked: boolean
  visible: boolean
  active: boolean
}

/** A design record's canvas-relevant fields, loose enough to take either a
 *  DesignRecord or an AutosaveRecord (INC-8) without an import cycle. */
export interface LoadableDesign {
  id: string | null
  designName: string
  garmentId: GarmentId
  colorId: TextileColorId
  technique: TechniqueId
  screenColorLimit: number
  artwork: { objects: Record<string, unknown>[] }
}

export interface StudioController {
  fit: () => void
  /** Replace the canvas artwork + project state from a saved design or
   *  autosave record, with a fresh undo baseline (INC-8). */
  loadDesign: (design: LoadableDesign) => Promise<void>
  /** The live Fabric canvas. Operations modules take it as their first arg. */
  canvas: Canvas
}

interface StudioState {
  designName: string
  garmentId: GarmentId
  colorId: TextileColorId
  /** Selected print technique (INC-5) — drives the advisory print check. */
  technique: TechniqueId
  /** Configurable screen-print spot-colour limit (INC-5). */
  screenColorLimit: number
  /** Latest print-check evaluation (INC-5). */
  printWarnings: PrintWarning[]
  /** Dismissed warning ids — session-scoped (INC-5). */
  dismissedWarnings: string[]
  /** Design canvas vs flat garment mockup preview (INC-6). */
  viewMode: 'design' | 'mockup'
  /** The currently open saved design, if any — null for unsaved work (INC-8). */
  activeDesignId: string | null
  /** Timestamp of the last manual save, for UI feedback (INC-8). */
  lastSavedAt: number | null
  view: ViewTransform
  activeTool: ToolId
  shapeKind: ShapeKind
  polygonSides: number
  snapEnabled: boolean
  selection: SelectionSnapshot | null
  layers: LayerRow[]
  canUndo: boolean
  canRedo: boolean
  notice: string | null
  noticeSeq: number
  /** Families of uploaded fonts (published by fontStore). */
  customFonts: string[]
  controller: StudioController | null
  setDesignName: (name: string) => void
  setGarment: (id: GarmentId) => void
  setColor: (id: TextileColorId) => void
  setView: (view: ViewTransform) => void
  setTool: (tool: ToolId) => void
  setShapeKind: (kind: ShapeKind) => void
  setPolygonSides: (sides: number) => void
  toggleSnap: () => void
  setSelection: (selection: SelectionSnapshot | null) => void
  setLayers: (layers: LayerRow[]) => void
  setHistoryFlags: (canUndo: boolean, canRedo: boolean) => void
  setNotice: (text: string | null) => void
  setTechnique: (technique: TechniqueId) => void
  setScreenColorLimit: (limit: number) => void
  setPrintWarnings: (warnings: PrintWarning[]) => void
  dismissWarning: (id: string) => void
  setViewMode: (mode: 'design' | 'mockup') => void
  setActiveDesignId: (id: string | null) => void
  setLastSavedAt: (timestamp: number | null) => void
  setCustomFonts: (families: string[]) => void
  registerController: (controller: StudioController | null) => void
}

export const useStudio = create<StudioState>()((set) => ({
  designName: 'Untitled design',
  garmentId: 'tshirt',
  colorId: 'black',
  technique: 'dtg',
  screenColorLimit: DEFAULT_SCREEN_COLOR_LIMIT,
  printWarnings: [],
  dismissedWarnings: [],
  viewMode: 'design',
  activeDesignId: null,
  lastSavedAt: null,
  view: { zoom: 1, panX: 0, panY: 0 },
  activeTool: 'select',
  shapeKind: 'rect',
  polygonSides: 6,
  snapEnabled: false,
  selection: null,
  layers: [],
  canUndo: false,
  canRedo: false,
  notice: null,
  noticeSeq: 0,
  customFonts: [],
  controller: null,

  setDesignName: (name) => set({ designName: name }),
  setGarment: (id) =>
    set((state) => {
      const garment = getGarment(id)
      const colorId = garment.colors.includes(state.colorId)
        ? state.colorId
        : garment.colors[0]
      return { garmentId: id, colorId }
    }),

  setColor: (id) => set({ colorId: id }),
  setView: (view) => set({ view }),
  setTool: (tool) => set({ activeTool: tool }),
  setShapeKind: (kind) => set({ shapeKind: kind }),
  setPolygonSides: (sides) =>
    set({ polygonSides: Math.min(12, Math.max(3, Math.round(sides))) }),
  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),
  setSelection: (selection) => set({ selection }),
  setLayers: (layers) => set({ layers }),
  setHistoryFlags: (canUndo, canRedo) => set({ canUndo, canRedo }),
  setNotice: (text) =>
    set((state) => ({ notice: text, noticeSeq: state.noticeSeq + 1 })),
  setTechnique: (technique) => set({ technique }),
  setScreenColorLimit: (limit) =>
    set({ screenColorLimit: Math.min(12, Math.max(1, Math.round(limit))) }),
  /**
   * Publish a fresh evaluation. Dismissals are pruned to ids still present
   * in the evaluation for the *current* technique (a fixed-then-re-broken
   * condition legitimately re-warns), while dismissals belonging to other
   * techniques are kept so switching away and back doesn't resurface them
   * for no reason within the session.
   */
  setPrintWarnings: (warnings) =>
    set((state) => {
      const currentIds = new Set(warnings.map((w) => w.id))
      const technique = warnings[0]?.technique ?? state.technique
      const dismissedWarnings = state.dismissedWarnings.filter(
        (id) => !id.startsWith(`${technique}:`) || currentIds.has(id),
      )
      return { printWarnings: warnings, dismissedWarnings }
    }),
  dismissWarning: (id) =>
    set((state) => ({
      dismissedWarnings: state.dismissedWarnings.includes(id)
        ? state.dismissedWarnings
        : [...state.dismissedWarnings, id],
    })),
  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveDesignId: (id) => set({ activeDesignId: id }),
  setLastSavedAt: (timestamp) => set({ lastSavedAt: timestamp }),
  setCustomFonts: (families) => set({ customFonts: families }),
  registerController: (controller) => set({ controller }),
}))
