# [X] Print Studio — Phased Build & Execution Plan
> Companion to `X_print_studio_BUILD_PLAN.md`. This document groups the ten build increments into
> five executable phases, gives each increment a **Definition of Done**, and records exactly which
> runtime libraries enter the project at which step. The BUILD_PLAN remains the canonical
> continuation file; this is the execution roadmap that rides alongside it.
>
> Source plan: BUILD_PLAN v0.1 (2026-06-12). Roadmap drafted: 2026-06-30.

---

## 0. How to use this document

- Build proceeds **one increment per chat turn**. Each increment ends **runnable** and **complete-files-only** (no snippets), then ships as a downloadable ZIP plus an updated BUILD_PLAN.
- "Phase" is an organisational grouping for sequencing and reasoning. The unit of *delivery* is still the increment (INC-N).
- Do not start an increment until the previous one is complete and accepted.
- At the start of any increment that introduces a new library (see §4), **re-verify its version against npm first** — this is a standing project rule, not a one-time check.

## 1. What we're building (one paragraph)

A single-user, fully client-side design studio for the clothing brand `[X]`. The user creates print and text-print artwork on a millimetre-accurate canvas with live print-zone, DPI, and technique guidance; previews the design composited flat onto a chosen garment and colour; and exports print-ready files (PNG / JPG / SVG / PDF / mockup / JSON project / ZIP bundle with spec sheet). No storefront, no backend, no 3D.

## 2. Current status & resume point — **CONFIRM BEFORE BUILDING**

There is a discrepancy that must be settled before any code is written or re-written:

- **The plan file on hand (both the upload and the project copy) is BUILD_PLAN v0.1** — every increment unchecked, header reads *"Planning phase (no code written yet)."* By that file, the resume point is **INC-0**.
- **The project had in fact progressed past v0.1.** INC-0 — the Vite 8 / React 19 / TS 6 scaffold plus the *Atelier Dark* design system and the themed app shell (TopBar, ToolRail, CanvasStage, collapsible PanelColumn, StatusBar) — was built, compiled cleanly (`tsc -b && vite build`), and delivered as a ZIP, against a **newer BUILD_PLAN** that ticked INC-0 and added a `§4a` design-system section. By that history, the resume point is **INC-1**.

The v0.1 file in front of me looks like an **earlier snapshot** than the project's true state. Two clean ways forward:

- **(A) INC-0 is done → resume at INC-1.** I take the scaffold as shipped and build the Fabric canvas + garments + first 300 DPI PNG export next. *(If you still have the post-INC-0 ZIP and/or the newer BUILD_PLAN, attach them so I continue from the exact files rather than rebuilding the scaffold.)*
- **(B) Start clean from v0.1 → build INC-0.** I scaffold the project fresh from this plan, including the Atelier Dark token set and app shell.

**RESOLVED 2026-07-02 — option (A).** The post-INC-0 ZIP was recovered and verified (build passed as delivered); INC-1 was then built and shipped on top of those exact files. INC-4 through INC-9 have since shipped (this tracker had drifted behind the BUILD_PLAN's own log more than once — treat BUILD_PLAN §6–§8 as the source of truth for what's actually done). **All ten increments are now complete; there is no next resume point.**

## 3. Phase map (at a glance)

| Phase | Theme | Increments | Why it's grouped this way |
|------|-------|-----------|---------------------------|
| **P0** | Foundation & Canvas | INC-0, INC-1 | Stand the app up and de-risk the single hardest pipeline — mm → px → 300 DPI export — on day one. |
| **P1** | Creative Tools | INC-2, INC-3, INC-4 | The actual design surface: objects & layers, text (priority), images with DPI honesty. |
| **P2** | Print Intelligence & Preview | INC-5, INC-6 | The "studio" value-add: technique warnings and garment mockup. |
| **P3** | Production Output | INC-7 | Make it shippable to a real printer: the full export suite. |
| **P4** | Durability & Handoff | INC-8, INC-9 | Make it a real, reproducible app: persistence, a11y, docs. |

## 4. Phases in detail

> Format per increment — **Goal** · **Deliverables** · **New libraries** · **Definition of Done (DoD)**.

