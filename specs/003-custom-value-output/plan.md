# Plan and contract delta

Keep normal `value` grants voice-only. Add a broker method issuing a one-use value grant for an exact bounded SysEx batch (up to4 messages, up to256 bytes each). Preflight the entire batch; verify the same owner/generation and exact bytes at send time. Reject replay, edits, missing SysEx permission and stale/foreign leases. Existing signatures/callers stay unchanged; absence of this optional service is reported rather than bypassed.

BCR32's bridge reparses the selected source, evaluates supported tokens, rejects its own manufacturer commands and universal system SysEx, obtains the exact grant, sends through the lease, and logs output. Generic queues carry explicit gesture values and source identity, not grants. Recheck source and live state at flush; bind cleanup to connection changes. No new raw output escape through Web MIDI wrappers.

Keep the standard sender unchanged. Custom gesture handling uses a bounded queue with latest-per-control rotations and ordered press/release. Cancelling value queues for custom editing does not implicitly disarm the user's value toggle. Relabel the toggle MIDI because it now covers SysEx as well as CC. The simulation remains inert. Existing modules without custom gestures are unaffected; no saved-state migration.

Verification: broker grant isolation and byte preflight, template vectors and rejected commands, queue cancellation/coalescing, existing host/CC regressions, browser mouse gesture on encoder8 with fake MIDI and zero output at startup. Hardware reaction remains a separate gate.
