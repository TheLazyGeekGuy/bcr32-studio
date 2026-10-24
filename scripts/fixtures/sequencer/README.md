# Sequencer fixtures

Non-regression inputs for the BCR32 sequencer's MIDI file import/export
(`src/editors/bcontrol/bcr32/midi-file.ts`) and Zaquencer pattern files (`zaquencer.ts`), checked by
`scripts/test-midi-file.mjs` as part of `npm test`.

**Any `.mid` or `.syx` file dropped into this folder becomes part of `npm test`.** No list to update.

| Name | Expectation |
| --- | --- |
| `*.mid` | Parses. Its first four tracks with notes survive file → steps → file → steps unchanged (delay excepted, it is not written). |
| `*.syx` | Splits into SysEx messages that all assemble into complete Zaquencer patterns, each re-encoded byte-identically. |
| `*.invalid.mid` | Must be refused by `parseMidiFile`. |
| `*.invalid.syx` | Must be refused: split error, undecodable frame or incomplete pattern. |

## Provenance

Every file committed here is **synthetic**, written by `make-fixtures.mjs` (`node scripts/fixtures/sequencer/make-fixtures.mjs`).
None is a hardware capture. The MIDI files come from a small SMF writer in that script, independent of the module under test;
the `.syx` patterns are seeded or ramp bytes framed by `zaqBlockFile`. The test also checks that these files still match the
generator byte for byte, so edit the generator and rerun it rather than editing the files.

When adding a real export or capture, say so in its name (for example `bcr32-fw102-capture-….syx`) and record where it
came from in the commit message.
