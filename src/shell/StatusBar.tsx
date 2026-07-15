import { useEffect, useState } from 'react'

import { TOOL_DEFS } from '../state/tools'
import { getGarment } from '../data/garments'
import { formatMm } from '../lib/units'
import { useStudio } from '../state/studio'
import styles from './StatusBar.module.css'

interface ReadoutProps {
  label?: string
  value: string
  unit: string
}

function Readout({ label, value, unit }: ReadoutProps) {
  return (
    <span className={styles.readout}>
      {label ? <span className={styles.readoutLabel}>{label}</span> : null}
      <span className={styles.readoutValue}>{value}</span>
      <span className={styles.readoutUnit}>{unit}</span>
    </span>
  )
}

const NOTICE_MS = 4000

export function StatusBar() {
  const activeTool = useStudio((state) => state.activeTool)
  const garmentId = useStudio((state) => state.garmentId)
  const zoom = useStudio((state) => state.view.zoom)
  const selection = useStudio((state) => state.selection)
  const notice = useStudio((state) => state.notice)
  const noticeSeq = useStudio((state) => state.noticeSeq)
  const setNotice = useStudio((state) => state.setNotice)
  const printWarnings = useStudio((state) => state.printWarnings)
  const dismissed = useStudio((state) => state.dismissedWarnings)
  const warningCount = printWarnings.filter(
    (w) => w.severity === 'warning' && !dismissed.includes(w.id),
  ).length

  const [noticeVisible, setNoticeVisible] = useState(false)
  useEffect(() => {
    if (!notice) return
    // This effect's real job is the timer subscription below (an external
    // system); resetting visibility to true alongside it — so a repeated
    // identical notice re-shows and re-times — is the companion half of
    // that same subscription, not standalone derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNoticeVisible(true)
    const timer = window.setTimeout(() => setNoticeVisible(false), NOTICE_MS)
    return () => window.clearTimeout(timer)
    // noticeSeq retriggers the timer for repeated identical notices
  }, [notice, noticeSeq])
  useEffect(() => {
    if (!noticeVisible && notice) setNotice(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noticeVisible])

  const tool = TOOL_DEFS.find((entry) => entry.id === activeTool) ?? TOOL_DEFS[0]
  const zone = getGarment(garmentId).zone

  return (
    <footer className={styles.status}>
      <div className={styles.left}>
        <span className={styles.toolDot} aria-hidden="true" />
        <span className={styles.toolName}>{tool.label}</span>
        {noticeVisible && notice ? (
          <span className={styles.notice} role="status">
            {notice}
          </span>
        ) : (
          <span className={styles.toolHint}>{tool.hint}</span>
        )}
      </div>

      <div className={styles.readouts}>
        {selection ? (
          <>
            <Readout label="X" value={formatMm(selection.xMm)} unit="mm" />
            <Readout label="Y" value={formatMm(selection.yMm)} unit="mm" />
            <span className={styles.sep} aria-hidden="true" />
            <Readout label="W" value={formatMm(selection.wMm)} unit="mm" />
            <Readout label="H" value={formatMm(selection.hMm)} unit="mm" />
          </>
        ) : (
          <>
            <Readout label="X" value="—" unit="mm" />
            <Readout label="Y" value="—" unit="mm" />
            <span className={styles.sep} aria-hidden="true" />
            <Readout label="W" value={formatMm(zone.widthMm)} unit="mm" />
            <Readout label="H" value={formatMm(zone.heightMm)} unit="mm" />
          </>
        )}
        <span className={styles.sep} aria-hidden="true" />
        {warningCount > 0 ? (
          <span
            className={styles.warningBadge}
            title={`${warningCount} print-check warning${warningCount === 1 ? '' : 's'}`}
          >
            {warningCount} ⚠
          </span>
        ) : null}
        <Readout value="300" unit="DPI" />
        {/* 100% = the 4 px/mm working resolution (see src/lib/units.ts). */}
        <Readout value={String(Math.round(zoom * 100))} unit="%" />
      </div>
    </footer>
  )
}
