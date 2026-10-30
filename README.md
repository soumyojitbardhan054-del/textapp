# Evermore — first working version

A private, editorial-style journal website. This first version runs in your browser and stores journal entries and photographs in **IndexedDB on this device**.

## Start it

1. Download and extract `evermore-starter.zip`.
2. Open the extracted `evermore-starter` folder in Visual Studio Code.
3. In VS Code, open **Extensions** and install **Live Server** (by Ritwick Dey).
4. In the file explorer, right-click `index.html` and choose **Open with Live Server**.
5. Your browser will open Evermore.

You can also use another local static server that serves ES modules. Do not just double-click `index.html`; browsers commonly block JavaScript modules opened with a `file://` address.

## What works now

- Today page with entry and word counts.
- Create, edit, search and delete journal entries.
- Entries grouped into a year-by-year timeline.
- Add and view photographs (up to 8 MB each).
- Responsive desktop and mobile navigation.
- Journal entries and photo files stored in IndexedDB, not localStorage.

## Important: where your data lives

This is an early local prototype. Your data is stored only in this browser profile on this device. It is **not yet synced to an account or cloud**, and clearing browser site data can erase it. Do not use this as the only copy of important personal writing yet. Cloud sync, proper export/import, backups and account security are later stages.

The page loads its typefaces from Google Fonts when online. If offline, it falls back to system serif fonts.

## Project files

- `index.html` — page structure
- `css/styles.css` — visual design and responsive layout
- `js/app.js` — interface and journal behaviour
- `js/db.js` — IndexedDB storage

## Next build stages

1. Add export/import and backup before using real personal data.
2. Add goals, letters, library and reports.
3. Add authentication and private cloud storage.
4. Add offline sync, conflict handling, PWA installation and tested restore.
