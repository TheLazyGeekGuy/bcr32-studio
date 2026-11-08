# Catalogue correction constraints

- Existing SXM definitions, user values/provenance and source metadata are authoritative; never overwrite a differing user definition.
- Compare JSON semantics independently of object-key order; retain meaningful array ordering.
- Reuse the existing offline compiler, validator, serializer and selected-control callback. No new MIDI sender or native grant.
- A displayed model requires a real definition and documented scope. No placeholder synths or extrapolated manufacturer addresses.
- Validation includes the serializer/storage boundary and the user's actual browser; fake-only results do not prove the live list.
- Keep work on the existing dedicated branch. No publication is authorized by this correction.
