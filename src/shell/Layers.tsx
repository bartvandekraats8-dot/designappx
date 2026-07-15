import { useState } from 'react'

import { useStudio } from '../state/studio'
import {
  deleteSelection,
  duplicateSelection,
  groupSelection,
  moveLayer,
  renameLayer,
  selectLayer,
  setLayerLocked,
  setLayerVisible,
  ungroupSelection,
} from '../canvas/objects'
import { commit, publish } from '../canvas/sync'
import {
  IconDown,
  IconDuplicate,
  IconEye,
  IconEyeOff,
  IconGroup,
  IconLock,
  IconLockOpen,
  IconTrash,
  IconUngroup,
  IconUp,
} from '../icons/Icons'
import styles from './Layers.module.css'

/*
 * Layers panel — INC-2. Rows are top-first (frontmost object first),
 * published by sync.ts after every commit. Reorder / lock / hide / rename /
 * group / duplicate / delete all funnel through the same commit pipeline
 * so each is a single undo step.
 */

const KIND_GLYPHS: Record<string, string> = {
  xpstext: 'T',
  xpsimage: 'I',
  rect: 'R',
  ellipse: 'E',
  polygon: 'P',
  line: 'L',
  group: 'G',
}

export function Layers() {
  const layers = useStudio((state) => state.layers)
  const selection = useStudio((state) => state.selection)
  const controller = useStudio((state) => state.controller)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  if (!controller) return null
  const canvas = controller.canvas
  const hasSelection = selection !== null
  const activeCount = selection?.count ?? 0

  const commitRename = (id: string) => {
    renameLayer(canvas, id, draft)
    setRenaming(null)
    commit(canvas)
  }

  return (
    <div className={styles.wrap}>
      {layers.length === 0 ? (
        <p className={styles.empty}>Everything you add stacks here, top to bottom.</p>
      ) : (
        <ul className={styles.list}>
          {layers.map((layer) => (
            <li
              key={layer.id}
              className={styles.row}
              data-active={layer.active}
              data-locked={layer.locked}
            >
              <button
                type="button"
                className={styles.rowIcon}
                title={layer.visible ? 'Hide' : 'Show'}
                aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                onClick={() => {
                  setLayerVisible(canvas, layer.id, !layer.visible)
                  commit(canvas)
                }}
              >
                {layer.visible ? <IconEye /> : <IconEyeOff />}
              </button>
              <button
                type="button"
                className={styles.rowIcon}
                title={layer.locked ? 'Unlock' : 'Lock'}
                aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                data-active={layer.locked}
                onClick={() => {
                  setLayerLocked(canvas, layer.id, !layer.locked)
                  commit(canvas)
                }}
              >
                {layer.locked ? <IconLock /> : <IconLockOpen />}
              </button>
              <span className={styles.kind} aria-hidden="true">
                {KIND_GLYPHS[layer.kind] ?? '·'}
              </span>
              {renaming === layer.id ? (
                <input
                  className={styles.renameInput}
                  value={draft}
                  autoFocus
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={() => commitRename(layer.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitRename(layer.id)
                    if (event.key === 'Escape') setRenaming(null)
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={styles.name}
                  title={`${layer.name} — click to select, double-click to rename`}
                  onClick={(event) => {
                    selectLayer(canvas, layer.id, event.shiftKey)
                    publish(canvas)
                  }}
                  onDoubleClick={() => {
                    setRenaming(layer.id)
                    setDraft(layer.name)
                  }}
                >
                  {layer.name}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.toolBtn}
          title="Raise (toward front)"
          aria-label="Raise layer"
          disabled={activeCount !== 1}
          onClick={() => {
            const id = layers.find((layer) => layer.active)?.id
            if (id && moveLayer(canvas, id, 1)) commit(canvas)
          }}
        >
          <IconUp />
        </button>
        <button
          type="button"
          className={styles.toolBtn}
          title="Lower (toward back)"
          aria-label="Lower layer"
          disabled={activeCount !== 1}
          onClick={() => {
            const id = layers.find((layer) => layer.active)?.id
            if (id && moveLayer(canvas, id, -1)) commit(canvas)
          }}
        >
          <IconDown />
        </button>
        <span className={styles.toolSep} aria-hidden="true" />
        <button
          type="button"
          className={styles.toolBtn}
          title="Group selection"
          aria-label="Group selection"
          disabled={activeCount < 2}
          onClick={() => {
            if (groupSelection(canvas)) commit(canvas)
          }}
        >
          <IconGroup />
        </button>
        <button
          type="button"
          className={styles.toolBtn}
          title="Ungroup"
          aria-label="Ungroup"
          disabled={activeCount !== 1 || selection?.kind !== 'group'}
          onClick={() => {
            if (ungroupSelection(canvas)) commit(canvas)
          }}
        >
          <IconUngroup />
        </button>
        <span className={styles.toolSep} aria-hidden="true" />
        <button
          type="button"
          className={styles.toolBtn}
          title="Duplicate (offsets 5 mm)"
          aria-label="Duplicate selection"
          disabled={!hasSelection}
          onClick={() => {
            void duplicateSelection(canvas).then((changed) => {
              if (changed) commit(canvas)
            })
          }}
        >
          <IconDuplicate />
        </button>
        <button
          type="button"
          className={styles.toolBtn}
          data-danger="true"
          title="Delete (Del)"
          aria-label="Delete selection"
          disabled={!hasSelection}
          onClick={() => {
            if (deleteSelection(canvas)) commit(canvas)
          }}
        >
          <IconTrash />
        </button>
      </div>
    </div>
  )
}
