/**
 * Mockup compositor — INC-6's single swap-in boundary.
 *
 * `compositeMockup` takes a garment, its textile colour, and a rendered PNG
 * of the current artwork, and returns a flat, resolution-independent
 * description (garment silhouette + placement rect) that `MockupPreview`
 * renders as an inline `<svg>`. Live colour switching never re-enters this
 * function — the caller just re-paints the returned path with a new fill.
 *
 * This is the documented seam for a future warped-mockup API: swap this
 * function's body to call an external compositing service and return a
 * pre-rendered raster URL instead of a path descriptor. Callers only depend
 * on the shape of `MockupComposite`, not on how it was produced.
 */

import type { Garment } from '../../data/garments'
import { buildGarmentArt, type GarmentArt } from './garmentArt'

export interface MockupComposite {
  artboardMm: GarmentArt['artboardMm']
  layers: GarmentArt['layers']
  garmentFillHex: string
  artwork: {
    xMm: number
    yMm: number
    widthMm: number
    heightMm: number
    dataUrl: string
  }
}

export function compositeMockup(
  garment: Garment,
  garmentFillHex: string,
  artworkDataUrl: string,
): MockupComposite {
  const art = buildGarmentArt(garment)
  return {
    artboardMm: art.artboardMm,
    layers: art.layers,
    garmentFillHex,
    artwork: {
      xMm: art.zoneRectMm.x,
      yMm: art.zoneRectMm.y,
      widthMm: art.zoneRectMm.width,
      heightMm: art.zoneRectMm.height,
      dataUrl: artworkDataUrl,
    },
  }
}
