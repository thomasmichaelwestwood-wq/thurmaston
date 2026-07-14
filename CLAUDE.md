# Thurmaston village website

Static HTML/CSS/JS site (no build step) for the "Memories of Thurmaston" community site. See `PHOTOS.md` and `HOW-TO-ADD-PHOTOS.md` for the Google Drive → GitHub photo sync pipeline.

## Site structure

Five pages: `index.html` (homepage — hero banner, short intro, photo archive tiles, full historic map with all categories, shared memories, share-a-memory form), `category.html` (one template driven by `?cat=streets|people|nature|other`, showing the map and photo grid locked to a single category — linked from the homepage's photo archive tiles), `place.html` (one template driven by `?slug=X`, a dedicated story page for a building/place — see "Story pages" below), `contact.html`, and `admin/index.html` (the Decap CMS login/editor). There used to be a separate `memories.html`; it was merged into `index.html` so the site lands directly on that content instead of a separate homepage. Don't recreate a `memories.html` — anything that used to link there should point at `index.html` (with `#photos`, `#map`, or `#share` anchors as needed).

`js/photos.js` and `js/map.js` are shared by all pages that use them. A page sets `window.LOCKED_CATEGORY = "streets"` (etc.) in an inline `<script>` before loading `photos.js`/`map.js` to lock both to one category; `index.html` doesn't set it, so it shows everything. Don't fork these scripts per-page — extend the shared ones.

## Categorisation rule — always read from the Drive folder structure

A photo's category (`streets`, `people`, `nature`, `other`) is decided **only** by which Drive subfolder it was uploaded into — that's what `CATEGORY_FOLDERS` in `automation/drive-photo-sync.gs.js` encodes, and it's already correct in `data/photos.json`.

**Never recategorise based on what's visually in the photo.** The folder is the only signal that counts, in both directions:
- A photo uploaded to "Streets & Buildings" stays `streets` even if a person appears in it.
- A photo uploaded to "People & Events" stays `people` even if a building is visible behind them.

When adding or editing anything that assigns a category by hand (e.g. `data/map-pins.json` entries for the Historic Map), copy the category straight from that photo's existing entry in `data/photos.json` rather than guessing from the subject matter.

## General rule: a photo's Drive folder decides how it's used, full stop

This applies beyond just category. Whatever folder a photo is uploaded into determines its role according to that folder's defined behaviour in `automation/drive-photo-sync.gs.js` — never assume a photo can serve double duty across folder purposes just because the same underlying file happens to sit in two folders.

Concretely: **Hero images** photos are for the homepage banner (`data/hero.json`) only. Even when the exact same Drive file is also uploaded to a category folder (so it's also in `data/photos.json`), it must not show up in the photo archive, its category tiles, or site search — `js/photos.js`'s `PHOTOS_DATA_PROMISE` filters archive photos against `data/hero.json` by filename (not full path, since the two pipelines resize the same file into different folders — `images/photos/` vs `images/hero-photos/` — under an identical filename) to enforce this. If a new dedicated folder is ever added to the sync script, give it the same treatment: figure out what "belongs only to that folder's purpose" means, and exclude it from other surfaces rather than letting it leak across by default.

## Caption cleanup — filename becomes caption, minus Dad's filing codes

Dad's Drive filenames often carry his own archival codes — a leading catalog number ("003 ...") and/or a "MOT 1-11" style reference. `cleanCaption()` in `automation/drive-photo-sync.gs.js` strips both of those (and only those) before the filename becomes a photo's public caption, e.g. "003 Generous Briton c1936 MOT1-11.jpg" → caption "Generous Briton c1936". Don't strip anything else speculatively (parenthetical notes, credit-looking words, etc.) — those are still part of his description and might be meaningful.

The untouched original filename is never discarded: it's stored verbatim in that photo's `ref` field in `data/photos.json` and shown as a small "Ref: …" tag in the lightbox (`.photo-lightbox-ref` in `js/photos.js`), and it's included in the photo search haystack too, so searching his catalog number or MOT code still finds the photo. `publishDocument` runs the same `cleanCaption`+`slugify` pipeline on document filenames, so a PDF named after its photo (with or without the same codes) still resolves to the same slug and links up correctly.

## Map pins come from two sources — don't require a manual step for either

`data/map-pins.json` (`{ "pins": [...] }`) is a small hand-curated list, editable via the admin (richer written descriptions, for pins worth a proper story). But most located photos get their `lat`/`lng` automatically, via an "@lat,lng" in the filename or a recognised place subfolder (see `KNOWN_PLACES` in `automation/drive-photo-sync.gs.js`) — those must **not** require someone to also hand-add a curated pin, or pins silently go missing (this happened once: 5 photos had coordinates, only 2 showed on the map, because 3 were never added to the curated list).

`js/map.js` fixes this by fetching `data/map-pins.json` and merging it with an auto-generated pin for every other photo in `data/photos.json` that has `lat`/`lng` and isn't already covered by a curated entry (matched by `photoId`). Keep it this way — if you ever touch map pin logic, a located photo appearing on the map should never depend on a manual `data/map-pins.json` edit.

Curated pins store their location as one `coords` string field (e.g. `"52.679363, -1.097994"`) rather than separate `lat`/`lng` numbers — deliberately, to match the copy-paste-from-Google-Maps workflow already used for photos (right-click a spot, click the coordinates that pop up to copy). `parseCoords()` in `js/map.js` splits it back into `lat`/`lng` at load time. Photos in `data/photos.json` still use separate numeric `lat`/`lng` fields (unchanged — those come from the sync script, not hand entry).

`js/map-categories.js` holds only `MAP_CATEGORIES` (the fixed colour/label taxonomy) — that one's a genuinely static lookup table, not editorial content, so it stays as plain JS rather than a CMS-editable file.

## Story pages, and the admin (Decap CMS)

Any pin — a curated one in `data/map-pins.json`, or an ordinary auto-generated photo pin — can *optionally* link to a full dedicated page, decided individually per pin/photo (not a blanket rule). This is a deliberate, requested feature: don't default new pins to having a page, and don't remove the option to leave `pageSlug` blank.

- **`data/pages/<slug>.json`** — one file per page: `{ "title": "...", "blocks": [...] }`. Each block has a `type` of `text`, `photo`, or `document`:
  - `text`: `{ "type": "text", "text": "..." }` — rendered by `js/place.js`'s tiny built-in markdown-lite (paragraphs on blank lines, `**bold**`, `*italic*`, `[label](url)` links). Not a full markdown library on purpose — this is a static, no-build-step site, so no npm dependency was added for it. Don't casually extend the syntax without checking `renderInline`/`renderTextBlock` in `js/place.js` can actually handle it.
  - `photo`: `{ "type": "photo", "photoId": "..." }` — must match an id in `data/photos.json`; renders as a thumbnail linking to that photo's lightbox on `category.html`.
  - `document`: `{ "type": "document", "label": "...", "file": "documents/....pdf" }` — renders as a button opening the PDF in a new tab.
- **`place.html?slug=X`** fetches `data/pages/X.json` (+ `data/photos.json`, to resolve `photo` blocks) and renders it. One shared template, same pattern as `category.html?cat=X`.
- A pin/photo opts in by setting `pageSlug` to a page's slug (the filename minus `.json`). `js/map.js`'s `popupHtml()` and `js/photos.js`'s lightbox both show a "Read the full story →" link/button when `pageSlug` is set, and hide it otherwise.
- **The existing single-PDF-per-photo feature (`photo.doc`, the "View document" button) still works exactly as before** — it wasn't replaced. A photo can have a `doc`, a `pageSlug`, both, or neither; the three lightbox buttons (View on map / View document / Read full story) show independently based on what's actually present.
- **Ordinary photos currently need their `pageSlug` hand-set** in `data/photos.json` (no CMS UI for that yet — see below) — or, more practically, give that photo a proper entry in `data/map-pins.json` instead (reusing its existing `photoSrc`/`photoId` and re-pasting its coordinates as a `coords` string), which also gets it a name, a description, and a `pageSlug` field editable through the admin, and automatically suppresses the auto-generated version of that same pin (matched by `photoId`). This is also the answer for a photo that didn't get coordinates at upload time — add/fix them here rather than needing to re-upload.

**Admin: `admin/index.html` + `admin/config.yml`** is [Decap CMS](https://decapcms.org/), backed by `git-gateway` (Netlify Identity for login, saves commit straight to `main` on GitHub, no custom backend code). Two collections: `pages` (the story-page blocks editor described above) and `map_pins` (edits `data/map-pins.json`, including a `relation` field to pick a `pages` entry for `pageSlug`). `publish_mode: simple` — no draft/review step, matching the rest of the site's single-trusted-uploader approach; switch to `editorial_workflow` in `config.yml` if that ever needs to change (e.g. more admins added).

`admin/index.html` also registers a **custom live preview** for both collections (`CMS.registerPreviewTemplate`), styled with the site's real `css/style.css` (`CMS.registerPreviewStyle`) so the preview pane actually looks like the live page, updating as you type. The `pages` preview's text-block rendering (`renderTextBlockPreview`/`renderInlinePreview`) is a hand-kept-in-sync duplicate of `js/place.js`'s `renderTextBlock`/`renderInline` — it has to be a duplicate because it runs inside the CMS's preview iframe, a separate JS context that can't import that file. If you change the markdown-lite syntax in one, change it in the other.

**Edit log** — every CMS save is a git commit (that's how `git-gateway` works), so there's no separate history to maintain: `admin/index.html` adds an "Edit log" page to Decap's own sidebar (`CMS.registerAdditionalLink`) that fetches recent commits straight from GitHub's public commits API and lists message/author/date. Only reachable from inside the logged-in admin, never linked from or shown on the public site. Deliberately unfiltered (shows Drive photo syncs too, not just CMS edits) — that's more useful as a single "what changed on the site" view than a narrower one. `registerAdditionalLink` is a newer, less-documented part of Decap's API, so it's feature-checked (`typeof CMS.registerAdditionalLink === "function"`) before use — if it's missing in whatever CMS version loads, the rest of the admin still works, it just won't have this page.

This can't be tested end-to-end without the one-time Netlify Identity setup in the site owner's Netlify account (enable Identity, invite a user) — I can build and verify the config's shape and the front-end rendering, but not the actual login flow, myself.
