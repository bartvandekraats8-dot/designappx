import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import { getGarment, getTextileColor } from '../data/garments'
import { formatMm, mmToExportPx, workToMm } from '../lib/units'
import { useStudio } from '../state/studio'
import { scopeCropBox, type ExportScope } from '../canvas/renderZone'
import { exportZonePng } from '../canvas/exportPng'
import { exportZoneJpg } from '../export/exportJpg'
import { exportZoneSvg } from '../export/exportSvg'
import { exportZonePdf } from '../export/exportPdf'
import { exportMockupPng, exportMockupJpg } from '../export/exportMockup'
import { exportProjectJson, importProjectJson } from '../export/exportJson'
import { exportZoneZip, type BundleFormat } from '../export/exportZip'
import styles from './ExportDialog.module.css'

interface ExportDialogProps {
  onClose: () => void
}

type ScopeKind = 'zone' | 'selection' | 'layer'

const ALL_FORMATS: readonly { id: BundleFormat; label: string }[] = [
  { id: 'png', label: 'PNG' },
  { id: 'jpg', label: 'JPG' },
  { id: 'svg', label: 'SVG' },
  { id: 'pdf', label: 'PDF' },
  { id: 'mockup-png', label: 'Mockup PNG' },
  { id: 'mockup-jpg', label: 'Mockup JPG' },
  { id: 'json', label: 'Project JSON' },
]

