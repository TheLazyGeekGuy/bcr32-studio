// Undo / redo per preset. Each preset (and the unsaved draft) has its own history, so undoing never reaches into
// another preset. States are opaque strings (the caller serialises assignments and labels; values are not history).
// Edits less than `coalesceMs` apart form one step (typing a label, dragging a field), like an editor's undo.
export function createHistory(limit = 100, coalesceMs = 600) {
  type Stack = { undo: string[]; redo: string[]; current: string; lastAt: number }
  const stacks = new Map<string, Stack>()
  const stack = (key: string, state: string) => { let s = stacks.get(key); if (!s) { s = { undo: [], redo: [], current: state, lastAt: -Infinity }; stacks.set(key, s) } return s }
  return {
    // A state seen for `key`. Arriving on a preset whose state is not the one its history ends with (reloaded from the
    // library, imported) starts its history over: steps would otherwise jump between unrelated versions.
    arrive(key: string, state: string) { const s = stacks.get(key); if (!s || s.current !== state) stacks.set(key, { undo: [], redo: [], current: state, lastAt: -Infinity }) },
    record(key: string, state: string, now: number, separate = false) {
      const s = stack(key, state)
      if (s.current === state) return
      if (separate || now - s.lastAt >= coalesceMs || !s.undo.length) { s.undo.push(s.current); if (s.undo.length > limit) s.undo.shift() }
      s.current = state; s.redo = []; s.lastAt = now
    },
    undo(key: string): string | null { const s = stacks.get(key); if (!s?.undo.length) return null; s.redo.push(s.current); s.current = s.undo.pop()!; s.lastAt = -Infinity; return s.current },
    redo(key: string): string | null { const s = stacks.get(key); if (!s?.redo.length) return null; s.undo.push(s.current); s.current = s.redo.pop()!; s.lastAt = -Infinity; return s.current },
    counts(key: string) { const s = stacks.get(key); return { undo: s?.undo.length ?? 0, redo: s?.redo.length ?? 0 } },
  }
}
export type History = ReturnType<typeof createHistory>
