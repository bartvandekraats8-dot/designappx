/**
 * XpsImage — the studio's image object. Extends Fabric's FabricImage and
 * adds:
 *
 *   · xpsSourceKind — 'raster' (PNG/JPG/WebP/GIF) or 'svg'. SVGs are
 *     rasterized on import (see `rasterizeSvg`) rather than kept as live
 *     vector — matches the flat-composite / raster-export scope approved
 *     for this project (INC-1 §2). Full vector passthrough (keeping an SVG
 *     editable / re-exportable as vector) is a real feature but a distinct
 *     one; deferred, tracked below.
 *   · xpsSourceWidth / xpsSourceHeight — the *original*, pre-crop raster
 *     pixel size. Fabric's own `width`/`height` describe only the current
 *     crop window (see crop math below), so the source size has to be
 *     remembered separately to make crop non-destructive and reversible.
 *
 * Crop model (approved INC-4 default — see decision log):
 *   Numeric mm insets (top/right/bottom/left), not drag handles. Chosen
 *   over an interactive crop-rectangle overlay for two reasons: (1) it
 *   matches the app's existing precision-input design language (X/Y/W/H/∠
 *   are already mm number fields, not drag handles — see Properties.tsx),
 *   and (2) it is exact, reversible, and independently verifiable by
 *   arithmetic, whereas a drag-handle implementation cannot be verified
 *   without a running browser and would ship first-pass unverified.
 *   Each apply re-derives cropX/cropY/width/height from the *original*
 *   uncropped source (never from the current crop state), so dialing an
 *   inset back down always recovers exactly that much of the source —
 *   crop is idempotent, not a one-way trim.
 *
 * DPI model: `computeDpi` divides the *currently visible* crop-window
 * pixel size (Fabric's `width`/`height`, post-crop) by the physical size
 * the object is displayed at (mm, from scaleX/scaleY), per axis, and
 * reports the worst axis. This is deliberately the same
 * "pixels stretched over this many inches" definition print shops use, and
 * it responds correctly to both cropping and resizing.
 *
 * Known/documented (INC-4, matches the project's existing candour about
 * scope):
 *   · SVG sources rasterize at a fixed 2400px long edge on import, not at
 *     their declared intrinsic size (many SVGs declare no width/height —
 *     browsers then report a useless natural size). Vector fidelity is
 *     therefore not preserved into SVG export (mirrors the INC-1 flat-
 *     composite call already made for mockups).
 *   · No image filters (brightness/contrast/etc.) — out of scope for
 *     INC-4's stated acceptance criteria (upload, crop/scale, DPI badge).
 *   · Crop UI is numeric-only; a drag-handle crop overlay is a reasonable
 *     future addition once there's a way to visually verify it.
 */

import { FabricImage, classRegistry, type TClassProperties } from 'fabric'

import { WORK_PX_PER_MM, MM_PER_INCH, EXPORT_DPI, mmToWork, workToMm } from '../lib/units'
import { tagObject } from './meta'

export type ImageSourceKind = 'raster' | 'svg'

interface XpsImageExtra {
  xpsSourceKind: ImageSourceKind
  xpsSourceWidth: number
  xpsSourceHeight: number
}

export class XpsImage extends FabricImage {
  static type = 'XpsImage'

  declare xpsSourceKind: ImageSourceKind
  declare xpsSourceWidth: number
  declare xpsSourceHeight: number

  static ownDefaults: Partial<TClassProperties<FabricImage>> & XpsImageExtra = {
    xpsSourceKind: 'raster',
    xpsSourceWidth: 0,
    xpsSourceHeight: 0,
  }

  static getDefaults(): Record<string, unknown> {
    return { ...super.getDefaults(), ...XpsImage.ownDefaults }
  }
}

classRegistry.setClass(XpsImage)

/* ---- File acceptance ---------------------------------------------------- */

const RASTER_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif']
const SVG_EXTENSION = '.svg'

export const IMAGE_FILE_ACCEPT =
  '.png,.jpg,.jpeg,.webp,.gif,.svg,image/png,image/jpeg,image/webp,image/gif,image/svg+xml'