export function ExportDialog({ onClose }: ExportDialogProps) {
  const designName = useStudio((state) => state.designName)
  const garmentId = useStudio((state) => state.garmentId)
  const colorId = useStudio((state) => state.colorId)
  const technique = useStudio((state) => state.technique)
  const screenColorLimit = useStudio((state) => state.screenColorLimit)
  const printWarnings = useStudio((state) => state.printWarnings)
  const customFonts = useStudio((state) => state.customFonts)
  const controller = useStudio((state) => state.controller)
  const selection = useStudio((state) => state.selection)
  const layers = useStudio((state) => state.layers)
  const setNotice = useStudio((state) => state.setNotice)
  const setGarment = useStudio((state) => state.setGarment)
  const setColor = useStudio((state) => state.setColor)
  const setTechnique = useStudio((state) => state.setTechnique)
  const setScreenColorLimit = useStudio((state) => state.setScreenColorLimit)
  const setDesignName = useStudio((state) => state.setDesignName)

  const [scopeKind, setScopeKind] = useState<ScopeKind>('zone')
  const [layerId, setLayerId] = useState<string>('')
  const [jpgBackground, setJpgBackground] = useState('#ffffff')
  const [mockupJpgBackground, setMockupJpgBackground] = useState('#ffffff')
  const [includeBleed, setIncludeBleed] = useState(false)
  const [cropMarks, setCropMarks] = useState(false)
  const [bundleFormats, setBundleFormats] = useState<Set<BundleFormat>>(
    new Set(['png', 'json']),
  )
  const [busy, setBusy] = useState<string | null>(null)

  const dialogRef = useRef<HTMLDivElement>(null)

  /* Focus management: move focus in on open, trap Tab within the dialog,
     restore it to whatever triggered the dialog on close (the Export
     button) — a plain div with role="dialog" gets none of this for free. */
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    dialogRef.current?.querySelector<HTMLElement>('button, input, select, [tabindex]')?.focus()
    return () => {
      previouslyFocused?.focus()
    }
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const garment = getGarment(garmentId)
  const hasSelection = (selection?.count ?? 0) > 0
  const canvas = controller?.canvas ?? null

  const scope: ExportScope = useMemo(() => {
    if (scopeKind === 'selection') return { kind: 'selection' }
    if (scopeKind === 'layer' && layerId) return { kind: 'layer', id: layerId }
    return { kind: 'zone' }
  }, [scopeKind, layerId])

  const isZoneScope = scope.kind === 'zone'

  const previewPx = useMemo(() => {
    if (!canvas) return null
    const box = scopeCropBox(canvas, garment, scope)
    const widthMm = workToMm(box.width)
    const heightMm = workToMm(box.height)
    return {
      widthMm,
      heightMm,
      widthPx: mmToExportPx(widthMm),
      heightPx: mmToExportPx(heightMm),
    }
  }, [canvas, garment, scope])

  const runAction = async (label: string, action: () => unknown) => {
    setBusy(label)
    try {
      await action()
      setNotice(`Exported ${label}.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : `Could not export ${label}.`)
    } finally {
      setBusy(null)
    }
  }

  const toggleBundleFormat = (format: BundleFormat) => {
    setBundleFormats((prev) => {
      const next = new Set(prev)
      if (next.has(format)) next.delete(format)
      else next.add(format)
      return next
    })
  }

  const importInputId = 'export-dialog-import-input'

  const handleImport = (file: File) => {
    if (!canvas) return
    void runAction('project import', async () => {
      const text = await file.text()
      const meta = await importProjectJson(canvas, text)
      setDesignName(meta.designName)
      setGarment(meta.garmentId)
      setColor(meta.colorId)
      setTechnique(meta.technique)
      setScreenColorLimit(meta.screenColorLimit)
    })
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Export"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>Export</h2>
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>

        {!canvas ? (
          <p className={styles.empty}>Canvas not ready yet.</p>
        ) : (
          <div className={styles.body}>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Scope</h3>
              <div className={styles.row}>
                <label className={styles.radio}>
                  <input
                    type="radio"
                    checked={scopeKind === 'zone'}
                    onChange={() => setScopeKind('zone')}
                  />
                  Whole zone
                </label>
                <label className={styles.radio}>
                  <input
                    type="radio"
                    checked={scopeKind === 'selection'}
                    disabled={!hasSelection}
                    onChange={() => setScopeKind('selection')}
                  />
                  Selection only
                </label>
                <label className={styles.radio}>
                  <input
                    type="radio"
                    checked={scopeKind === 'layer'}
                    disabled={layers.length === 0}
                    onChange={() => setScopeKind('layer')}
                  />
                  Single layer
                </label>
                {scopeKind === 'layer' && (
                  <select
                    className={styles.select}
                    value={layerId}
                    aria-label="Layer to export"
                    onChange={(event) => setLayerId(event.target.value)}
                  >
                    <option value="">Choose a layer…</option>
                    {layers.map((layer) => (
                      <option key={layer.id} value={layer.id}>
                        {layer.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {previewPx && (
                <p className={styles.preview}>
                  {formatMm(previewPx.widthMm)} × {formatMm(previewPx.heightMm)} mm ·{' '}
                  {previewPx.widthPx} × {previewPx.heightPx} px @ 300 DPI
                </p>
              )}
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Raster</h3>
              <div className={styles.formatRow}>
                <span className={styles.formatLabel}>PNG (transparent, 300 DPI)</span>
                <button
                  type="button"
                  className={styles.action}
                  disabled={busy !== null}
                  aria-label="Download PNG"
                  onClick={() =>
                    void runAction('PNG', () =>
                      exportZonePng(canvas, garment, designName, scope),
                    )
                  }
                >
                  Download
                </button>
              </div>
              <div className={styles.formatRow}>
                <span className={styles.formatLabel}>JPG</span>
                <input
                  type="color"
                  className={styles.colorInput}
                  value={jpgBackground}
                  title="Background colour"
                  aria-label="JPG background colour"
                  onChange={(event) => setJpgBackground(event.target.value)}
                />
                <button
                  type="button"
                  className={styles.action}
                  disabled={busy !== null}
                  aria-label="Download JPG"
                  onClick={() =>
                    void runAction('JPG', () =>
                      exportZoneJpg(canvas, garment, designName, jpgBackground, scope),
                    )
                  }
                >
                  Download
                </button>
              </div>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Vector</h3>
              <div className={styles.formatRow}>
                <span className={styles.formatLabel}>SVG (embedded fonts)</span>
                <button
                  type="button"
                  className={styles.action}
                  disabled={busy !== null}
                  aria-label="Download SVG"
                  onClick={() =>
                    void runAction('SVG', () =>
                      exportZoneSvg(canvas, garment, designName, scope, customFonts),
                    )
                  }
                >
                  Download
                </button>
              </div>
              <div className={styles.formatRow}>
                <span className={styles.formatLabel}>PDF (physical size, RGB, CMYK-intent note)</span>
                <button
                  type="button"
                  className={styles.action}
                  disabled={busy !== null}
                  aria-label="Download PDF"
                  onClick={() =>
                    void runAction('PDF', () =>
                      exportZonePdf(canvas, garment, designName, {
                        scope,
                        includeBleed,
                        cropMarks,
                        customFonts,
                      }),
                    )
                  }
                >
                  Download
                </button>
              </div>
              <div className={styles.subRow}>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    disabled={!isZoneScope}
                    checked={includeBleed}
                    onChange={(event) => setIncludeBleed(event.target.checked)}
                  />
                  Bleed ({formatMm(garment.bleedMm)} mm)
                </label>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    disabled={!isZoneScope}
                    checked={cropMarks}
                    onChange={(event) => setCropMarks(event.target.checked)}
                  />
                  Crop marks
                </label>
                {!isZoneScope && (
                  <span className={styles.hint}>Bleed/crop marks apply to the whole zone only.</span>
                )}
              </div>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Mockup preview</h3>
              <div className={styles.formatRow}>
                <span className={styles.formatLabel}>Mockup PNG</span>
                <button
                  type="button"
                  className={styles.action}
                  disabled={busy !== null}
                  aria-label="Download mockup PNG"
                  onClick={() =>
                    void runAction('mockup PNG', () =>
                      exportMockupPng(canvas, garment, getTextileColor(colorId).hex, designName),
                    )
                  }
                >
                  Download
                </button>
              </div>
              <div className={styles.formatRow}>
                <span className={styles.formatLabel}>Mockup JPG</span>
                <input
                  type="color"
                  className={styles.colorInput}
                  value={mockupJpgBackground}
                  title="Background colour"
                  aria-label="Mockup JPG background colour"
                  onChange={(event) => setMockupJpgBackground(event.target.value)}
                />
                <button
                  type="button"
                  className={styles.action}
                  disabled={busy !== null}
                  aria-label="Download mockup JPG"
                  onClick={() =>
                    void runAction('mockup JPG', () =>
                      exportMockupJpg(
                        canvas,
                        garment,
                        getTextileColor(colorId).hex,
                        designName,
                        mockupJpgBackground,
                      ),
                    )
                  }
                >
                  Download
                </button>
              </div>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Project</h3>
              <div className={styles.formatRow}>
                <span className={styles.formatLabel}>JSON (re-importable)</span>
                <button
                  type="button"
                  className={styles.action}
                  disabled={busy !== null}
                  aria-label="Download project JSON"
                  onClick={() =>
                    void runAction('project JSON', () => {
                      exportProjectJson(canvas, {
                        designName,
                        garmentId,
                        colorId,
                        technique,
                        screenColorLimit,
                      })
                    })
                  }
                >
                  Download
                </button>
              </div>
              <div className={styles.formatRow}>
                <span className={styles.formatLabel}>Import a project JSON</span>
                <label className={styles.action} htmlFor={importInputId}>
                  Choose file
                </label>
                <input
                  id={importInputId}
                  type="file"
                  accept="application/json"
                  className={styles.hiddenFileInput}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) handleImport(file)
                    event.target.value = ''
                  }}
                />
              </div>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Bundle (ZIP + spec sheet)</h3>
              <div className={styles.bundleGrid}>
                {ALL_FORMATS.map((format) => (
                  <label key={format.id} className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={bundleFormats.has(format.id)}
                      onChange={() => toggleBundleFormat(format.id)}
                    />
                    {format.label}
                  </label>
                ))}
              </div>
              <button
                type="button"
                className={styles.primary}
                disabled={busy !== null || bundleFormats.size === 0}
                onClick={() =>
                  void runAction('ZIP bundle', () =>
                    exportZoneZip(
                      canvas,
                      garment,
                      { designName, garmentId, colorId, technique, screenColorLimit },
                      {
                        formats: bundleFormats,
                        scope,
                        jpgBackground,
                        mockupJpgBackground,
                        includeBleed,
                        cropMarks,
                        customFonts,
                        screenColorLimit,
                        printWarnings,
                      },
                    ),
                  )
                }
              >
                {busy === 'ZIP bundle' ? 'Building…' : 'Download ZIP'}
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
