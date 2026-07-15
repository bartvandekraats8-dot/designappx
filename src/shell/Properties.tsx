import { useState, type ReactNode } from 'react'

import { getGarment } from '../data/garments'
import { useStudio, type FillDesc, type ShapeKind } from '../state/studio'
import { applyBoxPatch, flipActive } from '../canvas/transform'
import { alignSelection, distributeSelection, type AlignOp, type AlignTarget } from '../canvas/align'
import { buildFill, SHAPE_LABELS } from '../canvas/shapes'
import { XpsText, setTextProps, type TextPatch } from '../canvas/xpsText'
import { XpsImage, applyCropInsets, resetCrop, type CropInsetsMm } from '../canvas/xpsImage'
import { addFontFromFile, removeFont } from '../canvas/fontStore'
import { CURATED_FONTS, weightsFor } from '../data/fonts'
import { commit, publishSelection } from '../canvas/sync'
import { mmToWork } from '../lib/units'
import {
  IconAlignBottom,
  IconAlignCenterH,
  IconAlignLeft,
  IconAlignMiddle,
  IconAlignRight,
  IconAlignTop,
  IconDistributeH,
  IconDistributeV,
  IconFlipH,
  IconFlipV,
  IconLinked,
  IconUnlinked,
} from '../icons/Icons'
import { IconTrash } from '../icons/Icons'
import styles from './Properties.module.css'

/*
 * Properties panel — INC-2.
 *
 * Three states: shape-tool defaults (no selection, shape tool active),
 * an idle hint, or the full inspector for the current selection:
 * mm-precise X/Y/W/H with aspect lock, rotation, flips, arrange
 * (align/distribute vs selection or zone), and appearance
 * (solid/gradient fill + mm stroke) for single non-group objects.
 */

const SHAPE_KINDS: readonly ShapeKind[] = ['rect', 'ellipse', 'polygon', 'line']

interface NumberFieldProps {
  label: string
  value: number
  step?: number
  min?: number
  disabled?: boolean
  suffix: string
  onCommit: (value: number) => void
}

function NumberField({ label, value, step = 0.1, min, disabled, suffix, onCommit }: NumberFieldProps) {
  const formatted = () => String(Math.round(value * 10) / 10)
  const [draft, setDraft] = useState(formatted)
  // Re-sync the draft when `value` changes from outside (a new selection,
  // a drag) without losing in-progress typing on every keystroke — the
  // render-phase "adjusting state when a prop changes" pattern, not an
  // effect: https://react.dev/learn/you-might-not-need-an-effect
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setDraft(formatted())
  }
  const submit = () => {
    const parsed = Number.parseFloat(draft.replace(',', '.'))
    if (Number.isFinite(parsed)) onCommit(min !== undefined ? Math.max(min, parsed) : parsed)
    else setDraft(formatted())
  }
  return (
    <label className={styles.field} data-disabled={disabled}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        className={styles.fieldInput}
        type="number"
        step={step}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={submit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
        }}
      />
      <span className={styles.fieldUnit}>{suffix}</span>
    </label>
  )
}

function IconButton({
  title,
  onClick,
  active,
  disabled,
  children,
}: {
  title: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={styles.iconBtn}
      data-active={active}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function ShapeToolDefaults() {
  const shapeKind = useStudio((state) => state.shapeKind)
  const polygonSides = useStudio((state) => state.polygonSides)
  const setShapeKind = useStudio((state) => state.setShapeKind)
  const setPolygonSides = useStudio((state) => state.setPolygonSides)
  return (
    <div className={styles.stack}>
      <span className={styles.blockTitle}>Shape tool</span>
      <div className={styles.segment} role="radiogroup" aria-label="Shape">
        {SHAPE_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={kind === shapeKind}
            data-active={kind === shapeKind}
            className={styles.segmentBtn}
            onClick={() => setShapeKind(kind)}
          >
            {SHAPE_LABELS[kind]}
          </button>
        ))}
      </div>
      {shapeKind === 'polygon' ? (
        <NumberField
          label="Sides"
          value={polygonSides}
          step={1}
          min={3}
          suffix=""
          onCommit={(value) => setPolygonSides(value)}
        />
      ) : null}
      <p className={styles.hint}>
        Drag on the canvas to draw · hold Shift to constrain · a plain click
        drops a 40 mm shape.
      </p>
    </div>
  )
}

