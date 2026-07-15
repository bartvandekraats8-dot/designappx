import type { ReactNode } from 'react'

import {
  GARMENTS,
  getGarment,
  getTextileColor,
} from '../data/garments'
import { formatMm } from '../lib/units'
import { useStudio } from '../state/studio'
import { IconChevron } from '../icons/Icons'
import { Properties } from './Properties'
import { Layers } from './Layers'
import { PrintCheck } from './PrintCheck'
import { SavesPanel } from './SavesPanel'
import styles from './PanelColumn.module.css'

interface SectionProps {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}

function Section({ title, defaultOpen = false, children }: SectionProps) {
  return (
    <details className={styles.section} open={defaultOpen}>
      <summary className={styles.summary}>
        <span className={styles.summaryTitle}>{title}</span>
        <IconChevron className={styles.chevron} />
      </summary>
      <div className={styles.body}>{children}</div>
    </details>
  )
}

function GarmentSection() {
  const garmentId = useStudio((state) => state.garmentId)
  const colorId = useStudio((state) => state.colorId)
  const setGarment = useStudio((state) => state.setGarment)
  const setColor = useStudio((state) => state.setColor)

  const garment = getGarment(garmentId)

  return (
    <div className={styles.garment}>
      <div className={styles.garmentList} role="radiogroup" aria-label="Garment">
        {GARMENTS.map((entry) => {
          const active = entry.id === garmentId
          return (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={styles.garmentItem}
              data-active={active}
              onClick={() => setGarment(entry.id)}
            >
              <span className={styles.garmentLabel}>{entry.label}</span>
              <span className={styles.garmentZone}>
                {entry.zone.label} · {formatMm(entry.zone.widthMm)} ×{' '}
                {formatMm(entry.zone.heightMm)} mm
              </span>
            </button>
          )
        })}
      </div>

      <div className={styles.colorHead}>
        <span className={styles.colorTitle}>Textile colour</span>
        <span className={styles.colorValue}>
          {getTextileColor(colorId).label}
        </span>
      </div>
      <div className={styles.swatches} role="radiogroup" aria-label="Textile colour">
        {garment.colors.map((id) => {
          const color = getTextileColor(id)
          const active = id === colorId
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={color.label}
              title={color.label}
              className={styles.swatch}
              data-active={active}
              style={{ backgroundColor: color.hex }}
              onClick={() => setColor(id)}
            />
          )
        })}
      </div>
      <p className={styles.colorHint}>
        The colour dresses the garment mockup preview (toggle it in the tool
        rail); the print zone above stays neutral paper.
      </p>
    </div>
  )
}

export function PanelColumn() {
  return (
    <aside className={styles.panel} aria-label="Inspector">
      <Section title="Garment" defaultOpen>
        <GarmentSection />
      </Section>
      <Section title="Print check" defaultOpen>
        <PrintCheck />
      </Section>
      <Section title="Properties" defaultOpen>
        <Properties />
      </Section>
      <Section title="Layers" defaultOpen>
        <Layers />
      </Section>
      <Section title="Saves">
        <SavesPanel />
      </Section>
    </aside>
  )
}
