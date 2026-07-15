/**
 * Export filename sanitisation — shared by every INC-7 format.
 * Pattern: `[X]_{design-name}_{format}`, per the MVP prompt.
 */
export function buildExportFilename(designName: string, format: string): string {
  const slug =
    designName
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^A-Za-z0-9._-]/g, '')
      .replace(/-{2,}/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 60) || 'untitled'
  return `[X]_${slug}_${format}`
}

export function triggerDownload(dataUrl: string, filename: string): void {
  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}

/** Data URL (e.g. from `canvas.toDataURL`) -> Blob, for ZIP bundling. */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl)
  return response.blob()
}

/** Convert a Blob to a browser download, via a temporary object URL. */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  triggerDownload(url, filename)
  // Revoke after the click has been dispatched; synchronous revoke can race
  // Firefox's download handoff.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
