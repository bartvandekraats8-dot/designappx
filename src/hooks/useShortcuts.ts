/**
 * Global keyboard shortcuts (INC-2 approved set, Cmd/Ctrl+S wired to real
 * persistence in INC-8):
 *   V / T / S / I         tool switching
 *   Delete / Backspace    delete selection
 *   Cmd/Ctrl+Z            undo · +Shift redo (Ctrl+Y also redo)
 *   Cmd/Ctrl+S            save the active design (browser dialog suppressed)
 *   Escape                deselect
 *
 * Space (pan) is handled inside interactions.ts, next to the pointer logic
 * it modifies. Suppressed entirely while a modal dialog is open (the
 * dialog's own keydown handler calls `stopPropagation` on Escape/Tab so
 * they never reach this window-level listener — see `ExportDialog.tsx`).
 */

import { useEffect } from 'react'

import { useStudio } from '../state/studio'
import { deleteSelection } from '../canvas/objects'
import { commit, redo, undo } from '../canvas/sync'
import { applyToolMode } from '../canvas/interactions'
import { saveActiveDesign } from '../canvas/designs'
import type { ToolId } from '../state/tools'

const TOOL_KEYS: Record<string, ToolId> = {
  v: 'select',
  t: 'text',
  s: 'shape',
  i: 'image',
}

export function useShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return

      const state = useStudio.getState()
      const canvas = state.controller?.canvas
      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()

      if (mod && key === 's') {
        event.preventDefault()
        if (!canvas) return
        void saveActiveDesign(canvas).then(() => {
          state.setNotice(`Saved "${useStudio.getState().designName}".`)
        })
        return
      }
      if (mod && (key === 'z' || key === 'y')) {
        event.preventDefault()
        if (!canvas) return
        if (key === 'y' || event.shiftKey) void redo(canvas)
        else void undo(canvas)
        return
      }
      if (mod) return

      if (key === 'escape') {
        if (!canvas) return
        canvas.discardActiveObject()
        canvas.requestRenderAll()
        return
      }
      if (key === 'delete' || key === 'backspace') {
        event.preventDefault()
        if (!canvas) return
        if (deleteSelection(canvas)) commit(canvas)
        return
      }
      const tool = TOOL_KEYS[key]
      if (tool) {
        state.setTool(tool)
        if (canvas) applyToolMode(canvas)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
