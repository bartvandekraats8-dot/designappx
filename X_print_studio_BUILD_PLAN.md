# [X] Print Design Studio — Build Plan & Continuation File
> Version 1.0 — all ten increments (INC-0 … INC-9) complete. Date: 2026-07-15.
> Purpose: paste/upload this file (plus the original prompt) into a fresh Claude chat to resume exactly where we left off. Nothing left to resume — see §5's progress tracker and README.md for the shipped feature set.

---

## 1. Goal (restated)

A single-user, fully client-side design studio for the clothing brand `[X]`. The user creates
print and text-print artwork on a mm-accurate canvas with live print-zone / DPI / technique
guidance, previews the design composited on a chosen garment + colour (flat 2D), and exports
print-ready files (PNG / JPG / SVG / PDF / mockup / JSON project / ZIP bundle with spec sheet).
No shop, no backend, no 3D.

## 2. Verified library versions (checked against npm registry on 2026-06-12)

| Library      | Version  | Role                                            |
|--------------|----------|-------------------------------------------------|
| react        | 19.2.7   | UI (prompt says 18+, 19 is current stable)       |
| vite         | 8.0.16   | Build tool / dev server                          |
| fabric       | 7.4.0    | Canvas engine (v6+ is ESM + promise-based — do NOT copy v5-era tutorial code) |
| zustand      | 5.0.14   | App state (garment, technique, panels, history)  |
| jszip        | 3.10.1   | ZIP bundle export                                |
| jspdf        | 4.2.1    | PDF export container                             |
| svg2pdf.js   | 2.7.0    | SVG → vector PDF (keeps text/paths as vector)    |
| idb          | 8.0.3    | IndexedDB persistence (chosen over localforage: smaller, typed, promise-native) |
| opentype.js  | 2.0.0    | OPTIONAL — only if "outline text to paths" export option is approved |
| eslint       | 10.7.0   | Linting (INC-9, dev-only; verified 2026-07-15, not at the original planning date) |
| typescript-eslint | 8.64.0 | TS-aware lint rules (INC-9, dev-only; verified 2026-07-15) |

No backend required for anything in scope. Two honest server-side flags:
- **True CMYK PDF** cannot be produced in-browser (jsPDF/pdf-lib are RGB). MVP ships RGB PDF at
  correct physical size + bleed/crop marks, with CMYK *intent* noted in the PDF metadata and spec
  sheet. Real CMYK conversion = print shop / later server step.
- **Realistic warped mockups** — out of scope per prompt; flat composite for MVP. Swap-in point
  for a mockup API is `src/features/mockup/compositor.ts` (single function boundary).

## 3. Assumptions — confirmed / challenged

| Prompt assumption | Verdict |
|---|---|
| Single user, no auth | ✅ Confirmed |
| Client-side only, IndexedDB persistence | ✅ Confirmed. Custom uploaded fonts (TTF/OTF) will be stored as binary blobs in IndexedDB and re-registered via the native `FontFace` API on load — no library needed. |
| Verify library versions | ✅ Done (table above). Notable: Fabric is now **v7** — class-based ESM imports (`import { Canvas, Textbox } from 'fabric'`), async loaders. |
| React 18+ | Challenged → use **React 19.2** (stable, Vite 8 templates target it). |
| jspdf *or* pdf-lib | Challenged → **jspdf + svg2pdf.js**: it's the only clean in-browser path that keeps text/paths vector in PDF (route: Fabric `toSVG` → svg2pdf). pdf-lib would force rasterising the artwork. |
| idb *or* localforage | Decided → **idb** (localforage is in maintenance mode, last major 2021). |

## 4. Open decisions (defaults apply if no answer)

1. **Garment mockup imagery** — DEFAULT: built-in flat vector SVG garment illustrations (recolourable
   via CSS/fill, crisp at any size, no licensing issues). Alternative: user uploads own garment photos
   per garment/colour (supported later via the same garment data file).
2. **SVG/PDF text** — DEFAULT: text stays as `<text>` elements with the font embedded via
   `@font-face` (true vector, still editable). Optional toggle (adds opentype.js): "outline text to
   paths" — what most print shops prefer, but text is no longer editable in the file.
3. **Units** — DEFAULT: mm everywhere (prompt is mm-based), with inch shown as secondary read-only
   value in the spec sheet.
4. **Curated font list** — DEFAULT mix of ~10 open-licence (OFL) fonts spanning streetwear-bold to
   minimal: Archivo Black, Anton, Bebas Neue, Space Grotesk, Inter, DM Sans, IBM Plex Mono,
   Playfair Display, Permanent Marker, Unbounded. (Self-hosted in `/public/fonts`, not Google CDN,
   so exports embed cleanly.)
5. **Screen-print colour limit** — DEFAULT: configurable, initial value 4 spot colours.

**Approved 2026-07-02 (INC-1 defaults, locked):**
- Print zones (mm, front): T-shirt & long-sleeve 305×406 · hoodie 305×330 · sweatshirt 305×380 · tote 280×350 · cap front panel 120×60. Source: standard DTG platen practice; brand-specific overrides go in `src/data/garments.ts`.
- Bleed 3 mm / safe inset 5 mm project-wide (bleed becomes materially relevant for the INC-7 PDF boxes; drawn from day one).
- Textile palette: 8 shared colours (black, white, bone, heather grey, navy, forest, burgundy, sand) with per-garment availability flags — cap and tote run reduced ranges to prove the mechanism.
- Fit control wired in INC-1 (canvas has real dimensions); Grid stays inert until INC-2.

