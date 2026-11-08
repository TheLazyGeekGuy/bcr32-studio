# MIDI settings status HTML nesting

The MIDI settings status row used a paragraph containing `FirmwareIdentity`, whose root is a `div`. React correctly reports this invalid block-in-paragraph nesting. Change the row to `div` while retaining its class and `role="status"`; existing flex styling and accessible status semantics remain in place. No MIDI or persistence behavior changes.

The existing isolated-browser custom-value scenario now also captures DOM-nesting/hydration console errors (in addition to page errors), so a React warning cannot silently pass that check. This is a bounded markup correction, not a shared interface change.

Review: Codex primary, 2026-11-08 03:56–03:58 CET, BCR32 Studio baseline `69118595b91119a0af918bd1a925cae2f3f08a3f`, initially clean. Read `Workbench.tsx`, `ControllerReadPanel.tsx`, the matching stylesheet selectors and sidebar/browser checks. The named markup, browser check, changelog and report are uncommitted during verification. Exact model identifier and reasoning effort are unavailable; provenance is incomplete for those fields. No hardware test or write is needed for this markup correction.

Validation: sidebar checks and TypeScript pass. The isolated Chromium scenario opens and closes MIDI settings, verifies the DIV status container and absence of firmware blocks under paragraphs, and finishes the existing mouse SysEx scenario without page errors or nesting/hydration console errors. All ports are simulated. `git diff --check` passes. [Issue51](https://github.com/TheLazyGeekGuy/bcr32-studio/issues/51). Local correction only, no push/deployment.
