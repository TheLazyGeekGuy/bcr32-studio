# Publication gate correction — 2026-11-09

## Scope and provenance

Repository: BCR32 Studio, branch `work/sysex-bcl-inspector`. Reviewed source: `e2e46561e29465f92ba7796995b265e1f201972d`, initially clean. Reader: Codex primary agent; exact model identifier and reasoning effort are not exposed, so model-level traceability is incomplete. Read 2026-11-09 11:37–11:41 CET: `scripts/leak-gate.mjs`, the eight flagged tracked files, and five historical commit messages. The private denylist is an outside-Git input; its contents are not reproduced.

## Findings and correction

All 13 reported findings were public manufacturer/source references or complete ordinary English technical words in documentation and historical messages. No personal identity, credential or private network address was identified in these findings. The generic checks found no additional issue.

Keep the original source links and commit history. Add narrow reviewed-context exceptions for exact manufacturer references, the specific cited firmware repository URL, and complete technical words. Other domains, suffixes, identifiers and unrelated private rules remain blocked. The generic secret rules, binary metadata checks, identity checks and all 32 private rules remain active. The original matcher self-test runs without contextual exceptions; regression tests independently verify the exceptions. No hook bypass, denylist edit or history rewrite.

## Verification

- 33 positive/negative regression assertions pass; automatically included by the existing test runner.
- Full gate passes: generic checks plus 32 private rules, files and commit identities/messages.
- Diff whitespace checks pass.
- No editor runtime or hardware behavior changed; no new hardware test required.

## Publication

Owner authorized commit and GitHub push. Use the normal pre-push hook on the work branch and verify the remote commit after pushing. Main and deployment are outside this operation.
