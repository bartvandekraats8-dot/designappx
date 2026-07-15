import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'

import './styles/tokens.css'
import './styles/global.css'
/* Design fonts (curated 10) + re-register uploaded fonts from IndexedDB. */
import './data/fonts'
import { loadStoredFonts } from './canvas/fontStore'

import { App } from './App.tsx'

void loadStoredFonts()

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
