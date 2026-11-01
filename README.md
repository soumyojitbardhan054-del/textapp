# Evermore 6 — Phase 0 (foundation build)

Evermore is a **local-first personal archive and journal**. Everything is stored in your own browser (IndexedDB) and
works offline. There is no server, no account, and no dependency to install.

This package is the **complete source code of the Phase 0 build**: the unchanged Evermore v5 interface on top of a new,
versioned database, with a verified migration from v5, backups, a data-integrity checker and a built-in self-test.
No new visible features were added in Phase 0.

> **Privacy:** this package contains **no journal data, no database contents and no photographs**. All test data is
> synthetic and generated at run time in scratch databases (`evtest-*`, `evermore-v6-dryrun`), which are deleted afterwards.

---

## 1. Quick start (3 minutes)

### Requirements
* A modern browser: current Chrome, Edge, Firefox or Safari.
* **Node.js 18 or newer** (only to run the local server, the build and the tests). Check with `node --version`.
  Download from <https://nodejs.org> if needed. There is nothing to `npm install`: the project has **zero dependencies**.

### Run it
```bash
cd evermore-v6-phase0
npm start            # builds, then serves on http://localhost:8080
```
Open **http://localhost:8080/evermore-v6.html**.

No npm? The same thing without it:
```bash
node build.js && node serve.js
```
Another port: `node serve.js 8081`. Another static server also works, for example
`python3 -m http.server 8080 --directory dist`.

### Even simpler: no server at all
`dist/evermore-v6.html` is a single self-contained file. Double-clicking it works in most browsers, but data stored
for `file://` pages is handled differently by each browser (and Web Crypto, used by the verified migration, is most
reliable on `localhost`). **Use the local server for anything you care about.**

> **Your data belongs to the address you open.** `http://localhost:8080` and `http://localhost:8081` (or a file, or the
> hosted copy) are *different* storage areas with separate data. Pick one address and keep using it.

### Using it
First run shows a welcome screen (see section 4 for bringing in a v5 archive). After that it is the Evermore you know:
six sections (Study, Years, Ledger, Archive, Plates, Vault). Keyboard: `Ctrl+K` search, `Alt+N` new entry, `Alt+1..6` sections.

---

## 2. What is in the package

```
evermore-v6-phase0/
├─ README.md                  this file
├─ package.json               scripts only; no dependencies
├─ build.js                   primary builder (Node)  ->  dist/evermore-v6.html
├─ build.py                   optional Python builder, produces the identical file
├─ serve.js                   zero-dependency local web server (127.0.0.1 only)
├─ dist/evermore-v6.html      the built, runnable application (one file)
├─ src/
│  ├─ head.html               document head (title, font links)
│  ├─ style.css               v5 stylesheet, unchanged (Walnut / Vellum themes, typography)
│  ├─ css-v6.css              Phase 0 additions (migration screen, integrity/test rows)
│  ├─ shell.html              page markup, including the migration overlay
│  └─ js/                     22 modules, concatenated in filename order
├─ tests/
│  ├─ idb-emulator.js         in-memory IndexedDB used to run tests in Node
│  ├─ run-node.js             runs the 26-test self-test suite
│  ├─ smoke.js                boots the assembled page against a stub DOM and renders every view
│  └─ mutation.sh             injects 13 deliberate bugs and checks the tests notice (needs bash)
├─ tools/extract.py           provenance: re-derives the reused v5 modules and proves they match src/
├─ reference/evermore-v5.html the v5 build this was derived from (also used for local migration testing)
└─ docs/
   ├─ ARCHITECTURE.md         storage schema, migration, backup, export format, module map
   └─ TEST-REPORT-PHASE0.md   the Phase 0 test report
```

### Modules in `src/js/` (load order)
| File | Role | New in v6? |
|---|---|---|
| `00-core.js` | DOM helpers, state, **preferences (`ev6.` keys)**, **visibility rule `vis()`** | partly |
| `10-db.js` | **schema, versioned database, store helpers** | new |
| `15-digest.js` | **canonical JSON + SHA-256 fingerprints** | new |
| `20-migrate.js` | **read-only access to v5, dry-run, verified copy, rollback** | new |
| `30-backup.js` | **export, import/merge with validation, daily & safety backups** | new |
| `35-app-data.js` | wrappers connecting the data layer to the interface | new |
| `40-integrity.js` | **integrity checker and the 26-test self-test suite** | new |
| `50-model.js` | sanitiser, word count, index string, `load()`, `newE()` | v5 |
| `60-editor.js` | autosave/versions (`saveNow`), related entries, toolbar | v5 |
| `65-foundation-ui.js` | **migration screen, integrity/migration/self-test panels** | new |
| `70`–`78` `ui-*.js` | Study, search, plates & book, years, ledger, archive, Vault, shortcuts | v5 (17 filter calls → `vis()`; Vault additions) |
| `80-features.js` | pins, bulk actions, tags, trash, health check, exports, connection map | v5 |
| `85-ai.js` | autocorrect, optional Claude features, downloads | v5 |
| `90-init.js` | start-up: open v6 database, migration gate, then the v5 start-up sequence | changed head |

