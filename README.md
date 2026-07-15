# [X] Print Studio

A single-user, fully client-side design studio for the clothing brand **[X]** —
no backend, no storefront, no 3D. Create print and text artwork on a
millimetre-accurate canvas with live print-zone / DPI / print-technique
guidance, preview it flat on a chosen garment and colour, and export
print-ready files in every format a small print run actually needs.

Built in ten numbered increments (INC-0 … INC-9, all shipped). The
authoritative build log, decision log, and changelog live in
`X_print_studio_BUILD_PLAN.md`; `X_print_studio_PHASED_PLAN.md` groups them
into phases with a definition-of-done per increment.

## Features

- **Canvas** — Fabric.js 7 canvas at 4 px/mm, six garments (T-shirt, hoodie,
  sweatshirt, long-sleeve, tote, cap) with real print zones, bleed, and
  safe-area guides in mm; cursor-anchored zoom, fit-to-zone, adaptive mm
  rulers, a 5 mm snap grid.
- **Tools** — select/transform with numeric mm inputs, align/distribute,
  shapes (rect/ellipse/polygon/line, solid + gradient fill, mm stroke),
  layers (reorder/lock/hide/group/duplicate), unlimited undo/redo.
- **Text** — 10 curated open-licence fonts plus TTF/OTF upload, arc/wave
  effects, size/weight/tracking/line-height/align/all-caps.
- **Images** — PNG/JPG/WebP/GIF/SVG upload, non-destructive mm-inset crop,
  a live per-axis DPI badge that warns below 300 DPI.
- **Print check** — advisory rules for DTG, screen print, embroidery, and
  sublimation (light-on-dark text, colour-count vs. a configurable
  spot-colour limit, minimum stitch size, fabric notes). Warns, never blocks.
- **Mockup preview** — a flat composite of the artwork on the chosen
  garment/colour, using parametrically generated silhouettes (not licensed
  art assets).
- **Export** — PNG (transparent, 300 DPI), JPG (chosen background), SVG
  (vector, embedded fonts), PDF (physical size, optional bleed + crop marks,
  CMYK-intent metadata), the mockup as PNG/JPG, and a re-importable project
  JSON — individually or bundled into a ZIP with a generated spec sheet.
  Scope is the whole zone, the current selection, or a single layer.