### Phase 0 — Foundation & Canvas

**INC-0 — Scaffold**
- **Goal:** A runnable, themed, empty shell.
- **Deliverables:** Vite 8 + React 19 + TS 6 project and folder structure; `src/styles/tokens.css` (Atelier Dark, exactly as specced); app shell — left tool rail / centre canvas stage / right panel column, plus top bar and status bar; UI/shell fonts wired (self-hosted via `@fontsource`); `prefers-reduced-motion` baseline.
- **New libraries:** `react`, `react-dom`, `vite`, `typescript`, `@fontsource/*` (shell faces only). **No** Fabric / Zustand / jsPDF / JSZip / idb yet.
- **DoD:** `tsc -b && vite build` passes with zero errors; `vite dev` shows the empty themed shell; design-name field is editable; mm chip visible; Export / Grid / Fit controls present but inert.

**INC-1 — Canvas core + garments + first PNG export**
- **Goal:** A live Fabric canvas showing a real garment, with the riskiest pipeline (300 DPI PNG) validated early.
- **Deliverables:** Fabric 7 canvas mounted in the canvas stage; `src/data/garments.ts` (T-shirt, hoodie, sweatshirt, long-sleeve, tote, cap — front print zones in **mm** + textile colour palettes); mm↔px @300 DPI utility; print-zone / bleed / safe-zone overlays; mm rulers; **transparent PNG export at 300 DPI**.
- **New libraries:** `fabric` (canvas engine), `zustand` (garment / technique / panel state).
- **DoD:** pick a garment → its print zone renders at the correct mm dimensions; export produces a transparent PNG at the correct **pixel** size for that zone at 300 DPI.

### Phase 1 — Creative Tools

**INC-2 — Tools & layers**
- **Goal:** Manipulate objects with print-grade precision on a real layer stack.
- **Deliverables:** select/transform with mm-precise X / Y / W / H inputs, flip, aspect-lock; align & distribute (to selection or zone); 5 mm snap-grid toggle; shapes (rectangle / ellipse / polygon / line; solid + gradient fill; mm stroke); layers panel (reorder / rename / lock / hide / group / duplicate / delete); undo–redo stack; shortcuts (V, T, ⌘Z / ⇧⌘Z, ⌘S, Delete).
- **New libraries:** none (Fabric + Zustand cover it).
- **DoD:** create, select, and transform shapes via numeric mm inputs; reorder and lock layers; undo/redo holds across operations; snap grid toggles on/off.

**INC-3 — Text tools (priority)**
- **Goal:** Full text design with embedded *and* custom fonts that survive export.
- **Deliverables:** curated 10-font list + TTF/OTF upload (native `FontFace` API, blob persisted in IndexedDB); size / weight / letter-spacing / line-height / align / all-caps; solid + gradient fill; stroke; arc / curve text; basic warp; multiple independent text layers.
- **New libraries:** `idb` **enters here** (to persist uploaded-font blobs), even though its main role is INC-8. *(Alternative if we want to keep idb out until P4: hold custom fonts in-memory for the session only — decide at the top of this increment.)*
- **DoD:** type multiple text layers; apply curated and uploaded fonts; arc/warp renders correctly; an uploaded font survives a page reload and re-registers via `FontFace`.

**INC-4 — Images + DPI check**
- **Goal:** Place raster and vector art with honest, live DPI feedback.
- **Deliverables:** PNG / JPG / SVG upload; crop & scale; transparency preserved; a live DPI badge per raster object; a `--warning` state when effective DPI drops below 300 at the placed size.
- **New libraries:** none.
- **DoD:** place an image, scale it, and watch the DPI badge update live; the badge turns to its warning state when effective DPI < 300 at placed size.

### Phase 2 — Print Intelligence & Preview

**INC-5 — Technique warnings**
- **Goal:** Print-method intelligence that *warns, never blocks*.
- **Deliverables:** technique selector (DTG / screen-print / embroidery / sublimation); rule engine — thin light text on dark; colour-count vs configured limit; text under ~4 mm; gradients / fine detail vs thread count; polyester note. All advisory.
- **New libraries:** none.
- **DoD:** switching technique surfaces the relevant warnings for the current design; warnings are advisory and dismissible and never prevent an action or export.

