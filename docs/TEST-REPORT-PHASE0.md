# Evermore v6 — Phase 0 test report

Generated 2026-11-01 · build 6.0.0-phase0 · Node v22.22.2

## What was run, and where

| Suite | Environment | Result |
|---|---|---|
| Data-layer self-test (26 tests) | Node, **in-memory IndexedDB emulator**, stand-in sanitiser | 26/26 passed, 0 failed, 10615 ms total |
| Mutation check (13 injected bugs) | same | 12 caught, 1 not caught (see note) |
| Assembled-page smoke test (26 checks) | Node, "chaos" DOM stub + emulator | 26/26 smoke checks passed |
| Same self-test inside the real page | **Your browser** (Vault → Self-test) | **Not run yet — needs you** |

## 1. Data-layer self-test

| # | | Test | Detail |
|---|---|---|---|
| 01 | ✅ | Legacy v5 data migrates with every record verified | 672 records verified, 400 entries |
| 02 | ✅ | v5 database is byte-for-byte unchanged by migration |  |
| 03 | ✅ | Version ids, unknown fields, v1-era entries and trash flags survive | e29.zz, e5 (no type), e17.del, e13.pin intact |
| 04 | ✅ | Photographs are preserved exactly through migration | 50 photographs, 2.5 MB identical |
| 05 | ✅ | Safety snapshot was written and verified before migration |  |
| 06 | ✅ | Dry run and real run produce the same fingerprint |  |
| 07 | ✅ | Running the migration again is harmless (idempotent) |  |
| 08 | ✅ | An interrupted migration recovers cleanly | partial data discarded, full copy verified |
| 09 | ✅ | A failed verification rolls back and leaves v5 untouched | corruption detected, rolled back, retry succeeded |
| 10 | ✅ | The dry run catches corruption before the real database is touched |  |
| 11 | ✅ | Migration refuses to write into a non-empty, unmarked database |  |
| 12 | ✅ | Looking for v5 never creates a database |  |
| 13 | ✅ | JSON export then import reproduces the archive exactly | 400 entries, 268 versions, 4.4 MB JSON |
| 14 | ✅ | Importing the same archive twice changes nothing |  |
| 15 | ✅ | A v5 (schema 1) export imports into v6 | 4 shelves, 400 entries |
| 16 | ✅ | Merge keeps newer local edits, restores missing entries, never deletes | 1 restored, 399 skipped |
| 17 | ✅ | Imports are validated and sanitised; unknown fields are kept | 4 invalid records rejected, 3 kept, bad archives refused |
| 18 | ✅ | All new stores export and import (people, relations, clusters, exhibits, annotations, questions, files) | 7 record types + preferences round-trip |
| 19 | ✅ | Backups: create, restore into an empty database, rotate | 7 rotating backups + permanent snapshot |
| 20 | ✅ | Restoring after damage brings back deleted and older entries | 50 deleted + 1 damaged entry recovered |
| 21 | ✅ | Integrity check passes on a healthy archive | 10 checks passed, 0 warnings |
| 22 | ✅ | Integrity check detects deliberate corruption | 6 injected faults all detected |
| 23 | ✅ | Fingerprints detect a single changed character |  |
| 24 | ✅ | Visibility rule is identical to the v5 filter |  |
| 25 | ✅ | v5 preferences copy to v6 without touching v5 keys |  |
| 26 | ✅ | Scale: 1500 entries migrate, verify and round-trip | 1500 entries, 1000 versions, 60 photos: migration 954 ms, export+import 591 ms |

## 2. Mutation check (can the tests actually fail?)

Each row injects one deliberate bug into a copy of the code and confirms the suite notices.

| Result | Injected bug |
|---|---|
| ✅ caught | migration forgets to copy saved versions |
| ✅ caught | migration verification disabled |
| ⚠️ not caught | migration skips photo check only |
| ✅ caught | migration writes to the v5 database |
| ✅ caught | import drops unknown fields |
| ✅ caught | import allows prototype keys |
| ✅ caught | export omits a store (annotations) |
| ✅ caught | import truncates photographs |
| ✅ caught | backups keep only 3 |
| ✅ caught | safety snapshot gets rotated |
| ✅ caught | merge overwrites newer local edits |
| ✅ caught | integrity check ignores bad photos |
| ✅ caught | visibility rule differs from v5 |

*Note on the one "not caught" row:* removing the separate photograph comparison during migration is an **equivalent mutant**. Photographs live inside each entry's HTML, so any change to a photograph already changes that entry's SHA-256 and fails verification. The photo comparison is a second line of defence, and the real corruption of photographs is separately caught by the "import truncates photographs" mutation.

## 3. Assembled-page smoke test

PASS  A: app boots without gate or errors
PASS  A: go('t')
PASS  A: go('i')
PASS  A: go('c')
PASS  A: go('p')
PASS  A: go('d')
PASS  A: go('j')
PASS  A: openE(E[0].id)
PASS  A: openE(E[5].id)
PASS  A: create()
PASS  A: openS()
PASS  A: $('#q').value='alpha';renderSearch()
PASS  A: closeS()
PASS  A: openMap()
PASS  A: closeMap()
PASS  A: bookOpts()
PASS  A: tagMgr()
PASS  A: scopeList('a',false)
PASS  A: openBook('a',false)
PASS  A: closeBook()
PASS  A: entries loaded from the v6 database
PASS  A: trashed entries kept out of the live list
PASS  B: gate shown for found v5 data without errors
PASS  B: nothing copied before the user presses the button
PASS  B: v5 preferences copied to ev6. keys, v5 keys kept
PASS  C: first run with no v5 data shows the welcome gate without errors

26/26 smoke checks passed


## 4. What this report does NOT prove

- **Real browser storage.** The tests ran against my own IndexedDB emulator, not Chrome/Safari/Firefox. Real browsers differ in details (transaction timing, quota, `indexedDB.databases()` support). The Vault's **Self-test** button runs the same 26 tests in your real browser with the real sanitiser; please run it and send me the result.
- **The real HTML sanitiser** was replaced by a simple stand-in in Node. The in-page self-test uses the real one.
- **Visuals and interaction.** The smoke test shows every view runs without errors; it cannot judge layout, colours, mobile behaviour or whether a click does what you expect.
- **Whether the two pages share storage.** If v5 and v6 live on different origins, v6 cannot see v5's database. The migration screen handles this by offering JSON import. That path is tested; the detection path across origins can only be confirmed on your device.
- **Very large archives.** Migration loads the whole v5 database into memory (needed for checksum comparison). Tested to 1,500 entries here and designed for the in-app 10,000-entry stress test; archives with hundreds of MB of photographs have not been tested.
- **Backup size.** Each daily backup is a full copy (up to 7 kept), so photo-heavy archives use several times their size in browser storage.
