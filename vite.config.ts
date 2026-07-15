import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      // jsPDF references `canvg` for an SVG-import code path this app never
      // calls (we use svg2pdf.js for vector SVG->PDF instead) — safe to
      // externalize rather than installing an unused dependency tree.
      external: ['canvg'],
    },
  },
})
