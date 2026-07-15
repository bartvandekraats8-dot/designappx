/**
 * Unit system — the single source of truth for every mm <-> px conversion.
 *
 * Two pixel spaces exist in this app and must never be confused:
 *
 * 1. WORK px — the Fabric canvas' internal coordinate space. We model the
 *    print zone at a fixed working resolution of 4 px per mm (~101.6 DPI).
 *    High enough that on-screen zooming stays crisp, low enough that a
 *    406 mm-tall zone is a 1 624 px object rather than a 4 795 px one.
 *
 * 2. EXPORT px — the 300 DPI production space. Reached only at export time
 *    via Fabric's `multiplier`, never by resizing canvas objects.
 *
 * Verified against fabric@7.4.0 source (`StaticCanvas.toCanvasElement`):
 * the crop box passed to `toDataURL` is interpreted in *viewport-transformed*
 * space and the current zoom multiplies into the output. Export therefore
 * MUST reset the viewport transform to identity first — see
 * `src/canvas/exportPng.ts`. With identity vpt, output pixel size is exactly
 * `workPx * EXPORT_MULTIPLIER`, truncated to an integer by the HTML canvas
 * element (hence `Math.floor` in `mmToExportPx`).
 */

export const EXPORT_DPI = 300
export const MM_PER_INCH = 25.4

/** Working canvas resolution: 4 px per mm (~101.6 DPI). */
export const WORK_PX_PER_MM = 4

/** Pixels per mm at the 300 DPI export baseline (≈ 11.811). */
export const PX_PER_MM_AT_EXPORT = EXPORT_DPI / MM_PER_INCH

/** Fabric `toDataURL` multiplier that lifts WORK px to EXPORT px (≈ 2.9528). */
export const EXPORT_MULTIPLIER = PX_PER_MM_AT_EXPORT / WORK_PX_PER_MM

/** mm -> working canvas px. */
export function mmToWork(mm: number): number {
  return mm * WORK_PX_PER_MM
}

/** Working canvas px -> mm. */
export function workToMm(px: number): number {
  return px / WORK_PX_PER_MM
}

/**
 * mm -> the integer pixel size a 300 DPI export actually produces.
 * `Math.floor` mirrors the HTML canvas element's width/height truncation
 * (`canvas.width = 3602.36` stores 3602).
 */
export function mmToExportPx(mm: number): number {
  return Math.floor(mm * PX_PER_MM_AT_EXPORT)
}

/** Format a mm value for readouts: no trailing zeros, max one decimal. */
export function formatMm(mm: number): string {
  const rounded = Math.round(mm * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}