**Approved 2026-07-02 (INC-2 defaults, locked):**
- Undo/redo: snapshot-based (artwork-only JSON per committed action, bounded stack of 50). Same serialization seeds INC-7 JSON export + INC-8 persistence.
- ⌘S: bound; browser dialog suppressed; status notice that persistence lands INC-8.
- Polygon = regular N-gon (sides 3–12, default 6); freeform path editing out of scope.
- Gradients: 2-stop, linear (angle control) + radial; multi-stop deferred (data model already stores stop arrays).
- Panning: space-hold drag + middle-mouse drag; select tool owns plain click-drag.

**Approved 2026-07-02 (INC-3 defaults, locked):**
- idb enters at INC-3 (DoD requires reload-surviving fonts). Database `xps-studio` v1, store `fonts`; INC-8 extends THIS database (version bump), never a second one.
- Effects: Arc (signed bend −100…100 → up to 252° of arc) + Wave (sine baseline). Effect text is not inline-editable (per-glyph rendering breaks caret math) — content edits via the panel; single-line; uniform fill/stroke. SVG strategy for effect text (per-glyph <text> vs outlined paths) deferred to INC-7; serialization already carries everything both need.
- Per-family weight lists (400+700 where real, single where not); latin subsets; UI clamps weight on family change so single-weight faces never faux-bold.
- Text size in mm (default 12 mm); tracking in ‰ em (fabric charSpacing native); T-click places a Textbox in editing mode.

**Approved 2026-07-15 (INC-4 defaults, locked — flag for override if wrong):**
- Crop UI: four numeric mm insets (top/right/bottom/left), not a drag-handle
  crop-rectangle overlay. Matches the app's existing precision-input language
  (X/Y/W/H/∠ are already mm number fields) and is exactly verifiable by
  arithmetic without a running browser to check drag geometry against. A
  drag-handle overlay is a reasonable later addition, not dropped — just not
  the INC-4 default.
