# Technical plan

Baseline `7b5c48295e7aae0bc6308a4e9497c74cb75610fc`, initially clean. Codex primary,2026-11-08 02:48 CET onward; exact model/effort unavailable. Relevant reads: catalogue compiler/UI/refresh, SXM serializer, normalized tables, existing tests. Firefox live view22/3122; server source23/3225. The read-only source tree and a generated research comparison are distinct from the user's stored catalogue, which has not been overwritten.

Confirmed reproduction: raw old22-model object refreshes to23; `parseMap(serializeMap(old))` remains22 because `JSON.stringify` compares insertion order. The serializer sorts object keys.

Replace string equality with recursive JSON-data equality (unordered object keys, ordered arrays). Admit older unchanged canonical inventories with multiple missing models, while preserving independent/scoped or modified maps. Retain validation and the2MiB budget, fail safely when adding new definitions cannot produce a valid map.

Inventory all `tables/*.json`, the seed and shipped device IDs; explicit Microwave II/XT sharing remains model-specific. Test serializer roundtrip and browser storage with canonical serialized bytes, not an unrepresentative raw `JSON.stringify` fixture. Verify actual Firefox after the correction without applying the chosen SysEx program.

Follow the existing compiler/version/docs/test workflow. Record evidence and a ticket; preserve source data and runtime port ownership.