- **Persistence** — debounced IndexedDB autosave (survives a reload before
  you've saved anything), named saves with thumbnails, and per-design
  version history with restore.

## Stack

| Library | Version | Role |
|---|---|---|
| react / react-dom | 19.2.7 | UI |
| vite | 8.1.1 | Build tool / dev server |
| typescript | 6.0.3 | Types (`tsc -b`, project references) |
| fabric | 7.4.0 | Canvas engine |
| zustand | 5.0.14 | App state |
| idb | 8.0.3 | IndexedDB (fonts, designs, version history, autosave) |
| jspdf | 4.2.1 | PDF export container |
| svg2pdf.js | 2.7.0 | SVG → vector PDF |
| jszip | 3.10.1 | ZIP bundle export |
| @fontsource/* | 5.2.x | Self-hosted UI + design fonts (no CDN, so exports embed cleanly) |
| eslint / typescript-eslint | 10.7.0 / 8.64.0 | Linting (flat config, `eslint.config.js`) |

No backend anywhere in this list. Two honest, permanent limits, not bugs:
true CMYK separation and photorealistic warped mockups both require a
server-side step (see `X_print_studio_BUILD_PLAN.md` §6) — this app ships
the RGB/flat equivalents with that noted wherever it's relevant (PDF
metadata, spec sheet).

## Requirements

- Node.js **20.19+ or 22.12+** (Vite 8's floor). Verify with `node --version`.
- A Chromium/Firefox/Safari build from the last ~2 years (uses `structuredClone`-era Canvas/SVG/IndexedDB APIs — no polyfills are included).

## Replication steps

1. **Get the source.** Clone or copy this directory (`x-print-studio/`) —
   it's self-contained; nothing outside it is required.
2. **Install Node** if `node --version` doesn't already satisfy the
   requirement above (nodejs.org, or your platform's version manager).
3. **Install dependencies**: `npm install` from the project root. This
   pulls every row in the Stack table above; nothing is fetched from a
   CDN at runtime.
4. **Start the dev server**: `npm run dev`, then open the printed
   `http://localhost:5173` URL. Hot module reload is on by default.
5. **Type-check + production build**: `npm run build` (runs `tsc -b` then
   `vite build`; output lands in `dist/`). This is the same command CI/a
   deploy pipeline should run — it's the pass/fail gate for every increment
   in the build log.
6. **Preview the production build** (optional): `npm run preview` serves
   the `dist/` output locally, so you're testing the actual built bundle,
   not the dev server.
7. **Lint**: `npm run lint` (flat-config ESLint — TypeScript-aware rules
   plus `react-hooks`/`react-refresh`). Clean on a fresh checkout.
8. **First run**: pick a garment, place some text/shapes/an image, switch
   print technique to see the advisory checks, toggle the mockup preview,
   open Export to try a format, and check the Saves panel — work already
   autosaved the moment you made a change, before you ever clicked Save.

No environment variables, no `.env` file, no external accounts — the app
has no network calls of its own (fonts and the app bundle are all
same-origin static assets).

## Structure

```
x-print-studio/
├── X_print_studio_BUILD_PLAN.md      running build log, decisions, changelog
├── X_print_studio_PHASED_PLAN.md     phase map + per-increment DoD
├── eslint.config.js                  flat ESLint config
├── vite.config.ts
├── package.json
└── src/
    ├── main.tsx                 entry point; loads fonts, boots stored fonts
    ├── App.tsx                  shell composition
    ├── App.module.css
    ├── shell/                   TopBar, ToolRail, CanvasStage, MockupPreview,
    │                            PanelColumn, StatusBar, ExportDialog, SavesPanel,
    │                            Properties, Layers, PrintCheck (+ .module.css each)
    ├── state/
    │   ├── studio.ts            app-level zustand store (garment, technique,
    │   │                        view, design name, active save, controller...)
    │   └── tools.ts             tool model (const list + union type; no enums)
    ├── canvas/                  Fabric integration: meta/objects/shapes/xpsText/
    │                            xpsImage/overlays/history/sync/transform/align/
    │                            interactions/exportPng/renderZone/fontStore/
    │                            autosave/designs
    ├── data/                    garments.ts, fonts.ts (catalogues), db.ts (shared
    │                            idb connection), persistence.ts (CRUD)
    ├── features/mockup/         garmentArt.ts (silhouette geometry), compositor.ts
    ├── export/                  exportSvg/exportJpg/exportPdf/pdfFonts/exportMockup/
    │                            exportJson/specSheet/exportZip/fontEmbed/filename
    ├── print/printCheck.ts      advisory print-technique rule engine
    ├── icons/Icons.tsx          inline SVG icon set
    ├── hooks/useShortcuts.ts    global keyboard shortcuts
    └── styles/
        ├── tokens.css           Atelier Dark design tokens
        └── global.css           reset, focus rings, reduced-motion baseline
```

## Keyboard

| Key | Action |
|---|---|
| V / T / S / I | Select / Text / Shape / Image tool |
| Delete, Backspace | Delete selection |
| Cmd/Ctrl+Z | Undo |
| Cmd/Ctrl+Shift+Z, Cmd/Ctrl+Y | Redo |
| Cmd/Ctrl+S | Save the active design (browser's save dialog is suppressed) |
| Escape | Deselect (or close the Export dialog, if open) |
| Space + drag, middle-mouse drag | Pan |
| Mouse wheel / trackpad | Zoom, cursor-anchored |

All shortcuts are suspended while typing in a text field and while the
Export dialog is open (see next section).

## Accessibility & motion

- Every icon-only control has an `aria-label`; radio-style pickers (tool
  rail, garment, textile colour, align, effect) use `role="radiogroup"` /
  `role="radio"` with `aria-checked`.
- The Export dialog is the app's one modal: it traps Tab/Shift+Tab within
  itself, closes on Escape, moves focus in on open, and restores focus to
  the button that opened it on close.
- All CSS transitions route through `--motion-fast/base/slow` tokens
  (`styles/tokens.css`), which collapse to `0ms` under
  `prefers-reduced-motion: reduce` (`styles/global.css`) — there is no
  JS-driven animation (no `requestAnimationFrame`, no imperative
  `.animate()` calls) to separately gate.
- Focus rings are visible everywhere (`:focus-visible` in `global.css`);
  nothing suppresses the browser default beyond restyling it on-brand.

## Licensing note (fonts)

The ten curated fonts are self-hosted via `@fontsource`. Nine are OFL
(SIL Open Font License); **Permanent Marker** is Apache-2.0. Both licences
permit embedding in exported files; see `src/data/fonts.ts` for the exact
list.
