/**
 * ZIP bundle export — INC-7. Packs the selected formats plus a generated
 * spec sheet into one archive, reusing every other format's "build" step
 * (the ones that return a Blob/string instead of triggering a download) so
 * there's one implementation per format, not one-per-download-path and
 * one-per-bundle-path.
 */

import JSZip from 'jszip'
import type { Canvas } from 'fabric'

import type { Garment, TextileColorId } from '../data/garments'
import { getTextileColor } from '../data/garments'
import type { PrintWarning, TechniqueId } from '../print/printCheck'
import { EXPORT_MULTIPLIER } from '../lib/units'
import { captureZoneDataUrl, type ExportScope } from '../canvas/renderZone'
import { buildExportFilename, dataUrlToBlob, triggerBlobDownload } from './filename'
import { buildZoneSvg } from './exportSvg'
import { buildZonePdf } from './exportPdf'
import { buildMockupPngBlob, buildMockupJpgBlob } from './exportMockup'
import { buildProjectJson, type ProjectMeta } from './exportJson'
import { buildSpecSheetPdf } from './specSheet'
import type { FontSubstitution } from './pdfFonts'

export type BundleFormat =
  | 'png'
  | 'jpg'
  | 'svg'
  | 'pdf'
  | 'mockup-png'
  | 'mockup-jpg'
  | 'json'

export interface BundleOptions {
  formats: ReadonlySet<BundleFormat>
  scope?: ExportScope
  jpgBackground: string
  mockupJpgBackground: string
  includeBleed: boolean
  cropMarks: boolean
  customFonts: readonly string[]
  screenColorLimit: number
  printWarnings: readonly PrintWarning[]
}

export interface ProjectContext extends ProjectMeta {
  colorId: TextileColorId
}

const FORMAT_LABELS: Record<BundleFormat, string> = {
  png: 'PNG (transparent, 300 DPI)',
  jpg: 'JPG',
  svg: 'SVG (vector, embedded fonts)',
  pdf: 'PDF (print-ready)',
  'mockup-png': 'Mockup preview PNG',
  'mockup-jpg': 'Mockup preview JPG',
  json: 'Project JSON (re-importable)',
}

export async function exportZoneZip(
  canvas: Canvas,
  garment: Garment,
  project: ProjectContext,
  options: BundleOptions,
): Promise<void> {
  const zip = new JSZip()
  const includedLabels: string[] = []
  let pdfSubstitutions: FontSubstitution[] = []

  if (options.formats.has('png')) {
    const { dataUrl } = captureZoneDataUrl(canvas, garment, EXPORT_MULTIPLIER, {
      scope: options.scope,
    })
    zip.file(`${buildExportFilename(project.designName, 'PNG')}.png`, await dataUrlToBlob(dataUrl))
    includedLabels.push(FORMAT_LABELS.png)
  }
  if (options.formats.has('jpg')) {
    const { dataUrl } = captureZoneDataUrl(canvas, garment, EXPORT_MULTIPLIER, {
      scope: options.scope,
      format: 'jpeg',
      quality: 0.92,
      backgroundColor: options.jpgBackground,
    })
    zip.file(`${buildExportFilename(project.designName, 'JPG')}.jpg`, await dataUrlToBlob(dataUrl))
    includedLabels.push(FORMAT_LABELS.jpg)
  }
  if (options.formats.has('svg')) {
    const { svg } = await buildZoneSvg(canvas, garment, options.scope, options.customFonts)
    zip.file(`${buildExportFilename(project.designName, 'SVG')}.svg`, svg)
    includedLabels.push(FORMAT_LABELS.svg)
  }
  if (options.formats.has('pdf')) {
    const result = await buildZonePdf(canvas, garment, {
      scope: options.scope,
      includeBleed: options.includeBleed,
      cropMarks: options.cropMarks,
      customFonts: options.customFonts,
    })
    zip.file(`${buildExportFilename(project.designName, 'PDF')}.pdf`, result.blob)
    pdfSubstitutions = result.substitutions
    includedLabels.push(FORMAT_LABELS.pdf)
  }
  if (options.formats.has('mockup-png')) {
    const blob = await buildMockupPngBlob(canvas, garment, getTextileColor(project.colorId).hex)
    zip.file(`${buildExportFilename(project.designName, 'mockup-PNG')}.png`, blob)
    includedLabels.push(FORMAT_LABELS['mockup-png'])
  }
  if (options.formats.has('mockup-jpg')) {
    const blob = await buildMockupJpgBlob(
      canvas,
      garment,
      getTextileColor(project.colorId).hex,
      options.mockupJpgBackground,
    )
    zip.file(`${buildExportFilename(project.designName, 'mockup-JPG')}.jpg`, blob)
    includedLabels.push(FORMAT_LABELS['mockup-jpg'])
  }
  if (options.formats.has('json')) {
    const json = buildProjectJson(canvas, project)
    zip.file(`${buildExportFilename(project.designName, 'project')}.json`, json)
    includedLabels.push(FORMAT_LABELS.json)
  }

  const specSheet = buildSpecSheetPdf({
    designName: project.designName,
    garment,
    colorLabel: getTextileColor(project.colorId).label,
    technique: project.technique as TechniqueId,
    screenColorLimit: options.screenColorLimit,
    printWarnings: options.printWarnings,
    pdfFontSubstitutions: pdfSubstitutions,
    includedFormats: includedLabels,
  })
  zip.file(`${buildExportFilename(project.designName, 'spec-sheet')}.pdf`, specSheet)

  const bundleBlob = await zip.generateAsync({ type: 'blob' })
  triggerBlobDownload(bundleBlob, `${buildExportFilename(project.designName, 'bundle')}.zip`)
}
