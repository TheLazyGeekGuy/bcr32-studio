# Complete built-in catalogue visibility

User request: inspect all missing models and add available definitions to the list. The live Firefox view shows22 models; the repository ships23.

## Acceptance

1. An unchanged complete built-in snapshot saved through `serializeMap` exposes all currently shipped models after reopening, even when several models were added since the snapshot.
2. JSON object-key ordering cannot affect migration. Saved values, origins and optional metadata survive; opening does not rewrite storage.
3. Changed definitions/sources and independent scoped imports are preserved. Canonical full built-in identity/name plus an inventory of at least the original20 models identify eligible snapshots; a byte-equivalent full built-in import is indistinguishable and follows the same refresh.
4. Every normalized manufacturer table and seed model is represented in the shipped catalogue or explicitly documented as shared by another model. No available SXM model is silently omitted.
5. The live list displays Yamaha A3000 V2 with103 definitions; reload/reopen preserves visibility. No catalogue action sends MIDI.

Non-goals: inventing new manufacturer protocols, promoting examples to hardware validation, or adding full standalone editors. External example/demo SXM documents are not automatically merged into the built-in library.
