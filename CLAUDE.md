# Thurmaston village website

Static HTML/CSS/JS site (no build step) for the "Memories of Thurmaston" community site. See `PHOTOS.md` and `HOW-TO-ADD-PHOTOS.md` for the Google Drive → GitHub photo sync pipeline.

## Categorisation rule — always read from the Drive folder structure

A photo's category (`streets`, `people`, `nature`, `other`) is decided **only** by which Drive subfolder it was uploaded into — that's what `CATEGORY_FOLDERS` in `automation/drive-photo-sync.gs.js` encodes, and it's already correct in `data/photos.json`.

**Never recategorise based on what's visually in the photo.** The folder is the only signal that counts, in both directions:
- A photo uploaded to "Streets & Buildings" stays `streets` even if a person appears in it.
- A photo uploaded to "People & Events" stays `people` even if a building is visible behind them.

When adding or editing anything that assigns a category by hand (e.g. `js/map-data.js` entries for the Historic Map), copy the category straight from that photo's existing entry in `data/photos.json` rather than guessing from the subject matter.
