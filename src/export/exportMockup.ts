/**
 * Mockup PNG/JPG export — INC-7. Rasterizes the same flat SVG composite
 * `MockupPreview.tsx` renders on-screen (`compositeMockup`, INC-6), but
 * captures the artwork at the 300 DPI export multiplier rather than the
 * preview's cheap live-update resolution, then draws the whole composite
 * onto an offscreen canvas at a fixed long-edge resolution (this is a
 * shareable preview image, not a precision print file — no DPI contract
 * to honour here, unlike the zone PNG/JPG/PDF exports).
 */

import type { Canvas } from 'fabric'

import type { Garment } from '../data/garments'
import { EXPORT_MULTIPLIER } from '../lib/units'
import { captureZoneDataUrl } from '../canvas/renderZone'
import { compositeMockup, type MockupComposite } from '../features/mockup/compositor'
import { buildExportFilename, triggerBlobDownload } from './filename'

const MOCKUP_LONG_EDGE_PX = 2000

function buildMockupSvgMarkup(composite: MockupComposite): string {
  const { width, height } = composite.artboardMm
  const paths = composite.layers
    .map((layer) => {
      const fill = layer.fill === 'garment' ? composite.garmentFillHex : 'none'
      const stroke = layer.stroke === 'garment' ? composite.garmentFillHex : 'none'
      const strokeWidth = layer.strokeWidthMm ? ` stroke-width="${layer.strokeWidthMm}"` : ''
      return `<path d="${layer.d}" fill="${fill}" stroke="${stroke}"${strokeWidth} stroke-linecap="round" />`
    })
    .join('')
  const image = composite.artwork.dataUrl
    ? `<image href="${composite.artwork.dataUrl}" x="${composite.artwork.xMm}" y="${composite.artwork.yMm}" width="${composite.artwork.widthMm}" height="${composite.artwork.heightMm}" preserveAspectRatio="none" />`
    : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}">${paths}${image}</svg>`
  )
}

async function rasterize(
  composite: MockupComposite,
  backgroundColor: string | null,
): Promise<HTMLCanvasElement> {
  const svgMarkup = buildMockupSvgMarkup(composite)
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()

    const { width, height } = composite.artboardMm
    const scale = MOCKUP_LONG_EDGE_PX / Math.max(width, height)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas context unavailable.')
    if (backgroundColor) {
      ctx.fillStyle = backgroundColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas rasterization failed.'))),
      type,
      quality,
    )
  })
}

async function buildComposite(
  canvas: Canvas,
  garment: Garment,
  garmentFillHex: string,
): Promise<MockupComposite> {
  const artwork = captureZoneDataUrl(canvas, garment, EXPORT_MULTIPLIER)
  return compositeMockup(garment, garmentFillHex, artwork.dataUrl)
}

const MOCKUP_JPG_QUALITY = 0.92

export async function buildMockupPngBlob(
  canvas: Canvas,
  garment: Garment,
  garmentFillHex: string,
): Promise<Blob> {
  const composite = await buildComposite(canvas, garment, garmentFillHex)
  const rendered = await rasterize(composite, null)
  return canvasToBlob(rendered, 'image/png')
}

export async function buildMockupJpgBlob(
  canvas: Canvas,
  garment: Garment,
  garmentFillHex: string,
  backgroundColor: string,
): Promise<Blob> {
  const composite = await buildComposite(canvas, garment, garmentFillHex)
  const rendered = await rasterize(composite, backgroundColor)
  return canvasToBlob(rendered, 'image/jpeg', MOCKUP_JPG_QUALITY)
}

export async function exportMockupPng(
  canvas: Canvas,
  garment: Garment,
  garmentFillHex: string,
  designName: string,
): Promise<void> {
  const blob = await buildMockupPngBlob(canvas, garment, garmentFillHex)
  triggerBlobDownload(blob, `${buildExportFilename(designName, 'mockup-PNG')}.png`)
}

export async function exportMockupJpg(
  canvas: Canvas,
  garment: Garment,
  garmentFillHex: string,
  designName: string,
  backgroundColor: string,
): Promise<void> {
  const blob = await buildMockupJpgBlob(canvas, garment, garmentFillHex, backgroundColor)
  triggerBlobDownload(blob, `${buildExportFilename(designName, 'mockup-JPG')}.jpg`)
}
