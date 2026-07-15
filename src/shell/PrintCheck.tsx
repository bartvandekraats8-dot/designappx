/**
 * Print check panel — INC-5.
 *
 * Technique selector + the advisory warning list from the print-check rule
 * engine. Warnings are dismissible and never block anything. The canvas
 * funnel (sync.ts) re-evaluates on every artwork mutation; this component
 * covers the store-only triggers (technique / garment colour / spot-colour
 * limit) with an effect, since those changes never touch the canvas.
 */

import { useEffect } from 'react'

import { TECHNIQUES, getTechnique, type TechniqueId } from '../print/printCheck'
import { refreshPrintCheck } from '../canvas/sync'
import { useStudio } from '../state/studio'
import styles from './PrintCheck.module.css'

export function PrintCheck() {
  const technique = useStudio((state) => state.technique)
  const setTechnique = useStudio((state) => state.setTechnique)
  const screenColorLimit = useStudio((state) => state.screenColorLimit)
  const setScreenColorLimit = useStudio((state) => state.setScreenColorLimit)
  const warnings = useStudio((state) => state.printWarnings)
  const dismissed = useStudio((state) => state.dismissedWarnings)
  const dismissWarning = useStudio((state) => state.dismissWarning)
  const controller = useStudio((state) => state.controller)
  const colorId = useStudio((state) => state.colorId)
  const garmentId = useStudio((state) => state.garmentId)

  // Store-only triggers: technique, garment/colour, limit. Canvas mutations
  // already re-evaluate via the commit/publish funnel.
  useEffect(() => {
    if (controller) refreshPrintCheck(controller.canvas)
  }, [controller, technique, colorId, garmentId, screenColorLimit])

  const active = getTechnique(technique)
  const visible = warnings.filter((warning) => !dismissed.includes(warning.id))

  return (
    <div className={styles.stack}>
      <div className={styles.techGrid} role="radiogroup" aria-label="Print technique">
        {TECHNIQUES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="radio"
            aria-checked={entry.id === technique}
            className={styles.techBtn}
            data-active={entry.id === technique}
            onClick={() => setTechnique(entry.id as TechniqueId)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <p className={styles.blurb}>{active.blurb}</p>

      {technique === 'screen' ? (
        <label className={styles.limitRow}>
          <span className={styles.limitLabel}>Spot-colour limit</span>
          <input
            type="number"
            className={styles.limitInput}
            min={1}
            max={12}
            value={screenColorLimit}
            onChange={(event) => setScreenColorLimit(Number(event.target.value))}
          />
        </label>
      ) : null}

      {visible.length === 0 ? (
        <p className={styles.clear} role="status">
          No issues for {active.label.toLowerCase()} with the current artwork.
        </p>
      ) : (
        <ul className={styles.list} aria-label="Print warnings">
          {visible.map((warning) => (
            <li
              key={warning.id}
              className={styles.item}
              data-severity={warning.severity}
            >
              <div className={styles.itemBody}>
                {warning.objectName ? (
                  <span className={styles.itemObject}>{warning.objectName}</span>
                ) : null}
                <span className={styles.itemMessage}>{warning.message}</span>
              </div>
              <button
                type="button"
                className={styles.dismiss}
                title="Dismiss for this session"
                aria-label="Dismiss warning"
                onClick={() => dismissWarning(warning.id)}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