**INC-6 — Mockup preview**
- **Goal:** See the design on the garment (flat composite).
- **Deliverables:** flat composite of the canvas artwork onto the garment SVG at the correct zone position and scale; live garment-colour switching; a clearly marked single-function API swap-in point at `src/features/mockup/compositor.ts`.
- **New libraries:** none.
- **DoD:** toggle mockup view → artwork appears correctly placed and scaled on the selected garment and colour; the compositor boundary is one documented function ready for a future warp-API swap.

### Phase 3 — Production Output

**INC-7 — Export suite**
- **Goal:** Printer-ready output in every required format.
- **Deliverables:** export panel with format / resolution choice + a dimension & DPI preview; **PNG** (transparent, 300 DPI); **JPG** (chosen background); **SVG** (vector, embedded fonts); **PDF** (correct physical size, optional bleed + crop marks, CMYK *intent* note in metadata); **mockup** PNG/JPG; **JSON project** (re-importable, with custom props); selection-only and per-layer export; **ZIP bundle** + generated spec sheet; filename pattern `[X]_{design-name}_{format}`, sanitised.
- **New libraries:** `jspdf`, `svg2pdf.js` (vector-text PDF), `jszip` (bundle).
- **DoD:** each format exports at the correct physical size; the PDF carries bleed/crop marks and CMYK-intent metadata; an exported JSON re-imports faithfully; the ZIP contains every asset plus the spec sheet; all filenames sanitise correctly.

### Phase 4 — Durability & Handoff

**INC-8 — Persistence**
- **Goal:** Real save/load with version history.
- **Deliverables:** debounced IndexedDB autosave; manual named saves; a design list with thumbnails (load / duplicate / delete); a version snapshot per manual save, with restore.
- **New libraries:** `idb` (extended here if already introduced at INC-3; otherwise it enters now).
- **DoD:** autosave persists across reload; named saves appear in the list with thumbnails; snapshots restore prior versions correctly.

**INC-9 — Polish & docs**
- **Goal:** Ship-quality and replicable.
- **Deliverables:** keyboard-accessibility pass; reduced-motion audit; README (stack + exact versions, folder structure, setup, numbered replication steps); **ESLint** + config (deferred to here by design to keep earlier increments lean); finalised build log + changelog.
- **New libraries:** `eslint` + chosen config (dev-only).
- **DoD:** a11y and reduced-motion verified; ESLint passes clean; README is complete and reproducible from scratch; build log + changelog finalised.

## 5. Library versions (carry-forward from BUILD_PLAN §2)