- SVG import: rasterized on placement at a fixed 2400 px long edge (browsers
  report a useless ~300×150 "natural size" for SVGs with no explicit
  width/height, so a fixed high-resolution target is used instead of trusting
  the source's declared size). SVG objects therefore behave as raster images
  from this point on — vector fidelity is not preserved into later export;
  their DPI badge reads "Vector" (skipped, not scored) since the rasterized
  pixel count is an implementation detail, not a real quality ceiling.
  True vector passthrough (SVG in, SVG out) is a distinct, larger feature —
  flagging it as a candidate for a later increment if wanted.
- Placement size: new images default to fitting within min(120 mm, 60% of
  the garment zone's shorter side) on the long edge, centred on the click
  point — never upscaled past the source's native pixel size (a small
  source places at its true size rather than a falsely inflated one, so the
  DPI badge is never lying from the moment of placement).
- DPI threshold: flags below `EXPORT_DPI` (300), matching the export
  pipeline's own target — one constant, not a second magic number.

Warm darkroom: chalk-on-slate neutrals; the paper artboard is the only lit surface; process magenta `#F5358A` is reserved for the registration-mark signature and interactive states; IBM Plex Mono for every measurement readout. Full token set in `src/styles/tokens.css` (raw scales + semantic layer); canvas-side hex mirrors of tokens are documented in `src/canvas/overlays.ts` (canvas fills cannot read CSS custom properties — change both together).

## 5. Build order (increments — one per chat turn, each ends runnable)

> Rule from prompt: complete files only, never snippets. Each increment ends with build-log +
> changelog entries appended to §7/§8 of THIS file.

- **INC-0 — Scaffold**: Vite + React 19 + TS, folder structure, Atelier Dark tokens
  (`src/styles/tokens.css` exactly as specced), app shell (left toolbar / canvas / right panels),
  fonts wired, `prefers-reduced-motion` baseline. _Acceptance: app runs, empty shell themed._
- **INC-1 — Canvas core + garments**: Fabric 7 canvas; `src/data/garments.ts` (T-shirt, hoodie,
  sweatshirt, long-sleeve, tote, cap — front zones in mm, textile colour palette); mm↔px @300DPI
  mapping util; print-zone / bleed / safe-zone overlays + mm rulers; **basic transparent PNG export
  at 300 DPI** (verify the pipeline early, per prompt). _Acceptance: pick garment, see correct zone, download PNG at correct pixel size._
- **INC-2 — Tools & layers**: select/transform with mm-precise X/Y/W/H inputs, flip, aspect lock;
  align/distribute (to selection or zone); 5mm snap grid toggle; shapes (rect/ellipse/polygon/line,
  solid+gradient fill, mm stroke); layers panel (reorder/rename/lock/hide/group/duplicate/delete);
  undo/redo stack; shortcuts (V, T, ⌘Z/⇧⌘Z, ⌘S, Delete).
- **INC-3 — Text tools (priority)**: curated fonts + TTF/OTF upload (FontFace + IndexedDB blob);
  size/weight/letter-spacing/line-height/align/all-caps; solid+gradient fill; stroke; arc/curve
  text; basic warp; multiple independent text layers.
- **INC-4 — Images + DPI check**: PNG/JPG/SVG upload, crop/scale, transparency preserved; live DPI
  badge per raster object, `--warning` state below 300 DPI at placed size.
- **INC-5 — Technique warnings**: technique selector (DTG / screen / embroidery / sublimation);
  rule engine per spec (thin light text on dark, colour-count vs limit, <4mm text, gradients/fine
  detail + thread count, polyester note). Warn, never block.
- **INC-6 — Mockup preview**: flat composite of canvas onto garment SVG at correct zone
  position/scale; live colour switching; clearly marked API swap-in point.
- **INC-7 — Export suite**: panel with format/resolution choice + dimension/DPI preview;
  PNG (transparent, 300DPI), JPG (chosen bg), SVG (vector, embedded fonts), PDF (physical size,
  optional bleed + crop marks, CMYK intent note), mockup PNG/JPG, JSON project (re-importable,
  custom props), selection-only + per-layer export, ZIP bundle + generated spec sheet;
  filename pattern `[X]_{design-name}_{format}` sanitised.
- **INC-8 — Persistence**: idb autosave (debounced), manual named saves, design list with
  thumbnails (load/duplicate/delete), version snapshot per manual save + restore.
- **INC-9 — Polish & docs**: keyboard a11y pass, reduced-motion audit, README (stack+versions,
  structure, setup, numbered replication steps), finalise build log + changelog.

## 6. Resume protocol (after credit limit / new chat)

1. Upload the original prompt file AND the latest version of this file (plus the project ZIP from
   the last increment, if one was delivered).
2. Say: “Resume [X] Print Studio at INC-N” (N = first increment whose checkbox below is unticked).
3. Claude must re-read §2–§5, unzip/inspect the delivered code, and continue with complete files only.

**Progress tracker**
- [x] INC-0 Scaffold
- [x] INC-1 Canvas core + garments + first PNG export
- [x] INC-2 Tools & layers
- [x] INC-3 Text tools
- [x] INC-4 Images + DPI
- [x] INC-5 Technique warnings
- [x] INC-6 Mockup preview
- [x] INC-7 Export suite
- [x] INC-8 Persistence
- [x] INC-9 Polish & docs

## 7. Build log (running)

- 2026-06-12 — Planning: verified all library versions against npm; selected idb over localforage,
  jspdf+svg2pdf.js over pdf-lib (vector-text requirement); flagged CMYK + warped mockups as the
  only genuinely server-side items; defined 10 increments; no code yet (per prompt §before_you_begin).

- 2026-06-30 (recorded 2026-07-02) — INC-0: Vite 8 / React 19 / TS 6 scaffold; Atelier Dark
  tokens; app shell (TopBar, ToolRail, CanvasStage, collapsible PanelColumn, StatusBar);
  fonts via @fontsource; `tsc -b && vite build` zero errors. Shipped as x-print-studio_INC-0.zip.
- 2026-07-02 — INC-1: re-verified fabric 7.4.0 + zustand 5.0.14 against npm (unchanged);
  probed Fabric 7 export semantics from source — `toDataURL` crop box lives in
  viewport-transformed space and current zoom multiplies into output, so export resets the
  viewport transform to identity (mandatory, not defensive); overlays excluded via the
  `filter` predicate. Shipped: 4 px/mm working-space unit system (`src/lib/units.ts`),
  garment catalogue with mm zones + per-garment palettes (`src/data/garments.ts`), zustand
  studio store with canvas controller (`src/state/studio.ts`), zone/bleed/safe/registration
  overlays rendered zoom-compensated (`src/canvas/overlays.ts`), transparent 300 DPI PNG
  export with sanitised `[X]_{name}_PNG` filenames (`src/canvas/exportPng.ts`), Fabric 7
  canvas with cursor-anchored wheel zoom, fit-to-zone, live adaptive mm rulers
  (CanvasStage rewrite), garment picker + textile swatches (PanelColumn), wired Export /
  Fit, live zone + zoom readouts (StatusBar). Export px verified for all six zones
  (305mm→3602px … 60mm→708px). Known, deliberate: PNG carries no pHYs DPI chunk —
  pixel size is the contract; DPI metadata + spec sheet arrive INC-7. Drag-panning
  deliberately absent until INC-2 owns the gesture space. `tsc -b && vite build` zero errors.

- 2026-07-02 — INC-2: probed Fabric 7 group semantics from source — `Group.removeAll()`
  restores children to scene coordinates via `exitGroup(child, false)`, ActiveSelection
  extends Group, `enlivenObjects`/`moveObjectTo`/`clone` confirmed. Shipped: object
  metadata module (`src/canvas/meta.ts` — xpsId/xpsName/xpsLocked, serialized via
  `toObject(XPS_PROPS)`); snapshot history (`history.ts`, artwork-only, stack of 50);
  commit pipeline (`sync.ts` — every mutation funnels through ensureOverlayOrder →
  historyPush → refreshLayers → publishSelection); shape factories + 2-stop gradient
  builder/reader (`shapes.ts`); mm-precise box math with bounding-rect X/Y and
  geometry×scale W/H (`transform.ts`); align/distribute vs zone or selection using the
  dissolve-ActiveSelection approach (`align.ts`); layer ops incl. group/ungroup/duplicate/
  reorder against the canonical stack [paper, grid, artwork…, guides, regs] (`objects.ts`,
  `ensureOverlayOrder` + ARTWORK_START_INDEX=2 in overlays.ts); interaction layer with
  drag-to-draw (shift constrain, click drops 40 mm default), 5 mm move-snap, space/middle
  panning (`interactions.ts`); world-space 5 mm grid overlay toggled by the Grid button;
  Properties panel (X/Y/W/H/∠ mm inputs, aspect lock, flips, arrange, solid/linear/radial
  fill, mm stroke); Layers panel (select/shift-multi, rename via dblclick, lock, hide,
  raise/lower, group/ungroup, duplicate +5 mm, delete); global shortcuts V/T/S/I, Del,
  ⌘Z/⇧⌘Z/⌘Y, ⌘S notice, Esc; selection chrome themed to Atelier Dark (magenta accents).
  Geometry verified headlessly (N-gon on-circle apex-up; gradient angle→unit coords;
  snap rounding). Scaling-edge snap deliberately deferred (numeric inputs cover precise
  sizing); layer drag-reorder deferred to INC-9 polish (buttons ship now).
  `tsc -b && vite build` zero errors.

- 2026-07-02 — INC-3: re-verified idb 8.0.3 + 7 new @fontsource packages against npm
  (all 5.2.x). Shipped: curated font catalogue with honest per-family weights + explicit
  weight-file css imports (`src/data/fonts.ts`); idb font store — TTF/OTF blobs in
  IndexedDB, FontFace re-registration on boot, quota/private-mode fallbacks
  (`src/canvas/fontStore.ts`); `XpsText extends Textbox` with arc/wave per-glyph vector
  rendering, real effect bounding boxes, allCaps transform-with-restore, classRegistry
  registration; serialization via the extended global XPS_PROPS list (no toObject
  override — sidesteps fabric's over-generic typing; one list serves history, JSON
  export, persistence, and duplicate-clone); own 2-stop percentage-gradient -> canvas
  gradient conversion for effect render (no fabric internals); T-tool click -> Textbox in
  editing mode; full typography panel (family incl. uploaded group, weight, size mm,
  tracking ‰, line-height, align L/C/R/J, AA caps, effect + amount) + font upload/delete
  UI. Defects caught in self-review and fixed pre-ship: per-keystroke history flooding
  (content commits debounced 600 ms), faux-bold on family switch (weight clamped),
  stale xpsRawText after inline caps edits (re-synced on editing exit). Arc math verified
  headlessly (arch/valley orientation, symmetry, tangent mirroring, zero-guard).
  Known/documented: effect text ignores per-char styles + underline; justify disabled
  under effects; deleting an uploaded font falls back silently until re-upload;
  fromObject re-measures before late font loads (moot until INC-8 autosave).
  `tsc -b && vite build` zero errors.

- 2026-07-15 — INC-4: resumed from the INC-3 zip in a fresh chat (Node 22.22.2,
  clean `npm install` + `tsc -b && vite build` verified zero-error before touching
  code, per §6 resume protocol). Re-checked Fabric 7.4.0 `FabricImage` source
  (`Image.mjs`) directly: `setElement`/`_setWidthHeight` confirm `width`/`height`
  default to the source element's natural pixel size when not explicitly passed,
  and `getSrc()` returns `element.toDataURL()` for a canvas-backed element —
  both load-bearing for this increment's design (natural dims seed the
  DPI/crop baseline; canvas-backed SVG rasterization serializes through the
  existing history/JSON/idb pipeline with zero special-casing). Shipped:
  `XpsImage extends FabricImage` with `xpsSourceKind/Width/Height` own-props
  (added to the global `XPS_PROPS` list — history, duplicate-clone, and future
  JSON export/persistence inherit image support for free, same mechanism as
  INC-3 text) (`src/canvas/xpsImage.ts`); canvas-driven file picker
  (`pickImageFile`, mirrors the font-upload input's UX but owns its own
  transient `<input>` since it's triggered by a canvas click, not a panel
  button) accepting PNG/JPG/WebP/GIF/SVG; SVG-to-raster pipeline
  (`rasterizeSvg`, 2400 px long edge — browsers report a useless ~300×150
  natural size for SVGs without explicit width/height, so a fixed target
  resolution replaces trusting the source); placement sized to fit
  min(120 mm, 60% of the garment zone's shorter side), centred on the click
  point, never upscaled past native size (`createImageFromFile`); live DPI
  read (`computeDpi` — current crop-window pixel width over displayed mm
  width, so it responds correctly to both resize and crop) with a
  `--color-warning`-themed badge below 300 DPI (reused the token INC-2
  already reserved for this, rather than adding a new one); non-destructive
  mm-inset crop (`applyCropInsets`/`readCropInsetsMm`/`resetCrop` — always
  re-derived from the original uncropped source, never the current crop
  state, so repeated edits never drift and any inset can be dialled back to
  recover exactly that much source) exposed as four numeric fields rather
  than a drag-handle overlay (locked default, see §4 — chosen because it's
  arithmetically verifiable without a running browser to check drag
  geometry against). Wired the image tool's canvas-click handler
  (`interactions.ts`, replacing the INC-3 stub notice), `ImageSection` in
  the Properties panel (`Properties.tsx` + `.module.css` — DPI badge, crop
  inputs, reset button), and the Layers-panel glyph (`Layers.tsx`).
  No new dependencies — crop/DPI math and SVG rasterization use only the
  native Canvas 2D / Image APIs already available. Known/documented:
  SVG vector fidelity is not preserved past import (rasterized once, then
  behaves as a raster object — flagged as a candidate for a future true
  vector-passthrough feature, not silently dropped); no image filters
  (brightness/contrast/etc. — outside INC-4's stated acceptance criteria);
  crop is numeric-only, no drag-handle overlay yet. `tsc -b && vite build`
  zero errors.
- 2026-07-15 — INC-4 review pass: full verification against the build plan and
  MVP prompt. Confirmed against installed Fabric 7.4.0 source that
  `getSrc()` returns `element.toDataURL()` for canvas-backed elements, so
  SVG-rasterized images serialize/restore correctly through the JSON
  history; crop math verified reversible; flip confirmed flag-based (scale
  sign assumption holds). One defect fixed: `computeDpi` measured the X
  axis only, so a vertical single-axis stretch (mt/mb handles) could drop
  vertical DPI below 300 without warning — now computes per-axis DPI and
  reports the worst axis. Rebuilt clean.

- 2026-07-15 — INC-5: technique warnings shipped. New pure rule engine at
  `src/print/printCheck.ts` (TECHNIQUES const list + derived union — no
  enums, per TS6 `erasableSyntaxOnly`). Evaluation runs inside the
  commit/publish funnel (`refreshPrintCheck` in sync.ts, also covering
  undo/redo restore and history reset) plus a PrintCheck-panel effect for
  the store-only triggers (technique / garment colour / spot-colour limit),
  which never pass through the canvas funnel. Rules walk artwork
  recursively through groups carrying cumulative scale, so size rules see
  rendered mm, not pre-scale geometry. Rule set: DTG light-text-under-8mm
  vs garment luminance (WCAG relative luminance, 0.25 delta); screen-print
  distinct-colour count vs configurable limit (default 4, per locked spot-
  colour decision) with gradients counting their stops AND flagged for
  halftoning, placed images noted as process-print info; embroidery text
  <4mm cap height (0.7×fontSize proxy), gradients, strokes <1mm, thread-
  count info; sublimation polyester note + dark-garment warning
  (luminance <0.5). Warnings are advisory + dismissible; ids are
  `technique:rule:objectId|global`; dismissals are session-scoped and
  pruned per-technique so a fixed-then-re-broken condition re-warns while
  switching techniques doesn't resurface unrelated dismissals. UI: "Print
  check" panel section (technique radio grid, blurb, screen limit input,
  warning list with left-border severity accent using --color-warning) +
  StatusBar live warning-count badge. Unparseable colours are skipped, not
  guessed. `tsc -b && vite build` zero errors.

- 2026-07-15 — INC-6: mockup preview shipped. Resumed in a fresh chat
  (Node 24.18.0 installed for this session — the prior environment had none;
  the project's own `npm`/`tsc`/`vite` CLIs are blocked by local Group
  Policy on `.cmd`/`.bat`, worked around by invoking each tool's JS entry
  point directly via `node.exe`), `npm install` + `tsc -b && vite build`
  verified zero-error before touching code, per §6 resume protocol. Garment
  silhouettes are generated parametrically, not hand-authored art (same
  spirit as `canvas/shapes.ts`'s `ngonPoints`): a shared apparel-body builder
  (neckline notch, shoulder, sleeve — short for the tee, long for
  sweatshirt/long-sleeve/hoodie, plus a layered hood dome for the hoodie)
  covers four garments; tote and cap get their own simple builders (rounded-
  rect body + stroke-only strap loops; trapezoid front panel + arced brim).
  Every builder returns its own artboard size and where the print zone sits
  inside it — verified arithmetically for all six garments (zone rect fully
  inside its artboard, adequate padding) since this environment has no
  browser to screenshot against. Shipped: `src/features/mockup/garmentArt.ts`
  (silhouette geometry), `src/features/mockup/compositor.ts` (the single
  swap-in function the phased plan calls for — `compositeMockup` returns a
  flat path+placement descriptor today; a future warped-mockup API swaps
  this function's body for an async call returning a pre-rendered raster,
  with callers unchanged). Live artwork capture reuses the INC-1 export
  pipeline: extracted the shared viewport-reset/crop logic out of
  `exportPng.ts` into `src/canvas/renderZone.ts` (`captureZoneDataUrl`) so
  the 300 DPI export and the mockup's cheap on-screen capture (multiplier 1)
  share one verified code path instead of two copies. `MockupPreview.tsx`
  renders the composite as an inline `<svg>`; colour switching is a plain
  fill re-paint (no re-capture), while the artwork re-captures on garment
  change or after any canvas commit (tracked via the existing `layers` store
  slice, already republished by the commit funnel — no new pub/sub). Added
  `viewMode: 'design' | 'mockup'` to the studio store; `CanvasStage` stays
  mounted and hidden via CSS while in mockup view (so the Fabric instance
  and undo history survive the toggle) rather than unmounting. Toggle lives
  in the tool rail next to Grid/Fit (new `IconMockup`); fixed a pre-existing
  gap found while wiring it in — `.aux` buttons had no hover/active-state
  CSS at all, so Grid/Fit were already silently missing that feedback.
  `tsc -b && vite build` zero errors.

- 2026-07-15 — INC-7: export suite shipped. Re-verified jspdf 4.2.1,
  svg2pdf.js 2.7.0, jszip 3.10.1 against npm (unchanged since the 2026-06-12
  planning check). Moved `designName` from local App state into the studio
  store (needed by the dialog, the JSON project export, and the spec sheet
  alike) and generalised export scope beyond the whole zone: `renderZone.ts`
  gained `ExportScope` (zone/selection/single layer) with a shared
  `scopeCropBox` so every raster/vector format crops to the same box for a
  given scope, one bounding-box implementation instead of one per format.
  Shipped: `src/export/{filename,fontEmbed,exportSvg,exportJpg,exportPdf,
  pdfFonts,exportMockup,exportJson,specSheet,exportZip}.ts`. Notable finds
  while implementing:
  · Fabric's own `createSVGFontFacesMarkup()` only emits an external
  `url()` reference from a `config.fontPaths` table — not a real embed — so
  it doesn't survive the file leaving this origin. Built real embedding
  instead: `fontEmbed.ts` scans `document.styleSheets` for the actual
  loaded `@fontsource` `@font-face` rule per used family+weight+style (no
  hardcoded path table to drift), fetches its `url()`, and inlines it as a
  base64 data URI; uploaded fonts read directly from their idb blob.
  · Implemented the INC-3-deferred `toSVG` for effect text (arc/wave):
  `XpsText` now overrides `_toSVG`/`toSVG` to emit one `<text>` per glyph,
  positioned with `transform="translate(x y) rotate(deg)"` in the exact
  local coordinates `_render` already uses — vector output matches the
  canvas pixel-for-pixel. Gradient fill/stroke on effect text exports as a
  flat solid (the gradient's first stop) — a documented simplification,
  not a silent guess; straight text keeps fabric's native gradient SVG path.
  · svg2pdf.js renders `<text>` through jsPDF's own font system
  (`setFont`/`getFontList`), not by outlining glyphs (read from its
  source), and jsPDF's `addFont` requires real TTF/OTF bytes — it cannot
  parse WOFF/WOFF2, which is the only format the curated @fontsource
  packages ship (verified: no `.ttf` under any installed package's `files/`
  folder). So the PDF registers real fonts for TTF/OTF uploads only;
  curated fonts substitute the closest jsPDF standard font, with every
  substitution disclosed in an export notice and listed on the spec sheet.
  SVG/PNG/JPG/mockup exports are unaffected and always show the real
  typeface — only the PDF's text substitutes (`pdfFonts.ts`).
  · Bleed + crop marks apply to the whole-zone scope only (a
  selection/layer export has no meaningful trim line); the dialog disables
  those toggles outside zone scope rather than silently ignoring them.
  · True CMYK is not possible in-browser (locked scope boundary, not new):
  the PDF ships RGB with CMYK intent recorded in `setProperties` (subject/
  keywords) and repeated on the spec sheet.
  · jsPDF's bundle references `canvg` for an internal SVG-import path this
  app never calls (we use svg2pdf.js instead); Rolldown treats the
  unresolved import as a hard build error rather than a warning, fixed by
  externalizing `canvg` in `vite.config.ts` per Vite's own suggested fix
  rather than installing an unused dependency tree.
  ZIP bundle (`exportZip.ts`) reuses every format's non-downloading
  "build" function (added `buildMockupPngBlob`/`buildMockupJpgBlob` split
  out of the existing export functions) so there is one implementation per
  format, not one per download path and one per bundle path. Export panel
  (`ExportDialog.tsx`) covers scope (zone/selection/layer with a live
  mm+px@300DPI preview), PNG/JPG (background colour picker)/SVG/PDF
  (bleed+crop-mark toggles)/mockup PNG+JPG/project JSON (export and
  file-picker re-import) individually, plus the ZIP bundle with a
  format checklist; replaces the old single PNG-only Export button
  (removed the now-dead `StudioController.exportPng` field — the dialog
  calls export functions directly against `controller.canvas`).
  `tsc -b && vite build` zero errors (after the canvg externalization).

- 2026-07-15 — INC-8: persistence shipped. Re-verified idb 8.0.3 against
  npm (unchanged since INC-3). Per the locked rule ("INC-8 extends THIS
  database, never a second one"), the `xps-studio` idb connection moved out
  of `fontStore.ts` into a new shared `data/db.ts` (single `openDB` call,
  one upgrade callback keyed on `oldVersion`, bumped to version 2) — added
  `designs`, `versions` (indexed by `designId`), and `autosave` object
  stores alongside the existing `fonts` store; `fontStore.ts` now imports
  the shared connection instead of opening its own. Data model: `designs`
  = named saves (garment/colour/technique/limit + artwork + a 240px-long-
  edge thumbnail); `versions` = one entry per manual save, capped to the
  newest 20 per design (pruned on insert — unbounded history wasn't a DoD
  requirement, and this keeps storage bounded); `autosave` = a single
  `'current'` slot for reload-survival, deliberately separate from both —
  autosave never touches a saved design's own record or creates a version,
  only an explicit Save does that, so "the working draft since your last
  save" and "your last save" stay distinct concepts. Shipped:
  `src/data/{db,persistence}.ts` (pure CRUD, no Fabric knowledge),
  `src/canvas/{autosave,designs}.ts` (orchestration: builds records from
  the live canvas, or forks/deletes existing ones), `src/shell/SavesPanel.tsx`
  + `.module.css` (new PanelColumn section: Save/Save-as-new, a design list
  with thumbnails and Load/Duplicate/Delete — delete requires a second
  confirming click within 4s, no native `confirm()` dialog — and version
  history with Restore for the active design). Autosave debounces 1.5s off
  the existing commit/undo/redo funnel (`sync.ts` — `commit()` and the
  undo/redo `applyState()` both call `scheduleAutosave`), so no new
  mutation-tracking was needed. Added `restoreSnapshot` to `sync.ts` for
  version-restore: unlike undo/redo (which preserve stack position), it
  establishes a fresh undo baseline, reusing the same private `overlayList`
  `ensureOverlayOrder` already relies on. Boot-time restore reuses the same
  `StudioController.loadDesign` method the Saves panel's "Load" button
  calls (added to the controller, alongside `fit`): `CanvasStage` fires an
  async autosave check right after mount and, if a record exists, calls
  `loadDesign` — it races the default-garment mount harmlessly (a second,
  redundant overlay rebuild once the record arrives, functionally a no-op)
  rather than gating the first paint on an idb round-trip. Extracted the
  overlay-rebuild step the garment-change effect already had into a
  module-level `rebuildOverlaysFor` so `loadDesign` and that effect share
  one implementation instead of two copies. `tsc -b && vite build` zero
  errors.

- 2026-07-15 — INC-9: polish & docs shipped — the final increment; all ten
  are now complete. Verified eslint 10.7.0 + typescript-eslint 8.64.0 +
  eslint-plugin-react-hooks 7.1.1 + eslint-plugin-react-refresh 0.5.3 +
  @eslint/js 10.0.1 + globals 17.7.0 against npm (first check for these —
  ESLint was deferred to this increment by design). Added `eslint.config.js`
  (flat config: `@eslint/js` recommended + `typescript-eslint` recommended +
  `react-hooks`/`react-refresh`) and an `npm run lint` script.
  `eslint-plugin-react-hooks` 7.x's `recommended` preset includes the new
  compiler-era `set-state-in-effect` rule, which flagged 5 call sites; one
  (`Properties.tsx`'s `NumberField`, resyncing a local input draft when its
  `value` prop changes externally) had a clean fix — React's own documented
  "adjusting state when a prop changes" pattern (a render-phase conditional
  setState against a stored previous value, no effect at all) — applied
  instead of suppressing. The other four (`MockupPreview.tsx` mirroring
  live Fabric canvas pixels into state, `SavesPanel.tsx`'s two idb-fetch-
  on-mount/dependency-change effects, `StatusBar.tsx`'s notice-visibility-
  plus-auto-hide-timer effect) are genuine "synchronize with an external
  system" effects — exactly what effects are for, per React's own docs —
  where the rule's syntactic check can't see across an async boundary or
  distinguish canvas/timer subscription from derived state; each got a
  targeted `eslint-disable-next-line` with a one-line reason rather than a
  blanket rule-off. `npm run lint` is clean.
  Found and fixed one real, non-lint bug while doing the pass: Cmd/Ctrl+S
  (`useShortcuts.ts`) still showed the pre-INC-8 placeholder notice
  ("Saving arrives with persistence (INC-8)...") instead of actually
  saving, now that persistence exists — wired it to `saveActiveDesign`.
  Keyboard/a11y pass: the Export dialog (the app's one modal) had no
  Escape-to-close, no focus trap, and no focus management at all — added
  all three (trap Tab/Shift+Tab within the dialog, Escape closes and stops
  propagation before it reaches the global shortcut listener, focus moves
  in on open and restores to the triggering button on close). Also added
  `aria-label`s to the Export dialog's per-format "Download" buttons (all
  eight were previously unlabelled duplicates reading identically as
  "Download" to a screen reader) and the Saves panel's thumbnail-load
  button (previously named only by a `title` attribute, an unreliable
  accessible-name source). Reduced-motion audit: every CSS transition in
  every `.module.css` already routed through the `--motion-*` tokens
  (`styles/tokens.css`), which zero out under `prefers-reduced-motion:
  reduce` (`styles/global.css`); confirmed there is no JS-driven animation
  anywhere in `src/` (no `requestAnimationFrame`, no imperative
  `.animate()` calls) to separately audit — no code changes needed here,
  the existing token discipline from INC-0 already covered it. README
  rewritten as the final, standalone document: full feature list, exact
  version table, numbered replication steps (clone → install Node → `npm
  install` → dev/build/preview/lint → first run), complete file structure,
  a keyboard-shortcut table, the accessibility/motion summary above, and
  the font licensing note (9 OFL + Permanent Marker Apache-2.0).
  `tsc -b && vite build` zero errors; `npm run lint` zero errors.

## 8. Changelog (running)

- `[TICKET-011] chore(INC-9): ESLint (flat config) + npm run lint; keyboard/
  focus-trap + Escape for the Export dialog; aria-labels for previously-
  unlabelled Download/thumbnail buttons; Cmd/Ctrl+S now actually saves
  instead of showing the pre-INC-8 placeholder notice; reduced-motion audit
  (no code changes needed — already token-driven); final README (files
  touched: eslint.config.js (new), package.json, src/hooks/useShortcuts.ts,
  src/shell/{ExportDialog,Properties,MockupPreview,SavesPanel,StatusBar}.tsx,
  README.md, both plan docs)`
- `[TICKET-010] feat(INC-8): persistence — debounced idb autosave (reload-
  survival), named saves with thumbnails (save/load/duplicate/delete),
  version history per design with restore (files touched:
  src/data/{db,persistence}.ts (new), src/canvas/{autosave,designs}.ts (new),
  src/canvas/{fontStore,sync}.ts, src/shell/{SavesPanel,CanvasStage,
  PanelColumn}.tsx + SavesPanel.module.css (new), src/state/studio.ts,
  src/icons/Icons.tsx, README.md, both plan docs)`
- `[TICKET-009] feat(INC-7): export suite — PNG/JPG/SVG/PDF/mockup PNG+JPG/
  project JSON with scope selection (zone/selection/layer), embedded-font
  SVG export, effect-text vector SVG export, PDF bleed+crop marks+CMYK-
  intent metadata with honest font-substitution disclosure, ZIP bundle +
  generated spec sheet, JSON project re-import (files touched:
  src/export/{filename,fontEmbed,exportSvg,exportJpg,exportPdf,pdfFonts,
  exportMockup,exportJson,specSheet,exportZip}.ts (new),
  src/canvas/{renderZone,exportPng,xpsText,fontStore}.ts, src/state/studio.ts,
  src/shell/{TopBar,CanvasStage,ExportDialog}.tsx + ExportDialog.module.css
  (new), src/App.tsx, package.json, vite.config.ts, README.md, both plan docs)`
- `[TICKET-008] feat(INC-6): flat garment mockup preview — parametric
  silhouettes for all six garments (tee/hoodie/sweatshirt/long-sleeve/tote/
  cap), live textile-colour switching, compositor swap-in boundary for a
  future warp API, tool-rail view toggle (files touched:
  src/features/mockup/{garmentArt,compositor}.ts (new), src/canvas/renderZone.ts
  (new), src/canvas/exportPng.ts, src/shell/MockupPreview.tsx +.module.css (new),
  src/shell/{CanvasStage,ToolRail,PanelColumn}.tsx, src/shell/ToolRail.module.css,
  src/state/studio.ts, src/icons/Icons.tsx, src/App.tsx, README.md, both plan docs)`
- `[TICKET-007] feat(INC-5): print-technique warnings — advisory rule engine
  (DTG/screen/embroidery/sublimation), technique selector, configurable screen
  spot-colour limit, dismissible warning list, status-bar warning badge (files
  touched: src/print/printCheck.ts (new), src/shell/PrintCheck.tsx + .module.css
  (new), src/canvas/sync.ts, src/state/studio.ts, src/shell/{PanelColumn,
  StatusBar}.tsx, src/shell/StatusBar.module.css, README.md, both plan docs)`
- `[TICKET-006] fix(INC-4): worst-axis DPI — computeDpi now takes the minimum of
  the X/Y-axis DPI so single-axis stretches are caught (files touched:
  src/canvas/xpsImage.ts, X_print_studio_BUILD_PLAN.md)`
- `[TICKET-005] feat(INC-4): image upload (PNG/JPG/WebP/GIF/SVG) with SVG
  rasterization, live DPI badge with 300 DPI warning threshold, non-destructive
  mm-inset crop (files touched: src/canvas/xpsImage.ts (new), src/canvas/meta.ts,
  src/canvas/transform.ts, src/canvas/interactions.ts, src/state/studio.ts,
  src/shell/{Properties,Layers}.tsx + Properties.module.css, README.md, both
  plan docs)`

- `[TICKET-000] chore: project plan, verified dependency versions, continuation file (files touched: X_print_studio_BUILD_PLAN.md)`
- `[TICKET-001] feat(INC-0): scaffold + Atelier Dark design system + app shell (files touched: full project scaffold, src/styles/tokens.css, src/shell/*, src/state/tools.ts, src/icons/Icons.tsx)`
- `[TICKET-004] feat(INC-3): text tools — XpsText arc/wave effect class, curated 10-font catalogue, idb font persistence with FontFace boot re-registration, typography panel, font upload/delete (files touched: package.json, src/data/fonts.ts, src/canvas/{xpsText,fontStore}.ts, src/canvas/{meta,objects,interactions,transform}.ts, src/state/studio.ts, src/shell/{Properties,Layers}.tsx + css, src/main.tsx, README.md, both plan docs)`
- `[TICKET-003] feat(INC-2): tools & layers — snapshot undo/redo, mm transform panel, align/distribute, shapes with gradients + mm strokes, layers panel with group/ungroup, 5 mm snap grid, pan gestures, shortcuts (files touched: src/canvas/{meta,history,sync,shapes,transform,align,objects,interactions}.ts, src/canvas/overlays.ts, src/state/studio.ts, src/hooks/useShortcuts.ts, src/shell/{CanvasStage,Properties,Layers,PanelColumn,ToolRail,StatusBar,TopBar}.tsx + css, src/icons/Icons.tsx, src/App.tsx, README.md, both plan docs)`
- `[TICKET-002] feat(INC-1): Fabric 7 canvas, garment catalogue, mm↔px unit system, zone/bleed/safe/registration overlays, adaptive mm rulers, wheel zoom + fit, 300 DPI transparent PNG export (files touched: package.json, src/lib/units.ts, src/data/garments.ts, src/state/studio.ts, src/canvas/overlays.ts, src/canvas/exportPng.ts, src/shell/CanvasStage.tsx, src/shell/CanvasStage.module.css, src/shell/PanelColumn.tsx, src/shell/PanelColumn.module.css, src/shell/TopBar.tsx, src/shell/ToolRail.tsx, src/shell/StatusBar.tsx, README.md, both plan docs)`