const KIND_LABELS: Record<string, string> = {
  xpstext: 'Text',
  xpsimage: 'Image',
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  polygon: 'Polygon',
  line: 'Line',
  group: 'Group',
}

interface TextSectionProps {
  canvas: import('fabric').Canvas
  text: NonNullable<import('../state/studio').SelectionSnapshot['text']>
}

function TextSection({ canvas, text }: TextSectionProps) {
  const customFonts = useStudio((state) => state.customFonts)
  const setNotice = useStudio((state) => state.setNotice)

  const apply = (patch: TextPatch) => {
    const active = canvas.getActiveObject()
    if (active instanceof XpsText) void setTextProps(canvas, active, patch)
  }

  const weights = weightsFor(text.fontFamily, customFonts)
  const effectActive = text.effect !== 'none'

  return (
    <div className={styles.stack}>
      <span className={styles.blockTitle}>Text</span>
      <textarea
        className={styles.textContent}
        rows={2}
        value={text.content}
        aria-label="Text content"
        onChange={(event) => apply({ content: event.target.value })}
      />
      <div className={styles.row}>
        <select
          className={styles.select}
          aria-label="Font family"
          value={text.fontFamily}
          onChange={(event) => {
            const family = event.target.value
            const available = weightsFor(family, customFonts)
            /* Clamp weight so a single-weight face never faux-bolds. */
            apply({
              fontFamily: family,
              fontWeight: available.includes(text.fontWeight)
                ? text.fontWeight
                : available[0],
            })
          }}
        >
          <optgroup label="Curated">
            {CURATED_FONTS.map((font) => (
              <option key={font.family} value={font.family}>
                {font.family}
              </option>
            ))}
          </optgroup>
          {customFonts.length > 0 ? (
            <optgroup label="Uploaded">
              {customFonts.map((family) => (
                <option key={family} value={family}>
                  {family}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
        <select
          className={styles.selectNarrow}
          aria-label="Font weight"
          value={text.fontWeight}
          disabled={weights.length < 2}
          onChange={(event) => apply({ fontWeight: Number(event.target.value) })}
        >
          {weights.map((weight) => (
            <option key={weight} value={weight}>
              {weight === 700 ? 'Bold' : 'Regular'}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.grid2}>
        <NumberField label="Size" value={text.sizeMm} min={1} suffix="mm" onCommit={(v) => apply({ sizeMm: v })} />
        <NumberField label="Trk" value={text.tracking} step={5} suffix="‰" onCommit={(v) => apply({ tracking: v })} />
        <NumberField label="Line" value={text.lineHeight} step={0.05} min={0.5} suffix="×" onCommit={(v) => apply({ lineHeight: v })} />
        <div className={styles.rowIcons}>
          <button
            type="button"
            className={styles.capsBtn}
            data-active={text.allCaps}
            aria-pressed={text.allCaps}
            title="All caps (keeps what you typed)"
            onClick={() => apply({ allCaps: !text.allCaps })}
          >
            AA
          </button>
        </div>
      </div>
      <div className={styles.segment} role="radiogroup" aria-label="Alignment">
        {(['left', 'center', 'right', 'justify'] as const).map((align) => (
          <button
            key={align}
            type="button"
            role="radio"
            aria-checked={text.align === align}
            data-active={text.align === align}
            disabled={align === 'justify' && effectActive}
            className={styles.segmentBtn}
            onClick={() => apply({ align })}
          >
            {align === 'left' ? 'L' : align === 'center' ? 'C' : align === 'right' ? 'R' : 'J'}
          </button>
        ))}
      </div>

      <span className={styles.blockTitle}>Effect</span>
      <div className={styles.row}>
        <div className={styles.segment} role="radiogroup" aria-label="Text effect">
          {(['none', 'arc', 'wave'] as const).map((effect) => (
            <button
              key={effect}
              type="button"
              role="radio"
              aria-checked={text.effect === effect}
              data-active={text.effect === effect}
              className={styles.segmentBtn}
              onClick={() => apply({ effect })}
            >
              {effect === 'none' ? 'None' : effect === 'arc' ? 'Arc' : 'Wave'}
            </button>
          ))}
        </div>
        {effectActive ? (
          <NumberField
            label="Amt"
            value={text.effectAmount}
            step={5}
            suffix="%"
            onCommit={(v) => apply({ effectAmount: v })}
          />
        ) : null}
      </div>
      {effectActive ? (
        <p className={styles.hint}>
          Effect text is edited here (inline editing is for straight text);
          content flows as a single line. Arc: negative bends down.
        </p>
      ) : null}

      <span className={styles.blockTitle}>Fonts</span>
      <label className={styles.uploadBtn}>
        Upload font (TTF / OTF)
        <input
          type="file"
          accept=".ttf,.otf,font/ttf,font/otf"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            void addFontFromFile(file).then((family) => {
              setNotice(`Font "${family}" added — stored in this browser.`)
              apply({ fontFamily: family })
            })
          }}
        />
      </label>
      {customFonts.length > 0 ? (
        <ul className={styles.fontList}>
          {customFonts.map((family) => (
            <li key={family} className={styles.fontRow}>
              <span className={styles.fontName} style={{ fontFamily: `"${family}"` }}>
                {family}
              </span>
              <button
                type="button"
                className={styles.iconBtn}
                title={`Remove ${family} (layers using it fall back until re-uploaded)`}
                aria-label={`Remove font ${family}`}
                onClick={() => void removeFont(family)}
              >
                <IconTrash />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

interface ImageSectionProps {
  canvas: import('fabric').Canvas
  image: NonNullable<import('../state/studio').SelectionSnapshot['image']>
}

function ImageSection({ canvas, image }: ImageSectionProps) {
  const insets = image.cropInsetsMm

  const applyCrop = (patch: Partial<CropInsetsMm>) => {
    const active = canvas.getActiveObject()
    if (!(active instanceof XpsImage)) return
    applyCropInsets(active, { ...insets, ...patch })
    active.setCoords()
    canvas.requestRenderAll()
    commit(canvas)
    publishSelection(canvas)
  }

  const doResetCrop = () => {
    const active = canvas.getActiveObject()
    if (!(active instanceof XpsImage)) return
    resetCrop(active)
    active.setCoords()
    canvas.requestRenderAll()
    commit(canvas)
    publishSelection(canvas)
  }

  return (
    <div className={styles.stack}>
      <span className={styles.blockTitle}>Image</span>
      <div className={styles.row}>
        <span className={styles.hint}>
          {image.kind === 'svg' ? 'Vector source, rasterized on import' : 'Raster'} ·{' '}
          {image.placedWidthPx} × {image.placedHeightPx} px
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.fieldLabel}>DPI at placed size</span>
        <span className={styles.dpiBadge} data-warning={image.belowThreshold}>
          {image.dpi === null ? 'Vector' : Math.round(image.dpi)}
        </span>
      </div>
      {image.belowThreshold ? (
        <p className={styles.hint}>
          Below 300 DPI at this size — print may look soft. Scale down, or use a
          higher-resolution source.
        </p>
      ) : null}

      <span className={styles.blockTitle}>Crop (mm, from source edges)</span>
      <div className={styles.grid2}>
        <NumberField label="Top" value={insets.top} min={0} suffix="mm" onCommit={(v) => applyCrop({ top: v })} />
        <NumberField label="Right" value={insets.right} min={0} suffix="mm" onCommit={(v) => applyCrop({ right: v })} />
        <NumberField label="Bottom" value={insets.bottom} min={0} suffix="mm" onCommit={(v) => applyCrop({ bottom: v })} />
        <NumberField label="Left" value={insets.left} min={0} suffix="mm" onCommit={(v) => applyCrop({ left: v })} />
      </div>
      <button type="button" className={styles.uploadBtn} onClick={doResetCrop}>
        Reset crop
      </button>
    </div>
  )
}

export function Properties() {
  const selection = useStudio((state) => state.selection)
  const activeTool = useStudio((state) => state.activeTool)
  const controller = useStudio((state) => state.controller)
  const garmentId = useStudio((state) => state.garmentId)
  const [aspectLocked, setAspectLocked] = useState(true)
  const [alignTarget, setAlignTarget] = useState<AlignTarget>('zone')

  if (!selection) {
    return activeTool === 'shape' ? (
      <ShapeToolDefaults />
    ) : (
      <p className={styles.hint}>
        Select an object to edit its position, size, and appearance — or draw
        one with the Shape tool (S).
      </p>
    )
  }
  if (!controller) return null
  const canvas = controller.canvas
  const garment = getGarment(garmentId)
  const ratio = selection.hMm > 0.01 ? selection.wMm / selection.hMm : 1

  const patch = (p: Parameters<typeof applyBoxPatch>[1]) => {
    applyBoxPatch(canvas, p)
    commit(canvas)
  }

  const align = (op: AlignOp) => {
    if (alignSelection(canvas, garment, op, effectiveTarget)) commit(canvas)
  }
  const distribute = (axis: 'h' | 'v') => {
    if (distributeSelection(canvas, garment, axis, effectiveTarget)) commit(canvas)
  }
  // Selection-target ops need ≥2 objects; fall back to zone for singles.
  const effectiveTarget: AlignTarget =
    selection.count < 2 ? 'zone' : alignTarget

  const setFill = (desc: FillDesc) => {
    const active = canvas.getActiveObject()
    if (!active) return
    active.set({ fill: buildFill(desc) })
    canvas.requestRenderAll()
    commit(canvas)
  }
  const setStroke = (color: string | null, mm: number) => {
    const active = canvas.getActiveObject()
    if (!active) return
    if (selection.kind === 'line') {
      active.set({ stroke: color ?? '#1C1B19', strokeWidth: mmToWork(Math.max(0.1, mm)) })
    } else if (color === null || mm <= 0) {
      active.set({ strokeWidth: 0 })
    } else {
      active.set({ stroke: color, strokeWidth: mmToWork(mm) })
    }
    active.setCoords()
    canvas.requestRenderAll()
    commit(canvas)
    publishSelection(canvas)
  }

  const fill = selection.fill

  return (
    <div className={styles.stack}>
      <div className={styles.blockHead}>
        <span className={styles.blockTitle}>
          {selection.count > 1
            ? `${selection.count} objects`
            : (KIND_LABELS[selection.kind] ??
              selection.kind.charAt(0).toUpperCase() + selection.kind.slice(1))}
        </span>
        {selection.locked ? <span className={styles.lockedTag}>locked</span> : null}
      </div>

      {selection.text ? (
        <TextSection canvas={canvas} text={selection.text} />
      ) : null}

      {selection.image ? (
        <ImageSection canvas={canvas} image={selection.image} />
      ) : null}

      {/* Position & size */}
      <div className={styles.grid2}>
        <NumberField label="X" value={selection.xMm} suffix="mm" onCommit={(v) => patch({ xMm: v })} />
        <NumberField label="Y" value={selection.yMm} suffix="mm" onCommit={(v) => patch({ yMm: v })} />
        <NumberField
          label="W"
          value={selection.wMm}
          suffix="mm"
          min={0.1}
          disabled={!selection.canResizeW}
          onCommit={(v) =>
            patch(aspectLocked && selection.canResizeH ? { wMm: v, hMm: v / ratio } : { wMm: v })
          }
        />
        <NumberField
          label="H"
          value={selection.hMm}
          suffix="mm"
          min={0.1}
          disabled={!selection.canResizeH}
          onCommit={(v) =>
            patch(aspectLocked && selection.canResizeW ? { hMm: v, wMm: v * ratio } : { hMm: v })
          }
        />
      </div>
      <div className={styles.row}>
        <NumberField label="∠" value={selection.angle} step={1} suffix="°" onCommit={(v) => patch({ angle: v })} />
        <div className={styles.rowIcons}>
          <IconButton
            title={aspectLocked ? 'Aspect locked — W/H scale together' : 'Aspect unlocked'}
            active={aspectLocked}
            onClick={() => setAspectLocked((locked) => !locked)}
          >
            {aspectLocked ? <IconLinked /> : <IconUnlinked />}
          </IconButton>
          <IconButton title="Flip horizontal" onClick={() => { flipActive(canvas, 'x'); commit(canvas) }}>
            <IconFlipH />
          </IconButton>
          <IconButton title="Flip vertical" onClick={() => { flipActive(canvas, 'y'); commit(canvas) }}>
            <IconFlipV />
          </IconButton>
        </div>
      </div>

      {/* Arrange */}
      <div className={styles.blockHead}>
        <span className={styles.blockTitle}>Arrange</span>
        <div className={styles.segmentMini} role="radiogroup" aria-label="Align target">
          {(['zone', 'selection'] as const).map((target) => (
            <button
              key={target}
              type="button"
              role="radio"
              aria-checked={effectiveTarget === target}
              data-active={effectiveTarget === target}
              disabled={target === 'selection' && selection.count < 2}
              className={styles.segmentBtn}
              onClick={() => setAlignTarget(target)}
            >
              {target === 'zone' ? 'Zone' : 'Selection'}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.rowIcons}>
        <IconButton title="Align left" onClick={() => align('left')}><IconAlignLeft /></IconButton>
        <IconButton title="Align horizontal centre" onClick={() => align('centerH')}><IconAlignCenterH /></IconButton>
        <IconButton title="Align right" onClick={() => align('right')}><IconAlignRight /></IconButton>
        <IconButton title="Align top" onClick={() => align('top')}><IconAlignTop /></IconButton>
        <IconButton title="Align middle" onClick={() => align('middle')}><IconAlignMiddle /></IconButton>
        <IconButton title="Align bottom" onClick={() => align('bottom')}><IconAlignBottom /></IconButton>
        <IconButton
          title="Distribute horizontally"
          disabled={selection.count < 2}
          onClick={() => distribute('h')}
        >
          <IconDistributeH />
        </IconButton>
        <IconButton
          title="Distribute vertically"
          disabled={selection.count < 2}
          onClick={() => distribute('v')}
        >
          <IconDistributeV />
        </IconButton>
      </div>

      {/* Appearance — single non-group objects */}
      {fill !== null || selection.kind === 'line' ? (
        <>
          <span className={styles.blockTitle}>Appearance</span>
          {fill !== null ? (
            <div className={styles.stack}>
              <div className={styles.segment} role="radiogroup" aria-label="Fill mode">
                {(['solid', 'linear', 'radial'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={fill.mode === mode}
                    data-active={fill.mode === mode}
                    className={styles.segmentBtn}
                    onClick={() => {
                      if (mode === fill.mode) return
                      const base = fill.mode === 'solid' ? fill.color : fill.from
                      if (mode === 'solid') setFill({ mode, color: base })
                      else if (mode === 'linear')
                        setFill({ mode, from: base, to: '#F5358A', angle: 0 })
                      else setFill({ mode, from: base, to: '#F5358A' })
                    }}
                  >
                    {mode === 'solid' ? 'Solid' : mode === 'linear' ? 'Linear' : 'Radial'}
                  </button>
                ))}
              </div>
              {fill.mode === 'solid' ? (
                <label className={styles.colorRow}>
                  <span className={styles.fieldLabel}>Colour</span>
                  <input
                    type="color"
                    className={styles.color}
                    value={fill.color.slice(0, 7)}
                    onChange={(event) => setFill({ mode: 'solid', color: event.target.value })}
                  />
                </label>
              ) : (
                <div className={styles.row}>
                  <label className={styles.colorRow}>
                    <span className={styles.fieldLabel}>From</span>
                    <input
                      type="color"
                      className={styles.color}
                      value={fill.from.slice(0, 7)}
                      onChange={(event) => setFill({ ...fill, from: event.target.value })}
                    />
                  </label>
                  <label className={styles.colorRow}>
                    <span className={styles.fieldLabel}>To</span>
                    <input
                      type="color"
                      className={styles.color}
                      value={fill.to.slice(0, 7)}
                      onChange={(event) => setFill({ ...fill, to: event.target.value })}
                    />
                  </label>
                  {fill.mode === 'linear' ? (
                    <NumberField
                      label="∠"
                      value={fill.angle}
                      step={1}
                      suffix="°"
                      onCommit={(v) => setFill({ ...fill, angle: v })}
                    />
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
          <div className={styles.row}>
            <label className={styles.colorRow}>
              <span className={styles.fieldLabel}>Stroke</span>
              <input
                type="color"
                className={styles.color}
                value={(selection.strokeColor ?? '#1C1B19').slice(0, 7)}
                onChange={(event) => setStroke(event.target.value, Math.max(selection.strokeMm, 0.5))}
              />
            </label>
            <NumberField
              label="Width"
              value={selection.strokeMm}
              step={0.1}
              min={0}
              suffix="mm"
              onCommit={(v) => setStroke(selection.strokeColor ?? '#1C1B19', v)}
            />
          </div>
          {selection.kind !== 'line' ? (
            <p className={styles.hint}>Stroke width 0 removes the stroke.</p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