| Library | Version | Enters at | Role |
|---|---|---|---|
| react / react-dom | 19.2.7 | INC-0 | UI |
| vite | 8.0.16 | INC-0 | Build / dev server |
| typescript | 6.x | INC-0 | Types (`tsc -b`, project refs) |
| @fontsource/* | — | INC-0 | Self-hosted UI + design fonts |
| fabric | 7.4.0 | INC-1 | Canvas engine (v7 ESM / promise idioms only) |
| zustand | 5.0.14 | INC-1 | App state |
| idb | 8.0.3 | INC-3 (fonts) / INC-8 | IndexedDB persistence |
| jspdf | 4.2.1 | INC-7 | PDF container |
| svg2pdf.js | 2.7.0 | INC-7 | SVG → vector PDF |
| jszip | 3.10.1 | INC-7 | ZIP bundle |
| eslint | latest | INC-9 | Lint (deferred) |
| opentype.js | 2.0.0 | OPTIONAL | Only if "outline text to paths" export is approved |

**Standing rule:** re-verify each library's version against npm at the start of the increment that introduces it. The table above was verified 2026-06-12; treat as provisional until re-checked at build time.

## 6. Honest scope boundaries (do not silently exceed)

- **True CMYK PDF is not possible in-browser** (jsPDF / pdf-lib are RGB). MVP ships RGB PDF at correct physical size with bleed/crop marks and **CMYK intent recorded in metadata + spec sheet**. Real CMYK separation is a print-shop / future server step.
- **Realistic warped mockups are out of scope.** MVP is a flat composite. The single swap-in boundary for a future warp API is `src/features/mockup/compositor.ts`.

## 7. Open decisions & defaults (carry-forward from BUILD_PLAN §4)

1. **Garment imagery** — default: built-in recolourable flat vector SVG garments (no licensing risk). User-photo garments supported later via the same `garments.ts` shape.
2. **SVG/PDF text** — default: text stays as editable `<text>` with `@font-face` embedding. Optional `opentype.js` toggle to outline text → paths (what most shops prefer; loses editability). Deferred past MVP.
3. **Units** — default: **mm** everywhere; inch shown as a read-only secondary value in the spec sheet.
4. **Curated fonts (10, streetwear-bold → minimal):** Archivo Black, Anton, Bebas Neue, Space Grotesk, Inter, DM Sans, IBM Plex Mono, Playfair Display, Permanent Marker, Unbounded. Self-hosted in `/public/fonts`. Licensing: Permanent Marker is Apache-2.0; the rest are OFL. *(Shell/UI typography uses a clean sans for chrome and a mono face for measurement readouts.)*
5. **Screen-print colour limit** — configurable; initial value **4** spot colours.

## 8. Per-increment delivery & resume protocol

**Every increment ships:** (a) a downloadable project ZIP, (b) an updated BUILD_PLAN with the increment's checkbox ticked and §7/§8 build-log + changelog entries appended, (c) confirmation the build passed (`tsc -b && vite build`, zero errors).

**To resume after a credit-limit / new chat:**
1. Upload the original prompt, the **latest** BUILD_PLAN, and the most recent project ZIP.
2. Say: "Resume [X] Print Studio at INC-N" (N = first unticked increment).
3. Claude re-reads the plan, inspects the delivered code, and continues with complete files only.

## 9. Risk register

| Risk | Mitigation |
|---|---|
| CMYK impossible in-browser | RGB + CMYK-intent metadata; conversion at print shop (§6). |
| Warped mockup out of scope | Flat composite + single `compositor.ts` swap-in point (§6). |
| Fabric v7 ≠ v5 tutorials | Use v7 ESM / promise APIs only; scaffold a throwaway reference project when adopting a new major version before writing production code. |
| TS 6 constraints | `erasableSyntaxOnly`: no enums / namespaces — use union types + const objects. `verbatimModuleSyntax`: `import type` for type-only imports. `noUncheckedSideEffectImports` was dropped (don't re-add; it false-flags CSS side-effect imports). |
| Font embedding in SVG/PDF | Self-host via `@fontsource`; embed with `@font-face`; opentype.js outline-to-path deferred. |
| Library version drift | Re-verify versions at the start of each library-introducing increment (§5). |
| Credit-limit reset mid-build | Per-increment ZIP + updated BUILD_PLAN; strict resume protocol (§8). |
| Stale/duplicate plan files | Treat the **newest** BUILD_PLAN as canonical; settle the §2 status question before building. |

## 10. Progress tracker

> Mirror this back into BUILD_PLAN §6 as increments complete.

- [x] **INC-0** Scaffold *(§2 resolved: option A — verified from delivered ZIP)*
- [x] **INC-1** Canvas core + garments + first 300 DPI PNG export *(shipped 2026-07-02; export px verified for all six zones)*
- [x] **INC-2** Tools & layers *(shipped 2026-07-02; DoD verified: mm inputs, layer reorder/lock, undo/redo across ops, snap toggle)*
- [x] **INC-3** Text tools *(shipped 2026-07-02; idb entered here per §4 alternative decision — DoD reload-survival required it)*
- [x] **INC-4** Images + DPI check *(shipped 2026-07-15)*
- [x] **INC-5** Technique warnings *(shipped 2026-07-15)*
- [x] **INC-6** Mockup preview *(shipped 2026-07-15)*
- [x] **INC-7** Export suite *(shipped 2026-07-15)*
- [x] **INC-8** Persistence *(shipped 2026-07-15)*
- [x] **INC-9** Polish & docs *(shipped 2026-07-15 — all ten increments complete)*
