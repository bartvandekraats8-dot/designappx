/**
 * Garment catalogue — six base garments with front print zones in mm and the
 * textile colour palette.
 *
 * Zone sizes follow standard direct-to-garment platen practice (approved
 * defaults, 2026-07-02):
 *   · adult tee / long-sleeve front  305 × 406 mm (12 × 16 in platen)
 *   · hoodie front                   305 × 330 mm (shortened for pocket)
 *   · sweatshirt front               305 × 380 mm
 *   · tote                           280 × 350 mm
 *   · cap front panel                120 × 60 mm
 *
 * Bleed 3 mm / safe inset 5 mm are project-wide print defaults. Garment
 * prints are not trimmed, so bleed matters mostly for transfer/sublimation
 * sheets and for the PDF bleed boxes arriving in INC-7 — but the overlay is
 * drawn from day one so the designer works against honest boundaries.
 *
 * Per the TS 6 `erasableSyntaxOnly` rule: `const` lists + derived union
 * types, no enums.
 */

export const TEXTILE_COLORS = [
  { id: 'black', label: 'Black', hex: '#1C1B19' },
  { id: 'white', label: 'White', hex: '#F4F3F0' },
  { id: 'bone', label: 'Bone', hex: '#EAE2D0' },
  { id: 'heather', label: 'Heather grey', hex: '#AEADAA' },
  { id: 'navy', label: 'Navy', hex: '#22304A' },
  { id: 'forest', label: 'Forest', hex: '#28422F' },
  { id: 'burgundy', label: 'Burgundy', hex: '#5D2531' },
  { id: 'sand', label: 'Sand', hex: '#CFBB97' },
] as const

export type TextileColor = (typeof TEXTILE_COLORS)[number]
export type TextileColorId = TextileColor['id']

const ALL_COLORS: readonly TextileColorId[] = TEXTILE_COLORS.map(
  (color) => color.id,
)

export const GARMENT_IDS = [
  'tshirt',
  'hoodie',
  'sweatshirt',
  'longsleeve',
  'tote',
  'cap',
] as const

export type GarmentId = (typeof GARMENT_IDS)[number]

export interface PrintZone {
  /** Zone width in mm. */
  widthMm: number
  /** Zone height in mm. */
  heightMm: number
  /** Human label, e.g. "Front". */
  label: string
}

export interface Garment {
  id: GarmentId
  label: string
  zone: PrintZone
  /** Bleed outside the zone edge, mm. */
  bleedMm: number
  /** Safe-area inset inside the zone edge, mm. */
  safeMm: number
  /**
   * Textile colours this garment ships in. Per-garment on purpose: the data
   * shape supports garment-specific palettes without code changes (the cap
   * runs a reduced range to prove the mechanism).
   */
  colors: readonly TextileColorId[]
}

export const GARMENTS: readonly Garment[] = [
  {
    id: 'tshirt',
    label: 'T-shirt',
    zone: { widthMm: 305, heightMm: 406, label: 'Front' },
    bleedMm: 3,
    safeMm: 5,
    colors: ALL_COLORS,
  },
  {
    id: 'hoodie',
    label: 'Hoodie',
    zone: { widthMm: 305, heightMm: 330, label: 'Front' },
    bleedMm: 3,
    safeMm: 5,
    colors: ALL_COLORS,
  },
  {
    id: 'sweatshirt',
    label: 'Sweatshirt',
    zone: { widthMm: 305, heightMm: 380, label: 'Front' },
    bleedMm: 3,
    safeMm: 5,
    colors: ALL_COLORS,
  },
  {
    id: 'longsleeve',
    label: 'Long-sleeve',
    zone: { widthMm: 305, heightMm: 406, label: 'Front' },
    bleedMm: 3,
    safeMm: 5,
    colors: ALL_COLORS,
  },
  {
    id: 'tote',
    label: 'Tote bag',
    zone: { widthMm: 280, heightMm: 350, label: 'Front' },
    bleedMm: 3,
    safeMm: 5,
    colors: ['black', 'white', 'bone', 'navy', 'forest', 'sand'],
  },
  {
    id: 'cap',
    label: 'Cap',
    zone: { widthMm: 120, heightMm: 60, label: 'Front panel' },
    bleedMm: 3,
    safeMm: 5,
    colors: ['black', 'white', 'navy', 'sand'],
  },
]

export function getGarment(id: GarmentId): Garment {
  const garment = GARMENTS.find((entry) => entry.id === id)
  if (!garment) throw new Error(`Unknown garment: ${id}`)
  return garment
}

export function getTextileColor(id: TextileColorId): TextileColor {
  const color = TEXTILE_COLORS.find((entry) => entry.id === id)
  if (!color) throw new Error(`Unknown textile colour: ${id}`)
  return color
}
