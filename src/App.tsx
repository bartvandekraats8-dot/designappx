import { TopBar } from './shell/TopBar'
import { ToolRail } from './shell/ToolRail'
import { CanvasStage } from './shell/CanvasStage'
import { MockupPreview } from './shell/MockupPreview'
import { PanelColumn } from './shell/PanelColumn'
import { StatusBar } from './shell/StatusBar'
import { useShortcuts } from './hooks/useShortcuts'
import styles from './App.module.css'

export function App() {
  useShortcuts()

  return (
    <div className={styles.app}>
      <TopBar />
      <div className={styles.middle}>
        <ToolRail />
        <CanvasStage />
        <MockupPreview />
        <PanelColumn />
      </div>
      <StatusBar />
    </div>
  )
}
