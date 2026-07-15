/**
 * Garment silhouette geometry — INC-6.
 *
 * Flat, recolourable vector illustrations, generated parametrically (same
 * spirit as `canvas/shapes.ts`'s `ngonPoints`) rather than hand-authored
 * bezier art: every shape is a small set of named mm offsets from the
 * garment's own print zone, so geometry stays legible and adjustable without
 * touching path data by hand. No external assets, no licensing surface.
 *
 * Each garment's art lives in its own artboard (mm), independent of the
 * print-zone canvas: `zoneRectMm` says where that zone sits inside the
 * artboard so the compositor can place the artwork image precisely.
 *
 * Coordinates are built centred on x = 0 (the garment's vertical axis), then
 * translated once into positive artboard space at the end of each builder.
 */

import type { Garment, GarmentId } from '../../data/garments'

export interface GarmentArtLayer {
  d: string
  fill: 'garment' | 'none'
  stroke: 'garment' | 'none'
  strokeWidthMm?: number
}

export interface GarmentArt {
  artboardMm: { width: number; height: number }
  zoneRectMm: { x: number; y: number; width: number; height: number }
  layers: GarmentArtLayer[]
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

function polygonD(points: readonly (readonly [number, number])[]): string {
  return (
    points
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${round(x)} ${round(y)}`)
      .join(' ') + ' Z'
  )
}

/* ---- Apparel (tee / long-sleeve / sweatshirt / hoodie) -------------------- */

const SIDE_MARGIN_MM = 42
const COLLAR_MARGIN_MM = 56
const HEM_MARGIN_MM = 34
const NECK_DEPTH_MM = 26
const UNDERARM_DROP_MM = 46
const PADDING_MM = 8

const SHORT_SLEEVE_OUT_MM = 46
const SHORT_SLEEVE_FAR_MM = 34
const SHORT_SLEEVE_TOP_DROP_MM = 10
const SHORT_SLEEVE_FAR_DROP_MM = 62

const LONG_SLEEVE_OUT_MM = 26
const LONG_SLEEVE_FAR_MM = 14
const LONG_SLEEVE_TOP_DROP_MM = 10
const LONG_SLEEVE_HEM_CLEARANCE_MM = 24

const HOOD_OVERLAP_MM = 10
const HOOD_HALF_WIDTH_FACTOR = 2.3
const HOOD_HEIGHT_FACTOR = 0.85

interface ApparelConfig {
  sleeve: 'short' | 'long'
  hood: boolean
  neckHalfFrac: number
}

const APPAREL_CONFIG: Record<
  'tshirt' | 'hoodie' | 'sweatshirt' | 'longsleeve',
  ApparelConfig
> = {
  tshirt: { sleeve: 'short', hood: false, neckHalfFrac: 0.11 },
  sweatshirt: { sleeve: 'long', hood: false, neckHalfFrac: 0.11 },
  longsleeve: { sleeve: 'long', hood: false, neckHalfFrac: 0.11 },
  hoodie: { sleeve: 'long', hood: true, neckHalfFrac: 0.075 },
}

function buildApparelArt(garment: Garment, cfg: ApparelConfig): GarmentArt {
  const zoneW = garment.zone.widthMm
  const zoneH = garment.zone.heightMm
  const halfBodyW = zoneW / 2 + SIDE_MARGIN_MM
  const yHem = COLLAR_MARGIN_MM + zoneH + HEM_MARGIN_MM
  const neckHalfW = Math.max(16, zoneW * cfg.neckHalfFrac)

  const outOffset = cfg.sleeve === 'short' ? SHORT_SLEEVE_OUT_MM : LONG_SLEEVE_OUT_MM
  const farOffset = cfg.sleeve === 'short' ? SHORT_SLEEVE_FAR_MM : LONG_SLEEVE_FAR_MM
  const topDropY =
    cfg.sleeve === 'short' ? SHORT_SLEEVE_TOP_DROP_MM : LONG_SLEEVE_TOP_DROP_MM
  const farDropY =
    cfg.sleeve === 'short' ? SHORT_SLEEVE_FAR_DROP_MM : yHem - LONG_SLEEVE_HEM_CLEARANCE_MM

  /* Clockwise from the left neckline edge; `Z` closes the final
     left-shoulder -> neckline segment along y = 0. */
  const points: [number, number][] = [
    [-neckHalfW, 0],
    [0, NECK_DEPTH_MM],
    [neckHalfW, 0],
    [halfBodyW, 0],
    [halfBodyW + outOffset, topDropY],
    [halfBodyW + farOffset, farDropY],
    [halfBodyW, UNDERARM_DROP_MM],
    [halfBodyW, yHem],
    [-halfBodyW, yHem],
    [-halfBodyW, UNDERARM_DROP_MM],
    [-halfBodyW - farOffset, farDropY],
    [-halfBodyW - outOffset, topDropY],
    [-halfBodyW, 0],
  ]

  const hoodHalfW = neckHalfW * HOOD_HALF_WIDTH_FACTOR
  const hoodHeight = hoodHalfW * HOOD_HEIGHT_FACTOR
  const topPadding = cfg.hood ? PADDING_MM + hoodHeight : PADDING_MM

  const dx = halfBodyW + outOffset + PADDING_MM
  const dy = topPadding

  const bodyLayer: GarmentArtLayer = {
    d: polygonD(points.map(([x, y]) => [x + dx, y + dy] as const)),
    fill: 'garment',
    stroke: 'none',
  }

  const layers: GarmentArtLayer[] = []
  if (cfg.hood) {
    const hx = dx
    const hy = dy
    layers.push({
      d: [
        `M ${round(hx - hoodHalfW)} ${round(hy + HOOD_OVERLAP_MM)}`,
        `L ${round(hx - hoodHalfW)} ${round(hy)}`,
        `A ${round(hoodHalfW)} ${round(hoodHeight)} 0 0 1 ${round(hx + hoodHalfW)} ${round(hy)}`,
        `L ${round(hx + hoodHalfW)} ${round(hy + HOOD_OVERLAP_MM)}`,
        'Z',
      ].join(' '),
      fill: 'garment',
      stroke: 'none',
    })
  }
  layers.push(bodyLayer)

  return {
    artboardMm: {
      width: 2 * (halfBodyW + outOffset) + 2 * PADDING_MM,
      height: topPadding + yHem + PADDING_MM,
    },
    zoneRectMm: {
      x: dx - zoneW / 2,
      y: dy + COLLAR_MARGIN_MM,
      width: zoneW,
      height: zoneH,
    },
    layers,
  }
}

/* ---- Tote bag -------------------------------------------------------------- */

const TOTE_MARGIN_MM = 30
const TOTE_STRAP_HEIGHT_MM = 34
const TOTE_STRAP_INSET_FACTOR = 0.55
const TOTE_STRAP_ARC_RX_MM = 20
const TOTE_STRAP_ARC_RY_MM = 24
const TOTE_STRAP_WIDTH_MM = 12
const TOTE_CORNER_RADIUS_MM = 10

function roundedRectD(x: number, y: number, w: number, h: number, r: number): string {
  return [
    `M ${round(x + r)} ${round(y)}`,
    `L ${round(x + w - r)} ${round(y)}`,
    `A ${round(r)} ${round(r)} 0 0 1 ${round(x + w)} ${round(y + r)}`,
    `L ${round(x + w)} ${round(y + h - r)}`,
    `A ${round(r)} ${round(r)} 0 0 1 ${round(x + w - r)} ${round(y + h)}`,
    `L ${round(x + r)} ${round(y + h)}`,
    `A ${round(r)} ${round(r)} 0 0 1 ${round(x)} ${round(y + h - r)}`,
    `L ${round(x)} ${round(y + r)}`,
    `A ${round(r)} ${round(r)} 0 0 1 ${round(x + r)} ${round(y)}`,
    'Z',
  ].join(' ')
}

function buildToteArt(garment: Garment): GarmentArt {
  const zoneW = garment.zone.widthMm
  const zoneH = garment.zone.heightMm
  const halfBodyW = zoneW / 2 + TOTE_MARGIN_MM
  const bodyTopY = TOTE_STRAP_HEIGHT_MM
  const bodyHeight = zoneH + 2 * TOTE_MARGIN_MM

  const dx = halfBodyW + PADDING_MM
  const dy = PADDING_MM

  const bodyLayer: GarmentArtLayer = {
    d: roundedRectD(
      -halfBodyW + dx,
      bodyTopY + dy,
      2 * halfBodyW,
      bodyHeight,
      TOTE_CORNER_RADIUS_MM,
    ),
    fill: 'garment',
    stroke: 'none',
  }

  const strapCenters = [
    -halfBodyW * TOTE_STRAP_INSET_FACTOR,
    halfBodyW * TOTE_STRAP_INSET_FACTOR,
  ]
  const strapLayers: GarmentArtLayer[] = strapCenters.map((cx) => ({
    d: [
      `M ${round(cx - TOTE_STRAP_ARC_RX_MM + dx)} ${round(bodyTopY + 6 + dy)}`,
      `L ${round(cx - TOTE_STRAP_ARC_RX_MM + dx)} ${round(TOTE_STRAP_ARC_RY_MM + dy)}`,
      `A ${round(TOTE_STRAP_ARC_RX_MM)} ${round(TOTE_STRAP_ARC_RY_MM)} 0 0 1 ${round(cx + TOTE_STRAP_ARC_RX_MM + dx)} ${round(TOTE_STRAP_ARC_RY_MM + dy)}`,
      `L ${round(cx + TOTE_STRAP_ARC_RX_MM + dx)} ${round(bodyTopY + 6 + dy)}`,
    ].join(' '),
    fill: 'none',
    stroke: 'garment',
    strokeWidthMm: TOTE_STRAP_WIDTH_MM,
  }))

  return {
    artboardMm: {
      width: 2 * halfBodyW + 2 * PADDING_MM,
      height: bodyTopY + bodyHeight + 2 * PADDING_MM,
    },
    zoneRectMm: {
      x: dx - zoneW / 2,
      y: dy + bodyTopY + TOTE_MARGIN_MM,
      width: zoneW,
      height: zoneH,
    },
    layers: [...strapLayers, bodyLayer],
  }
}

/* ---- Cap (front panel + brim) ---------------------------------------------- */

const CAP_MARGIN_TOP_MM = 14
const CAP_MARGIN_BOTTOM_GAP_MM = 6
const CAP_TOP_WIDTH_FACTOR = 1.05
const CAP_BOTTOM_WIDTH_FACTOR = 1.35
const CAP_BRIM_OVERHANG_MM = 16
const CAP_BRIM_HEIGHT_MM = 22
const CAP_BRIM_OVERLAP_MM = 4

function buildCapArt(garment: Garment): GarmentArt {
  const zoneW = garment.zone.widthMm
  const zoneH = garment.zone.heightMm
  const panelH = CAP_MARGIN_TOP_MM + zoneH + CAP_MARGIN_BOTTOM_GAP_MM
  const topW = zoneW * CAP_TOP_WIDTH_FACTOR
  const bottomW = zoneW * CAP_BOTTOM_WIDTH_FACTOR
  const brimW = bottomW + 2 * CAP_BRIM_OVERHANG_MM
  const brimTopY = panelH - CAP_BRIM_OVERLAP_MM
  const brimBottomY = brimTopY + CAP_BRIM_HEIGHT_MM

  const dx = brimW / 2 + PADDING_MM
  const dy = PADDING_MM

  const panelLayer: GarmentArtLayer = {
    d: polygonD(
      (
        [
          [-topW / 2, 0],
          [topW / 2, 0],
          [bottomW / 2, panelH],
          [-bottomW / 2, panelH],
        ] as const
      ).map(([x, y]) => [x + dx, y + dy] as const),
    ),
    fill: 'garment',
    stroke: 'none',
  }

  const brimLayer: GarmentArtLayer = {
    d: [
      `M ${round(-brimW / 2 + dx)} ${round(brimTopY + dy)}`,
      `A ${round(brimW / 2)} ${round(CAP_BRIM_HEIGHT_MM * 0.25)} 0 0 1 ${round(brimW / 2 + dx)} ${round(brimTopY + dy)}`,
      `A ${round(brimW / 2)} ${round(CAP_BRIM_HEIGHT_MM)} 0 0 1 ${round(-brimW / 2 + dx)} ${round(brimTopY + dy)}`,
      'Z',
    ].join(' '),
    fill: 'garment',
    stroke: 'none',
  }

  return {
    artboardMm: {
      width: brimW + 2 * PADDING_MM,
      height: brimBottomY + 2 * PADDING_MM,
    },
    zoneRectMm: {
      x: dx - zoneW / 2,
      y: dy + CAP_MARGIN_TOP_MM,
      width: zoneW,
      height: zoneH,
    },
    layers: [brimLayer, panelLayer],
  }
}

/** Build the flat silhouette + zone placement for a garment. Pure, deterministic. */
export function buildGarmentArt(garment: Garment): GarmentArt {
  const id: GarmentId = garment.id
  if (id === 'tote') return buildToteArt(garment)
  if (id === 'cap') return buildCapArt(garment)
  return buildApparelArt(garment, APPAREL_CONFIG[id])
}
