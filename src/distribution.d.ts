declare module 'virtual:midi-studio-distribution' {
  export const generatedLazyEditors:readonly import('./editor-host/lazy-installation').LazyEditorDefinition[]
  export const distribution:{modules:readonly string[];mode:'legacy'|'workspace'|'standalone';library:boolean}
  export const loadWorkspace:undefined|(()=>Promise<typeof import('./editor-host/WorkspaceApp')>)
  export const loadLegacy:undefined|(()=>Promise<typeof import('./App')>)
  export const loadLibrary:undefined|(()=>Promise<{default:typeof import('./library/LibraryTool').LibraryTool}>)
}
