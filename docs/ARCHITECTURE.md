# Evermore 6 — Phase 0 architecture

## Principles
1. **Local-first.** All data lives in the browser's IndexedDB. No backend.
2. **Never destroy.** v5's database is read-only to v6. Import merges and never deletes. Migration is copy-and-verify with rollback.
3. **Prove it.** Every copy is verified by SHA-256 of each record (canonical JSON), and the whole thing is covered by tests that were themselves checked by mutation.
4. **Preserve v5.** The v5 interface code is reused verbatim; the only edits are listed in the README.

## Databases
| Database | Purpose | Written by v6? |
|---|---|---|
| `evermore` | **v5's database** (stores: `entries`, `versions`, `collections`) | **Never** (opened read-only) |
| `evermore-v6` | The v6 archive (schema version 1) | Yes |
| `evermore-v6-backup` | Daily/manual backups and permanent safety snapshots (store `b`, key `t`) | Yes |
| `evermore-v6-dryrun` | Scratch copy used during migration; deleted afterwards | Temporary |
| `evtest-*` | Scratch databases for the self-test; deleted afterwards | Temporary |

Preferences: localStorage keys `ev6.*` (v6) mirrored into the `prefs` store. v5's `ev.*` keys are read once (copied, not modified).

## `evermore-v6` stores (version 1)
| Store | Key | Indexes | Phase 0 use |
|---|---|---|---|
| `entries` | `id` | `date`, `updated`, `type` | journal entries (identical fields to v5) |
| `versions` | `vid` (auto) | `eid` | saved versions per entry |
| `shelves` | `id` | – | collections (v5 called this store `collections`) |
| `people`, `relations`, `clusters`, `exhibits`, `annotations`, `questions`, `files` | `id` | by name / `a`,`b` / `eid` | **reserved, empty**: created now so export, backup and verification cover them from day one |
| `prefs` | `key` | – | settings mirrored from localStorage |
| `meta` | `key` | – | migration state, last verification (not exported) |

**Entry fields** (all preserved verbatim): `id, type, mood, title, html, text, date (YYYY-MM-DD), cat, tags[], ev, arch, links[], cols[], words, created, updated, snapAt`, optional `pin`, `del` (trash timestamp), and any unknown extra field. Photographs are embedded in `html` as `data:image/...;base64,` URIs.

Trash is a flag (`del`), not removal; trashed entries stay in `entries`, are excluded from the in-memory list `E`, and are purged 30 days later.

## Migration (v5 → v6)
State is kept in `meta['migration']`: *(none)* → `started` → `done`, or `rolledback`, or `fresh` (user chose to start empty).
1. Read v5 (`readonly` transactions only; existence probes never create a database).
2. Save a permanent safety snapshot (`keep:true`) in `evermore-v6-backup`, and verify its counts.
3. **Dry run** into `evermore-v6-dryrun` with full verification; stop here on any failure.
4. Real copy into `evermore-v6`: entries, versions (version ids preserved), shelves.
5. Verify by SHA-256 per record, photograph fingerprints, and version ids.
6. On success write `done` with a report (counts, photo count/bytes, overall fingerprint); on failure clear v6's owned stores, write `rolledback`.
Refuses to write into a non-empty database that has no migration marker. Re-running after `done` is a no-op. An interrupted run (`started`) is cleared and redone.

## Export format
```json
{ "app":"evermore", "schema":2, "build":"6.0.0-phase0", "at":0,
  "entries":[], "versions":[], "shelves":[], "people":[], "relations":[], "clusters":[], "exhibits":[],
  "annotations":[], "questions":[], "files":[], "prefs":[], "counts":{} }
```
Import accepts schema **1** (v5 exports: `collections` instead of `shelves`) and **2**. Validation: record must be an object; ids ≤ 64 chars; entry dates `YYYY-MM-DD`; HTML passed through the sanitiser; `__proto__`/`constructor`/`prototype` keys dropped; **all other fields kept**. Merge rule: newer `updated` wins; equal or older is skipped; versions de-duplicated by (entry, time); nothing is deleted.

## Backups
One automatic backup per day Evermore is opened (and on demand); last 7 rotating backups kept. Safety snapshots (`keep:true`) are never rotated. Each backup is a full export object plus `t` (timestamp key) and `kind`.

## Visibility rule
`vis(e)` in `00-core.js` is the single predicate for "show this entry in archive-wide views". In Phase 0 it equals the v5 test (`!e.arch`); later phases extend it in one place.

## Integrity checker (`verifyDB`)
Structure of every entry; date-index count; cross-references; shelf references; orphaned/duplicate versions; photograph base64 validity; word counts; annotation/file ownership; migration state. Read-only.

## Self-test (`runSelfTests`)
26 tests on synthetic data in scratch databases: migration (verification, v5 unchanged, version ids/unknown fields/v1-era entries, photos, snapshot, dry-run parity, idempotency, interruption, rollback, dry-run failure, non-empty refusal, no accidental database creation), export/import (round trip, idempotent, schema-1, merge rules, validation/sanitising, all new stores), backups (create/restore/rotate; restore after damage), integrity detection, fingerprint sensitivity, visibility equivalence, preference copy, and scale.