function detectKind(file: File): ImageSourceKind | null {
  const name = file.name.toLowerCase()
  if (file.type === 'image/svg+xml' || name.endsWith(SVG_EXTENSION)) return 'svg'
  if (file.type.startsWith('image/') || RASTER_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return 'raster'
  }
  return null
}

/* ---- File picker (canvas-driven, not React) ------------------------------
 * Mirrors the font-upload input in Properties.tsx, but triggered from the
 * image tool's canvas click rather than a panel button — so it needs its
 * own transient <input>. Most browsers fire 'cancel' on the dialog being
 * dismissed with no selection; as a backstop for the few that don't, we
 * also resolve(null) shortly after the window regains focus with nothing
 * selected. */
export function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = IMAGE_FILE_ACCEPT
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    let settled = false
    const finish = (file: File | null) => {
      if (settled) return
      settled = true
      window.removeEventListener('focus', onFocus)
      input.remove()
      resolve(file)
    }
    const onFocus = () => {
      window.setTimeout(() => {
        if (!settled && input.files?.length === 0) finish(null)
      }, 300)
    }
    input.addEventListener('change', () => finish(input.files?.[0] ?? null))
    input.addEventListener('cancel', () => finish(null))
    window.addEventListener('focus', onFocus)
    document.body.append(input)
    input.click()
  })
}

/* ---- Loading ---------------------------------------------------------- */

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode image'))
    img.src = src
  })
}

/** Long edge (px) SVGs are rasterized to on import — see class docstring. */
const SVG_RASTER_LONG_EDGE = 2400

