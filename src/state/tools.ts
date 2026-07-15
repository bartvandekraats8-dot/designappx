/**
 * Tool model.
 *
 * Per the TypeScript-6 `erasableSyntaxOnly` rule we use a `const` list plus a
 * derived union type instead of an `enum` (enums emit runtime code and are
 * disallowed by that flag). `ToolId` therefore stays a pure type.
 */

export const TOOLS = ['select', 'text', 'shape', 'image'] as const

export type ToolId = (typeof TOOLS)[number]

export interface ToolDef {
  id: ToolId
  label: string
  hint: string
  shortcut: string
}

export const TOOL_DEFS: readonly ToolDef[] = [
  { id: 'select', label: 'Select', hint: 'Select and transform', shortcut: 'V' },
  { id: 'text', label: 'Text', hint: 'Add and edit text', shortcut: 'T' },
  { id: 'shape', label: 'Shape', hint: 'Draw a shape', shortcut: 'S' },
  { id: 'image', label: 'Image', hint: 'Place an image', shortcut: 'I' },
]
