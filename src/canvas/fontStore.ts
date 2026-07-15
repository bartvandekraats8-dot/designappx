/**
 * Uploaded-font persistence — approved INC-3 decision: idb enters here,
 * scoped to a single `fonts` object store. The shared connection (and the
 * versioned upgrade path) now lives in `data/db.ts`, extended by INC-8
 * rather than opened again here.
 *
 * Flow: TTF/OTF file -> blob into IndexedDB -> FontFace registered on
 * document.fonts. On boot, loadStoredFonts() re-registers every stored blob
 * (the DoD reload-survival path). Deleting a font removes blob + FontFace;
 * artwork referencing it falls back to the browser default silently — the
 * layer keeps its fontFamily string so re-uploading the font heals it.
 */

import { useStudio } from '../state/studio'
import { db } from '../data/db'

const registered = new Set<string>()

async function registerFace(family: string, blob: Blob): Promise<void> {
  if (registered.has(family)) return
  const face = new FontFace(family, await blob.arrayBuffer())
  await face.load()
  document.fonts.add(face)
  registered.add(family)
}

function publish(families: string[]): void {
  useStudio.getState().setCustomFonts([...families].sort())
}

/** Boot path: re-register every stored font, publish the list. */
export async function loadStoredFonts(): Promise<void> {
  try {
    const fonts = await (await db()).getAll('fonts')
    for (const font of fonts) {
      try {
        await registerFace(font.family, font.blob)
      } catch {
        /* A single corrupt blob must not block the rest. */
      }
    }
    publish(fonts.map((font) => font.family))
  } catch {
    /* IndexedDB unavailable (private mode etc.) -> session-only uploads. */
    publish([])
  }
}

function familyFromFilename(name: string): string {
  const base = name.replace(/\.(ttf|otf)$/i, '').replace(/[_-]+/g, ' ').trim()
  return base || 'Uploaded font'
}

/** Upload path: store blob, register face, publish. Returns the family. */
export async function addFontFromFile(file: File): Promise<string> {
  let family = familyFromFilename(file.name)
  const existing = useStudio.getState().customFonts
  let suffix = 2
  while (existing.includes(family)) family = `${familyFromFilename(file.name)} ${suffix++}`

  await registerFace(family, file)
  try {
    await (await db()).put('fonts', { family, blob: file, addedAt: Date.now() })
  } catch {
    /* Store failed (quota/private mode): face stays registered for session. */
  }
  publish([...existing, family])
  return family
}

/** Raw blob for embedding into exports (INC-7 SVG/PDF font embedding). */
export async function getStoredFontBlob(family: string): Promise<Blob | null> {
  try {
    const stored = await (await db()).get('fonts', family)
    return stored?.blob ?? null
  } catch {
    return null
  }
}

export async function removeFont(family: string): Promise<void> {
  try {
    await (await db()).delete('fonts', family)
  } catch {
    /* ignore */
  }
  for (const face of document.fonts) {
    if (face.family === family || face.family === `"${family}"`) {
      document.fonts.delete(face)
    }
  }
  registered.delete(family)
  publish(useStudio.getState().customFonts.filter((entry) => entry !== family))
}