async function rasterizeSvg(dataUrl: string): Promise<HTMLCanvasElement> {
  const img = await loadHtmlImage(dataUrl)
  const naturalW = img.naturalWidth || 300
  const naturalH = img.naturalHeight || 150
  const longEdge = Math.max(naturalW, naturalH)
  const scale = longEdge > 0 ? SVG_RASTER_LONG_EDGE / longEdge : 1
  const width = Math.max(1, Math.round(naturalW * scale))
  const height = Math.max(1, Math.round(naturalH * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)
  return canvas
}

export interface PlacedImageResult {
  object: XpsImage
  kind: ImageSourceKind
}

/**
 * Build a tagged, placed XpsImage from a File, centered on (sceneX, sceneY).
 * Default display size fits within a sensible cap so a large source photo
 * doesn't land at its full native mm size; caller passes the cap (depends
 * on the current garment's zone, so lives in interactions.ts).
 */
export async function createImageFromFile(
  file: File,
  sceneX: number,
  sceneY: number,
  maxLongEdgeMm: number,
): Promise<PlacedImageResult> {
  const kind = detectKind(file)
  if (!kind) throw new Error('Unsupported file type — use PNG, JPG, WebP, GIF, or SVG.')

  const dataUrl = await readAsDataURL(file)
  let element: HTMLImageElement | HTMLCanvasElement
  if (kind === 'svg') {
    element = await rasterizeSvg(dataUrl)
  } else {
    element = await loadHtmlImage(dataUrl)
  }

  const image = new XpsImage(element)
  const sourceW = image.width
  const sourceH = image.height
  image.xpsSourceKind = kind
  image.xpsSourceWidth = sourceW
  image.xpsSourceHeight = sourceH

  const longEdgePx = Math.max(sourceW, sourceH)
  const targetLongEdgeWork = mmToWork(maxLongEdgeMm)
  const scale = longEdgePx > 0 ? Math.min(1, targetLongEdgeWork / longEdgePx) : 1
  // Never upscale a small source past 1:1 — that would silently manufacture
  // a false DPI reading. Small sources simply place at their native size.
  const displayScale = scale > 0 ? scale : 1

  const workW = sourceW * displayScale
  const workH = sourceH * displayScale

  image.set({
    scaleX: displayScale,
    scaleY: displayScale,
    left: sceneX - workW / 2,
    top: sceneY - workH / 2,
    selectable: true,
    evented: true,
  })
  image.setCoords()

  tagObject(image, kind === 'svg' ? 'Image (vector)' : 'Image')

  return { object: image, kind }
}

/* ---- DPI ---------------------------------------------------------------- */

export function computeDpi(image: XpsImage): number | null {
  if (image.xpsSourceKind === 'svg') return null
  // Fabric's middle handles scale one axis independently, so the two axes
  // can have different effective DPI. Report the WORST axis — that's the
  // one a print shop would flag.
  const displayedWidthMm = workToMm(image.width * image.scaleX)
  const displayedHeightMm = workToMm(image.height * image.scaleY)
  if (displayedWidthMm <= 0 || displayedHeightMm <= 0) return null
  const dpiX = image.width / (displayedWidthMm / MM_PER_INCH)
  const dpiY = image.height / (displayedHeightMm / MM_PER_INCH)
  return Math.min(dpiX, dpiY)
}

export function isBelowDpiThreshold(dpi: number | null): boolean {
  return dpi !== null && dpi < EXPORT_DPI
}

/* ---- Crop (mm insets from the original, uncropped source) --------------- */

export interface CropInsetsMm {
  top: number
  right: number
  bottom: number
  left: number
}

const MIN_CROP_SOURCE_PX = 1

/** Read the current crop state back out as mm insets from each edge. */
export function readCropInsetsMm(image: XpsImage): CropInsetsMm {
  const sourceW = image.xpsSourceWidth || image.width
  const sourceH = image.xpsSourceHeight || image.height
  const cropX = image.cropX ?? 0
  const cropY = image.cropY ?? 0
  const pxPerMmX = image.scaleX > 0 ? WORK_PX_PER_MM / image.scaleX : 0
  const pxPerMmY = image.scaleY > 0 ? WORK_PX_PER_MM / image.scaleY : 0
  return {
    left: pxPerMmX > 0 ? cropX / pxPerMmX : 0,
    top: pxPerMmY > 0 ? cropY / pxPerMmY : 0,
    right: pxPerMmX > 0 ? (sourceW - cropX - image.width) / pxPerMmX : 0,
    bottom: pxPerMmY > 0 ? (sourceH - cropY - image.height) / pxPerMmY : 0,
  }
}

/**
 * Apply mm insets, always re-derived from the original uncropped source
 * (never from the current crop window) so the operation is fully
 * reversible: dialing any inset back toward 0 restores exactly that much
 * of the source. The crop window's on-screen anchor is recovered from the
 * *current* left/top plus the *current* cropX/cropY (which together locate
 * the uncropped source's top-left in scene space), so repeated edits never
 * drift.
 */
export function applyCropInsets(image: XpsImage, insets: CropInsetsMm): void {
  const sourceW = image.xpsSourceWidth || image.width
  const sourceH = image.xpsSourceHeight || image.height
  const pxPerMmX = WORK_PX_PER_MM / image.scaleX
  const pxPerMmY = WORK_PX_PER_MM / image.scaleY

  const leftPx = Math.max(0, insets.left) * pxPerMmX
  const rightPx = Math.max(0, insets.right) * pxPerMmX
  const topPx = Math.max(0, insets.top) * pxPerMmY
  const bottomPx = Math.max(0, insets.bottom) * pxPerMmY

  let cropX = Math.min(leftPx, sourceW - MIN_CROP_SOURCE_PX)
  let cropY = Math.min(topPx, sourceH - MIN_CROP_SOURCE_PX)
  cropX = Math.max(0, cropX)
  cropY = Math.max(0, cropY)
  let width = Math.max(MIN_CROP_SOURCE_PX, sourceW - leftPx - rightPx)
  let height = Math.max(MIN_CROP_SOURCE_PX, sourceH - topPx - bottomPx)
  width = Math.min(width, sourceW - cropX)
  height = Math.min(height, sourceH - cropY)

  const oldCropX = image.cropX ?? 0
  const oldCropY = image.cropY ?? 0
  const uncroppedLeft = image.left - oldCropX * image.scaleX
  const uncroppedTop = image.top - oldCropY * image.scaleY

  image.set({
    cropX,
    cropY,
    width,
    height,
    left: uncroppedLeft + cropX * image.scaleX,
    top: uncroppedTop + cropY * image.scaleY,
  })
  image.setCoords()
}

export function resetCrop(image: XpsImage): void {
  applyCropInsets(image, { top: 0, right: 0, bottom: 0, left: 0 })
}
