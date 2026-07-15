/**
 * Spec sheet — INC-7. A one-page PDF summary bundled alongside the print
 * files (ZIP export): garment/zone dimensions in mm and inch, bleed/safe,
 * textile colour, technique with any active print-check warnings, and the
 * same CMYK-intent + font-substitution notes as the main PDF export, so a
 * print shop has everything on one page without opening the design file.
 */

import { jsPDF } from 'jspdf'

import type { Garment } from '../data/garments'
import { MM_PER_INCH, formatMm } from '../lib/units'
import type { PrintWarning, TechniqueId } from '../print/printCheck'
import { getTechnique } from '../print/printCheck'
import type { FontSubstitution } from './pdfFonts'

export interface SpecSheetParams {
  designName: string
  garment: Garment
  colorLabel: string
  technique: TechniqueId
  screenColorLimit: number
  printWarnings: readonly PrintWarning[]
  pdfFontSubstitutions?: readonly FontSubstitution[]
  includedFormats: readonly string[]
}

function mmToInch(mm: number): string {
  return (mm / MM_PER_INCH).toFixed(2)
}

export function buildSpecSheetPdf(params: SpecSheetParams): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const marginX = 20
  let y = 25

  const heading = (text: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(text, marginX, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
  }
  const line = (text: string) => {
    doc.text(text, marginX, y)
    y += 5.5
  }
  const gap = () => {
    y += 3
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('[X] Print Studio — Spec Sheet', marginX, y)
  y += 10
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  line(`Design: ${params.designName}`)
  line(`Generated: ${new Date().toISOString()}`)
  gap()

  heading('Garment & print zone')
  line(`Garment: ${params.garment.label} — ${params.garment.zone.label}`)
  line(
    `Zone: ${formatMm(params.garment.zone.widthMm)} × ${formatMm(params.garment.zone.heightMm)} mm ` +
      `(${mmToInch(params.garment.zone.widthMm)} × ${mmToInch(params.garment.zone.heightMm)} in)`,
  )
  line(`Bleed: ${formatMm(params.garment.bleedMm)} mm   Safe inset: ${formatMm(params.garment.safeMm)} mm`)
  line(`Textile colour: ${params.colorLabel}`)
  line('Export pixel contract: 300 DPI for all raster formats (PNG/JPG/mockup).')
  gap()

  const technique = getTechnique(params.technique)
  heading('Print technique')
  line(`${technique.label} — ${technique.blurb}`)
  if (params.technique === 'screen') {
    line(`Configured spot-colour limit: ${params.screenColorLimit}`)
  }
  gap()

  heading('Active print-check warnings')
  if (params.printWarnings.length === 0) {
    line('None — no advisory warnings for the current technique.')
  } else {
    for (const warning of params.printWarnings) {
      const prefix = warning.severity === 'warning' ? '⚠' : 'ℹ'
      const label = warning.objectName ? `${warning.objectName}: ` : ''
      line(`${prefix} ${label}${warning.message}`)
    }
  }
  gap()

  heading('Colour note')
  line('This export is RGB. True CMYK separation is a print-shop step —')
  line('jsPDF/browser tooling cannot produce genuine CMYK in-browser.')
  gap()

  if (params.pdfFontSubstitutions && params.pdfFontSubstitutions.length > 0) {
    heading('PDF font substitutions')
    line('The included PDF cannot embed these curated webfonts (no TTF/OTF')
    line('source is available in-browser); it substitutes the font below.')
    line('SVG/PNG/JPG/mockup exports show the real typeface.')
    for (const sub of params.pdfFontSubstitutions) {
      line(`${sub.family} → ${sub.substitute}`)
    }
    gap()
  }

  heading('Bundle contents')
  for (const format of params.includedFormats) line(`• ${format}`)

  return doc.output('blob')
}
