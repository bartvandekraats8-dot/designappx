import { useState } from 'react'

import { useStudio } from '../state/studio'
import { IconExport } from '../icons/Icons'
import { ExportDialog } from './ExportDialog'
import styles from './TopBar.module.css'

export function TopBar() {
  const designName = useStudio((state) => state.designName)
  const setDesignName = useStudio((state) => state.setDesignName)
  const controller = useStudio((state) => state.controller)
  const [exportOpen, setExportOpen] = useState(false)

  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <span className={styles.mark} aria-label="X">
          <span aria-hidden="true">[</span>
          <span className={styles.markX}>X</span>
          <span aria-hidden="true">]</span>
        </span>
        <span className={styles.product}>Print Studio</span>
      </div>

      <div className={styles.center}>
        <input
          className={styles.designName}
          value={designName}
          spellCheck={false}
          aria-label="Design name"
          onChange={(event) => setDesignName(event.target.value)}
          onFocus={(event) => event.target.select()}
        />
      </div>

      <div className={styles.actions}>
        <span className={styles.unitChip} title="Working unit">mm</span>
        <button
          type="button"
          className={styles.export}
          aria-disabled={controller === null}
          title="Open the export panel"
          onClick={() => setExportOpen(true)}
        >
          <IconExport />
          <span>Export</span>
        </button>
      </div>

      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
    </header>
  )
}