Only 24 of the 262 reused v5 lines differ from v5 (the `vis()` substitutions, three Vault edits and the start-up head).
`python3 tools/extract.py` proves this: it re-derives those modules from `reference/evermore-v5.html` and reports each as identical.

---

## 3. Build and test

```bash
npm run build          # -> dist/evermore-v6.html  (syntax check + element-id check included)
npm test               # build + 26-test self-test + 26 smoke checks
npm run verify         # the above + mutation check (needs bash; Windows: Git Bash or WSL)
```
Expected: `26/26 passed`, `26/26 smoke checks passed`, and in the mutation check every injected bug "CAUGHT" except
one documented equivalent mutant (see `docs/TEST-REPORT-PHASE0.md`).

**Important:** the Node tests use an *emulator* of IndexedDB and a stand-in sanitiser. The same 26 tests also run inside
the real page with the real browser database and sanitiser: **Vault → XII Self-test → Run self-test**. It only uses temporary
databases and never reads or writes your archive. Please run it in your own browser too.

---

## 4. Bringing in your v5 archive

v6 uses a **separate database** (`evermore-v6`). v5's database (`evermore`) is only ever *read*, never changed or deleted.

**If v5 and v6 are opened from the same address** (same origin), v6 finds the v5 database and shows
*"We found your v5 archive"*. Press **Copy my archive into v6**. It then: (1) saves a permanent safety snapshot, (2) does a dry run
into a scratch database, (3) copies for real, (4) verifies every record and photograph by SHA-256. Any mismatch empties v6 again
and v5 is left exactly as it was. Nothing is copied until you press the button.

**If your v5 archive lives somewhere else** (for example the copy hosted inside Claude), a local page cannot see it.
Browsers deliberately isolate storage per address. Use the export route:
1. In the old v5 page: **Vault → I. Export the whole archive**, and save the JSON file.
2. In v6 (welcome screen, or Vault → II): **import** that file. Import merges, validates and never deletes.

**Testing a full local migration:** `npm start` also serves `reference/evermore-v5.html` at the same origin. Open
`http://localhost:8080/evermore-v5.html`, import your JSON export there, then open `http://localhost:8080/evermore-v6.html`:
v6 will detect the v5 database and offer the verified copy.

### Recovery and rollback
* v5's data is never modified, so **v5 always still works** as a fallback.
* A safety snapshot (`kind: pre-migration`) is kept permanently in `evermore-v6-backup`. **Vault → XI** can download it.
* A failed or interrupted migration clears v6's partial data and can simply be retried.
* **Vault → XI** also has *Compare with v5* (read-only report) and *Merge newer from v5* (never deletes).

---

## 5. Backups, integrity, self-test (Vault)

| Section | What it does |
|---|---|
| I | Export the whole archive as JSON (schema 2; includes every data type and your settings) |
| II | Import / merge a JSON file (schema 1 = v5 exports, schema 2 = v6). Newer `updated` wins; nothing is deleted |
| V | Automatic backups: one per day you open Evermore, last 7 kept; safety snapshots are never rotated out |
| X | **Data integrity**: structure, indexes, links, shelves, versions, photographs, word counts, migration state. Read-only |
| XI | Migration and recovery tools |
| XII | **Self-test** (and a 10,000-entry stress test). Scratch databases only |

**Your data lives only in this browser.** Clearing site data deletes it. Export regularly and keep the JSON files somewhere safe.

---

## 6. Things to know (honest limits)

* **Fonts are the one external asset.** `src/head.html` loads Cormorant Garamond, Newsreader and Inter from Google Fonts.
  Offline (or if blocked) the app falls back to Georgia/system fonts and works fully. To self-host, download those fonts, add
  `@font-face` rules to `src/style.css` and remove the `<link>` in `src/head.html`. I could not bundle them here (no network access when this package was built).
* **Claude features** (suggest title/tags, proofread, reflect, summarise, "Ask Claude") exist only when the page is hosted inside
  Claude; locally those buttons are hidden and everything else is unchanged. Autocorrect and spellcheck work everywhere. Downloads fall back to a plain browser download plus a copy-text box.
* **Secure context:** the checksums use Web Crypto, which needs `https://` or `http://localhost`. Do not open the app over plain `http://192.168.x.x`.
* **Large archives:** migration loads the whole v5 database into memory to compare checksums. Tested to 1,500 entries in Node and designed for the in-app 10,000-entry stress test; archives with hundreds of MB of photographs are untested. Each daily backup is a full copy (7 kept).
* **What the tests do and do not prove** is spelled out in `docs/TEST-REPORT-PHASE0.md`. In short: logic and data safety are tested; layout, visuals and real-browser storage behaviour need your own check.
* There is no licence file: the package is marked `UNLICENSED` (private use) until you decide otherwise.

## 7. Status
Phase 0 (foundation) only. Phase 1 (People, Timeline of Me, Unwritten Days) has **not** been started.
