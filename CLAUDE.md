# Thurmaston village website

Static HTML/CSS/JS site (no build step) for the "Memories of Thurmaston" community site. See `PHOTOS.md` and `HOW-TO-ADD-PHOTOS.md` for the Google Drive → GitHub photo sync pipeline.

## Site structure

Three pages: `index.html` (homepage — hero banner, short intro, photo archive tiles, full historic map with all categories, shared memories, share-a-memory form), `category.html` (one template driven by `?cat=streets|people|nature|other`, showing the map and photo grid locked to a single category — linked from the homepage's photo archive tiles), and `contact.html`. There used to be a separate `memories.html`; it was merged into `index.html` so the site lands directly on that content instead of a separate homepage. Don't recreate a `memories.html` — anything that used to link there should point at `index.html` (with `#photos`, `#map`, or `#share` anchors as needed).

`js/photos.js` and `js/map.js` are shared by all pages that use them. A page sets `window.LOCKED_CATEGORY = "streets"` (etc.) in an inline `<script>` before loading `photos.js`/`map.js` to lock both to one category; `index.html` doesn't set it, so it shows everything. Don't fork these scripts per-page — extend the shared ones.

## Categorisation rule — always read from the Drive folder structure

A photo's category (`streets`, `people`, `nature`, `other`) is decided **only** by which Drive subfolder it was uploaded into — that's what `CATEGORY_FOLDERS` in `automation/drive-photo-sync.gs.js` encodes, and it's already correct in `data/photos.json`.

**Never recategorise based on what's visually in the photo.** The folder is the only signal that counts, in both directions:
- A photo uploaded to "Streets & Buildings" stays `streets` even if a person appears in it.
- A photo uploaded to "People & Events" stays `people` even if a building is visible behind them.

When adding or editing anything that assigns a category by hand (e.g. `js/map-data.js` entries for the Historic Map), copy the category straight from that photo's existing entry in `data/photos.json` rather than guessing from the subject matter.

## General rule: a photo's Drive folder decides how it's used, full stop

This applies beyond just category. Whatever folder a photo is uploaded into determines its role according to that folder's defined behaviour in `automation/drive-photo-sync.gs.js` — never assume a photo can serve double duty across folder purposes just because the same underlying file happens to sit in two folders.

Concretely: **Hero images** photos are for the homepage banner (`data/hero.json`) only. Even when the exact same Drive file is also uploaded to a category folder (so it's also in `data/photos.json`), it must not show up in the photo archive, its category tiles, or site search — `js/photos.js`'s `PHOTOS_DATA_PROMISE` filters archive photos against `data/hero.json` by filename (not full path, since the two pipelines resize the same file into different folders — `images/photos/` vs `images/hero-photos/` — under an identical filename) to enforce this. If a new dedicated folder is ever added to the sync script, give it the same treatment: figure out what "belongs only to that folder's purpose" means, and exclude it from other surfaces rather than letting it leak across by default.

## Caption cleanup — filename becomes caption, minus Dad's filing codes

Dad's Drive filenames often carry his own archival codes — a leading catalog number ("003 ...") and/or a "MOT 1-11" style reference. `cleanCaption()` in `automation/drive-photo-sync.gs.js` strips both of those (and only those) before the filename becomes a photo's public caption, e.g. "003 Generous Briton c1936 MOT1-11.jpg" → caption "Generous Briton c1936". Don't strip anything else speculatively (parenthetical notes, credit-looking words, etc.) — those are still part of his description and might be meaningful.

The untouched original filename is never discarded: it's stored verbatim in that photo's `ref` field in `data/photos.json` and shown as a small "Ref: …" tag in the lightbox (`.photo-lightbox-ref` in `js/photos.js`), and it's included in the photo search haystack too, so searching his catalog number or MOT code still finds the photo. `publishDocument` runs the same `cleanCaption`+`slugify` pipeline on document filenames, so a PDF named after its photo (with or without the same codes) still resolves to the same slug and links up correctly.

## Map pins come from two sources — don't require a manual step for either

`MAP_DATA` in `js/map-data.js` is a small hand-curated list (richer written descriptions, for pins worth a proper story). But most located photos get their `lat`/`lng` automatically, via an "@lat,lng" in the filename or a recognised place subfolder (see `KNOWN_PLACES` in `automation/drive-photo-sync.gs.js`) — those must **not** require someone to also hand-add a `map-data.js` entry, or pins silently go missing (this happened: 5 photos had coordinates, only 2 showed on the map, because 3 were never added to `MAP_DATA`).

`js/map.js` fixes this by merging `MAP_DATA` with an auto-generated pin for every other photo in `data/photos.json` that has `lat`/`lng` and isn't already covered by a curated entry (matched by `photoId`). Keep it this way — if you ever touch map pin logic, a located photo appearing on the map should never depend on a manual `map-data.js` edit.
