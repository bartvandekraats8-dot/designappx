import { useEffect, useState } from 'react'

import { getGarment, getTextileColor } from '../data/garments'
import { captureZoneDataUrl } from '../canvas/renderZone'
import { compositeMockup } from '../features/mockup/compositor'
import { useStudio } from '../state/studio'
import styles from './MockupPreview.module.css'

/**
 * Flat garment mockup preview — INC-6.
 *
 * Stays mounted only while `viewMode === 'mockup'` (CanvasStage keeps the
 * Fabric canvas + history alive underneath, hidden via CSS). Live colour
 * switching is just a fill re-paint of the returned path data; the artwork
 * capture only re-runs on garment change or after a canvas commit (tracked
 * via the `layers` store slice, which is republished on every commit).
 */
export function MockupPreview() {
  const viewMode = useStudio((state) => state.viewMode)
  const garmentId = useStudio((state) => state.garmentId)
  const colorId = useStudio((state) => state.colorId)
  const layers = useStudio((state) => state.layers)
  const controller = useStudio((state) => state.controller)

  const [artworkDataUrl, setArtworkDataUrl] = useState('')

  useEffect(() => {
    if (viewMode !== 'mockup' || !controller) return
    const garment = getGarment(garmentId)
    // Mirroring imperative Fabric canvas pixels into React state — the
    // textbook "synchronize with an external system" effect, not derived
    // state; there's no render-time way to rasterize a canvas.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setArtworkDataUrl(captureZoneDataUrl(controller.canvas, garment, 1).dataUrl)
  }, [viewMode, garmentId, layers, controller])

  if (viewMode !== 'mockup') return null

  const garment = getGarment(garmentId)
  const composite = compositeMockup(
    garment,
    getTextileColor(colorId).hex,
    artworkDataUrl,
  )

  return (
    <section className={styles.stage} aria-label="Garment mockup preview">
      <svg
        className={styles.svg}
        viewBox={`0 0 ${composite.artboardMm.width} ${composite.artboardMm.height}`}
        role="img"
        aria-label={`${garment.label} mockup in ${getTextileColor(colorId).label}`}
      >
        {composite.layers.map((layer, i) => (
          <path
            key={i}
            d={layer.d}
            fill={layer.fill === 'garment' ? composite.garmentFillHex : 'none'}
            stroke={layer.stroke === 'garment' ? composite.garmentFillHex : 'none'}
            strokeWidth={layer.strokeWidthMm}
            strokeLinecap="round"
          />
        ))}
        {composite.artwork.dataUrl && (
          <image
            href={composite.artwork.dataUrl}
            x={composite.artwork.xMm}
            y={composite.artwork.yMm}
            width={composite.artwork.widthMm}
            height={composite.artwork.heightMm}
            preserveAspectRatio="none"
          />
        )}
      </svg>
    </section>
  )
}
