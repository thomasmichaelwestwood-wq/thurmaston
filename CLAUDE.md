# Thurmaston village website

Static HTML/CSS/JS site (no build step) for the "Memories of Thurmaston" community site. See `PHOTOS.md` and `HOW-TO-ADD-PHOTOS.md` for the Google Drive → GitHub photo sync pipeline.

## Site structure

Two pages only: `index.html` (the whole site — hero banner, photo archive, historic map, shared memories, share-a-memory form) and `contact.html`. There used to be a separate `memories.html`; it was merged into `index.html` so the site lands directly on that content instead of a separate homepage. Don't recreate a `memories.html` — anything that used to link there should point at `index.html` (with `#photos`, `#map`, or `#share` anchors as needed).

## Categorisation rule — always read from the Drive folder structure

A photo's category (`streets`, `people`, `nature`, `other`) is decided **only** by which Drive subfolder it was uploaded into — that's what `CATEGORY_FOLDERS` in `automation/drive-photo-sync.gs.js` encodes, and it's already correct in `data/photos.json`.

**Never recategorise based on what's visually in the photo.** The folder is the only signal that counts, in both directions:
- A photo uploaded to "Streets & Buildings" stays `streets` even if a person appears in it.
- A photo uploaded to "People & Events" stays `people` even if a building is visible behind them.

When adding or editing anything that assigns a category by hand (e.g. `js/map-data.js` entries for the Historic Map), copy the category straight from that photo's existing entry in `data/photos.json` rather than guessing from the subject matter.

## General rule: a photo's Drive folder decides how it's used, full stop

This applies beyond just category. Whatever folder a photo is uploaded into determines its role according to that folder's defined behaviour in `automation/drive-photo-sync.gs.js` — never assume a photo can serve double duty across folder purposes just because the same underlying file happens to sit in two folders.

Concretely: **Hero images** photos are for the homepage banner (`data/hero.json`) only. Even when the exact same Drive file is also uploaded to a category folder (so it's also in `data/photos.json`), it must not show up in the photo archive, its category tiles, or site search — `js/photos.js`'s `PHOTOS_DATA_PROMISE` filters archive photos against `data/hero.json` by filename (not full path, since the two pipelines resize the same file into different folders — `images/photos/` vs `images/hero-photos/` — under an identical filename) to enforce this. If a new dedicated folder is ever added to the sync script, give it the same treatment: figure out what "belongs only to that folder's purpose" means, and exclude it from other surfaces rather than letting it leak across by default.
