/**
 * PDF export — INC-7.
 *
 * Physical-size RGB PDF via svg2pdf.js (vectorizes the same SVG the SVG
 * export produces — see `exportSvg.ts` for the font/scope contract). True
 * CMYK conversion isn't possible in-browser (jsPDF/pdf-lib are RGB-only —
 * a locked scope boundary, not an oversight); this ships RGB with the CMYK
 * *intent* recorded in the PDF's own document properties, matching the
 * spec sheet. Bleed and crop marks apply to the full print zone only (a
 * selection/per-layer export has no meaningful "trim line") — the caller
 * (ExportDialog) disables those toggles outside zone scope.
 */

import { jsPDF } from 'jspdf'
import 'svg2pdf.js'
import type { Canvas } from 'fabric'

import type { Garment } from '../data/garments'
import { buildExportFilename, triggerBlobDownload } from './filename'
import { type ExportScope } from '../canvas/renderZone'
import { buildZoneSvg } from './exportSvg'
import { collectUsedFonts } from './fontEmbed'
import { artworkObjects } from '../canvas/history'
import { registerPdfFonts, type FontSubstitution } from './pdfFonts'

const MARKS_MARGIN_MM = 6
const MARK_GAP_MM = 2
const MARK_LEN_MM = 5

export interface PdfOptions {
  scope?: ExportScope
  includeBleed?: boolean
  cropMarks?: boolean
  customFonts?: readonly string[]
}

export interface PdfResult {
  blob: Blob
  widthMm: number
  heightMm: number
  substitutions: FontSubstitution[]
}

function drawCropMarks(
  pdf: jsPDF,
  trimX: number,
  trimY: number,
  trimW: number,
  trimH: number,
): void {
  pdf.setDrawColor(0)
  pdf.setLineWidth(0.25)
  const corners = [
    { x: trimX, y: trimY, dx: -1, dy: -1 },
    { x: trimX + trimW, y: trimY, dx: 1, dy: -1 },
    { x: trimX, y: trimY + trimH, dx: -1, dy: 1 },
    { x: trimX + trimW, y: trimY + trimH, dx: 1, dy: 1 },
  ]
  for (const c of corners) {
    pdf.line(c.x + c.dx * MARK_GAP_MM, c.y, c.x + c.dx * (MARK_GAP_MM + MARK_LEN_MM), c.y)
    pdf.line(c.x, c.y + c.dy * MARK_GAP_MM, c.x, c.y + c.dy * (MARK_GAP_MM + MARK_LEN_MM))
  }
}

export async function buildZonePdf(
  canvas: Canvas,
  garment: Garment,
  options: PdfOptions = {},
): Promise<PdfResult> {
  const scope = options.scope ?? { kind: 'zone' }
  const includeBleed = (options.includeBleed ?? false) && scope.kind === 'zone'
  const cropMarks = (options.cropMarks ?? false) && scope.kind === 'zone'
  const customFonts = options.customFonts ?? []
  const bleedMm = includeBleed ? garment.bleedMm : 0

  const svgResult = await buildZoneSvg(canvas, garment, scope, customFonts, bleedMm)
  const marksMargin = cropMarks ? MARKS_MARGIN_MM : 0
  const pageWidthMm = svgResult.widthMm + marksMargin * 2
  const pageHeightMm = svgResult.heightMm + marksMargin * 2

  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-99999px'
  container.style.top = '0'
  document.body.append(container)
  container.innerHTML = svgResult.svg
  const svgElement = container.querySelector('svg')
  if (!svgElement) {
    container.remove()
    throw new Error('Failed to parse export SVG for PDF conversion.')
  }

  const pdf = new jsPDF({
    orientation: pageWidthMm >= pageHeightMm ? 'l' : 'p',
    unit: 'mm',
    format: [pageWidthMm, pageHeightMm],
  })

  const inScope = scope.kind === 'zone' ? artworkObjects(canvas) : undefined
  const usedFonts = collectUsedFonts(inScope ?? artworkObjects(canvas))
  const { substitutions } = await registerPdfFonts(pdf, usedFonts, customFonts)

  try {
    await pdf.svg(svgElement, {
      x: marksMargin,
      y: marksMargin,
      width: svgResult.widthMm,
      height: svgResult.heightMm,
    })
  } finally {
    container.remove()
  }

  if (cropMarks) {
    drawCropMarks(
      pdf,
      marksMargin + bleedMm,
      marksMargin + bleedMm,
      garment.zone.widthMm,
      garment.zone.heightMm,
    )
  }

  pdf.setProperties({
    title: '[X] Print Studio export',
    subject:
      'Print-ready design export. RGB source — true CMYK separation happens at the print shop; convert before press.',
    keywords: 'cmyk-intent, rgb-source, print-ready',
    creator: '[X] Print Studio',
  })

  return {
    blob: pdf.output('blob'),
    widthMm: pageWidthMm,
    heightMm: pageHeightMm,
    substitutions,
  }
}

export async function exportZonePdf(
  canvas: Canvas,
  garment: Garment,
  designName: string,
  options: PdfOptions = {},
): Promise<PdfResult> {
  const result = await buildZonePdf(canvas, garment, options)
  triggerBlobDownload(result.blob, `${buildExportFilename(designName, 'PDF')}.pdf`)
  return result
}
