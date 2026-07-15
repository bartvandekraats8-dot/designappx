import { useEffect, useState } from 'react'

import { useStudio } from '../state/studio'
import type { DesignRecord, VersionRecord } from '../data/db'
import { listDesigns, listVersions } from '../data/persistence'
import {
  duplicateDesign,
  removeDesign,
  saveActiveDesign,
  saveAsNewDesign,
} from '../canvas/designs'
import { restoreSnapshot } from '../canvas/sync'
import { IconDuplicate, IconHistory, IconSave, IconTrash } from '../icons/Icons'
import styles from './SavesPanel.module.css'

const CONFIRM_TIMEOUT_MS = 4000

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/**
 * Named saves + version history — INC-8. Autosave (a single reload-
 * survival slot, `canvas/autosave.ts`) runs independently of this panel;
 * everything here is explicit user action: Save/Save-as-new write a
 * `DesignRecord` + append a `VersionRecord`, Load replaces the canvas via
 * `StudioController.loadDesign`, and version Restore replaces just the
 * artwork (`restoreSnapshot`) without touching garment/colour/technique —
 * versions snapshot artwork only, not the full project.
 */
export function SavesPanel() {
  const controller = useStudio((state) => state.controller)
  const activeDesignId = useStudio((state) => state.activeDesignId)
  const lastSavedAt = useStudio((state) => state.lastSavedAt)
  const designName = useStudio((state) => state.designName)
  const setNotice = useStudio((state) => state.setNotice)

  const [designs, setDesigns] = useState<DesignRecord[]>([])
  const [versions, setVersions] = useState<VersionRecord[]>([])
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)

  const refreshDesigns = async () => setDesigns(await listDesigns())
  const refreshVersions = async (id: string | null) =>
    setVersions(id ? await listVersions(id) : [])

  useEffect(() => {
    // Fetching from IndexedDB (an external system) on mount — the setState
    // happens after an await, not synchronously; the linter can't see
    // across that boundary and flags the call site itself.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshDesigns()
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshVersions(activeDesignId)
  }, [activeDesignId])

  useEffect(() => {
    if (!confirmingDelete) return
    const timer = window.setTimeout(() => setConfirmingDelete(null), CONFIRM_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [confirmingDelete])

  if (!controller) return null
  const canvas = controller.canvas

  const withBusy = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
    } finally {
      setBusy(false)
    }
  }

  const handleSave = () =>
    withBusy(async () => {
      await saveActiveDesign(canvas)
      await refreshDesigns()
      await refreshVersions(useStudio.getState().activeDesignId)
      setNotice(`Saved "${designName}".`)
    })

  const handleSaveAsNew = () =>
    withBusy(async () => {
      await saveAsNewDesign(canvas)
      await refreshDesigns()
      await refreshVersions(useStudio.getState().activeDesignId)
      setNotice(`Saved "${useStudio.getState().designName}" as a new design.`)
    })

  const handleLoad = (design: DesignRecord) =>
    withBusy(async () => {
      await controller.loadDesign({
        id: design.id,
        designName: design.name,
        garmentId: design.garmentId,
        colorId: design.colorId,
        technique: design.technique,
        screenColorLimit: design.screenColorLimit,
        artwork: design.artwork,
      })
      setNotice(`Loaded "${design.name}".`)
    })

  const handleDuplicate = (id: string) =>
    withBusy(async () => {
      const copy = await duplicateDesign(id)
      if (copy) {
        await refreshDesigns()
        setNotice(`Duplicated as "${copy.name}".`)
      }
    })

  const handleDelete = (design: DesignRecord) => {
    if (confirmingDelete !== design.id) {
      setConfirmingDelete(design.id)
      return
    }
    setConfirmingDelete(null)
    void withBusy(async () => {
      await removeDesign(design.id)
      await refreshDesigns()
      setNotice(`Deleted "${design.name}".`)
    })
  }

  const handleRestoreVersion = (version: VersionRecord) =>
    withBusy(async () => {
      await restoreSnapshot(canvas, JSON.stringify(version.artwork))
      setNotice(`Restored the version from ${formatTimestamp(version.savedAt)}.`)
    })

  return (
    <div className={styles.wrap}>
      <div className={styles.saveRow}>
        <button
          type="button"
          className={styles.primary}
          disabled={busy}
          onClick={() => void handleSave()}
        >
          <IconSave />
          Save
        </button>
        <button
          type="button"
          className={styles.secondary}
          disabled={busy}
          onClick={() => void handleSaveAsNew()}
        >
          Save as new
        </button>
      </div>
      {lastSavedAt !== null && (
        <p className={styles.hint}>Last saved {formatTimestamp(lastSavedAt)}</p>
      )}

      {designs.length === 0 ? (
        <p className={styles.empty}>No saved designs yet.</p>
      ) : (
        <ul className={styles.list}>
          {designs.map((design) => (
            <li
              key={design.id}
              className={styles.row}
              data-active={design.id === activeDesignId}
            >
              <button
                type="button"
                className={styles.thumbButton}
                title={`Load "${design.name}"`}
                aria-label={`Load "${design.name}"`}
                onClick={() => void handleLoad(design)}
              >
                <img src={design.thumbnail} alt="" className={styles.thumb} />
              </button>
              <div className={styles.meta}>
                <button type="button" className={styles.name} onClick={() => void handleLoad(design)}>
                  {design.name}
                </button>
                <span className={styles.timestamp}>{formatTimestamp(design.updatedAt)}</span>
              </div>
              <div className={styles.rowActions}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  title="Duplicate"
                  aria-label={`Duplicate ${design.name}`}
                  onClick={() => void handleDuplicate(design.id)}
                >
                  <IconDuplicate />
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  data-danger="true"
                  data-confirm={confirmingDelete === design.id}
                  title={confirmingDelete === design.id ? 'Click again to confirm' : 'Delete'}
                  aria-label={`Delete ${design.name}`}
                  onClick={() => handleDelete(design)}
                >
                  <IconTrash />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {activeDesignId && versions.length > 0 && (
        <div className={styles.history}>
          <h4 className={styles.historyTitle}>
            <IconHistory />
            Version history
          </h4>
          <ul className={styles.versionList}>
            {versions.map((version) => (
              <li key={version.id} className={styles.versionRow}>
                <img src={version.thumbnail} alt="" className={styles.versionThumb} />
                <span className={styles.timestamp}>{formatTimestamp(version.savedAt)}</span>
                <button
                  type="button"
                  className={styles.action}
                  disabled={busy}
                  onClick={() => void handleRestoreVersion(version)}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
