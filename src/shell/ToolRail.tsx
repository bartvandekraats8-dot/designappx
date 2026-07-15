import { TOOL_DEFS } from '../state/tools'
import { useStudio } from '../state/studio'
import { applyToolMode } from '../canvas/interactions'
import {
  IconSelect,
  IconText,
  IconShape,
  IconImage,
  IconGrid,
  IconFit,
  IconMockup,
} from '../icons/Icons'
import type { ToolId } from '../state/tools'
import styles from './ToolRail.module.css'

const TOOL_ICONS: Record<ToolId, typeof IconSelect> = {
  select: IconSelect,
  text: IconText,
  shape: IconShape,
  image: IconImage,
}

export function ToolRail() {
  const activeTool = useStudio((state) => state.activeTool)
  const setTool = useStudio((state) => state.setTool)
  const snapEnabled = useStudio((state) => state.snapEnabled)
  const toggleSnap = useStudio((state) => state.toggleSnap)
  const controller = useStudio((state) => state.controller)
  const viewMode = useStudio((state) => state.viewMode)
  const setViewMode = useStudio((state) => state.setViewMode)

  return (
    <nav className={styles.rail} aria-label="Tools">
      <div className={styles.group} role="radiogroup" aria-label="Active tool">
        {TOOL_DEFS.map((tool) => {
          const Icon = TOOL_ICONS[tool.id]
          const active = tool.id === activeTool
          return (
            <button
              key={tool.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={tool.label}
              title={`${tool.label} · ${tool.hint} (${tool.shortcut})`}
              className={styles.tool}
              data-active={active}
              onClick={() => {
                setTool(tool.id)
                if (controller) applyToolMode(controller.canvas)
              }}
            >
              <Icon />
            </button>
          )
        })}
      </div>

      <div className={styles.spacer} />

      <div className={styles.group}>
        <button
          type="button"
          className={styles.aux}
          aria-pressed={snapEnabled}
          data-active={snapEnabled}
          aria-label="5 mm snap grid"
          title={snapEnabled ? 'Snap grid on — 5 mm' : 'Snap grid off'}
          onClick={toggleSnap}
        >
          <IconGrid />
        </button>
        <button
          type="button"
          className={styles.aux}
          aria-disabled={controller === null}
          aria-label="Fit zone to view"
          title="Fit the print zone to the viewport"
          onClick={() => controller?.fit()}
        >
          <IconFit />
        </button>
        <button
          type="button"
          className={styles.aux}
          aria-pressed={viewMode === 'mockup'}
          data-active={viewMode === 'mockup'}
          aria-label="Garment mockup preview"
          title={
            viewMode === 'mockup'
              ? 'Mockup preview on — back to design'
              : 'Preview the design on the garment'
          }
          onClick={() => setViewMode(viewMode === 'mockup' ? 'design' : 'mockup')}
        >
          <IconMockup />
        </button>
      </div>
    </nav>
  )
}
