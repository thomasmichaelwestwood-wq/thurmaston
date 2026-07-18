#!/usr/bin/env node
/**
 * Rebuilds data/photos.json (the single fast array the site actually
 * reads) from data/photos/<category>/*.json (the CMS-editable source of
 * truth, one file per photo, one subfolder per category — matching the
 * admin's six category collections and the images/photos/<category>/
 * layout). Run by .github/workflows/rebuild-photos-index.yml on every
 * push that touches data/photos/** — never run by hand as part of
 * normal editing, this is purely a derived file.
 *
 * Sorted newest-first by addedAt, matching the archive grid's existing
 * "newest first" assumption (see PREVIEW_COUNT in js/photos.js).
 *
 * Also normalises three things so the per-file schema can stay simple
 * (and the CMS form stays easy to fill in) without changing the shape
 * the front-end has always read:
 *  - id is always set to the filename (minus .json), overriding
 *    whatever's stored — this is the one thing the Photos CMS
 *    collection can't sensibly let someone type by hand, so it's
 *    treated as derived rather than trusted from the file.
 *  - coords ("52.679363, -1.097994", the same copy-paste-from-
 *    Google-Maps format data/map-pins.json's curated pins already use)
 *    is parsed into numeric lat/lng for the aggregate — the one place
 *    a human types a location, but photos.js/map.js still just see
 *    plain numbers like before.
 *  - addedAt, if missing (a photo added through the CMS, where it's
 *    fine to leave blank), is backfilled with the current time and
 *    written back to the photo's own file — not just the aggregate —
 *    so it's set once, stays stable across later rebuilds, and a
 *    freshly added photo reliably sorts as the newest.
 *  - ref, if left blank (the normal case for a photo added straight
 *    through the CMS rather than synced from Drive), defaults to the
 *    uploaded image's own filename and is written back to the photo's
 *    own file, same as addedAt above — so there's always something
 *    sensible to show as the "Ref:" tag, AND the admin's own
 *    "Internal — reference code" field shows it next time that photo
 *    is reopened, instead of looking blank forever until someone
 *    fills it in by hand.
 *  - eventName/eventYear (Events category only) are derived from the
 *    photo's own nested folder path (data/photos/events/<event>/<year>/,
 *    filed via the admin's "Event / Year folder" box) — NOT written
 *    back to the file, unlike the two above, since the folder itself
 *    is the source of truth and re-deriving it fresh every rebuild is
 *    what lets moving a photo to a different folder actually change
 *    its grouping on the site.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PHOTOS_DIR = path.join(ROOT, "data", "photos");
const OUTPUT = path.join(ROOT, "data", "photos.json");

function parseCoords(str) {
  const match = typeof str === "string" && str.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
}

// One subfolder per category (data/photos/streets/, data/photos/people/,
// etc) — walked recursively rather than assumed, so an extra level of
// nesting added later wouldn't silently go unindexed.
function findJsonFiles(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findJsonFiles(full));
    } else if (entry.name.endsWith(".json")) {
      results.push(full);
    }
  }
  return results;
}

const files = findJsonFiles(PHOTOS_DIR);

const photos = files.map((filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  let photo;
  try {
    photo = JSON.parse(raw);
  } catch (e) {
    throw new Error("Invalid JSON in " + path.relative(ROOT, filePath) + ": " + e.message);
  }

  // Both of these get written back to the photo's own file (not just
  // the in-memory copy used for the aggregate below) so a value
  // computed once here shows up next time the photo is opened in the
  // admin too — otherwise the CMS form's "leave blank, it fills itself
  // in automatically" hints are only true for the live site, not for
  // what an editor actually sees when they reopen that entry. Must
  // happen before the coords -> lat/lng conversion further down, which
  // is aggregate-only and would corrupt the per-file schema (the CMS's
  // Coordinates field expects a "lat, lng" string, not split numbers)
  // if it ever leaked into a write-back.
  let dirty = false;
  if (!photo.addedAt) {
    photo.addedAt = new Date().toISOString();
    dirty = true;
  }
  if (!photo.ref && photo.src) {
    try {
      photo.ref = decodeURIComponent(path.basename(photo.src));
    } catch (e) {
      photo.ref = path.basename(photo.src);
    }
    dirty = true;
  }
  if (dirty) {
    fs.writeFileSync(filePath, JSON.stringify(photo, null, 2) + "\n");
  }

  photo.id = path.basename(filePath, ".json");

  // Events only: same "the folder decides, not a typed field" rule
  // category itself already follows (see CLAUDE.md's "Categorisation
  // rule") — a photo filed under data/photos/events/<event>/<year>/
  // (via the admin's nested Events collection, "Event / Year folder")
  // belongs to that named, recurring event and that year, full stop.
  // Purely derived from where the file actually lives, same as `id`
  // above — never written back to the file itself, so moving a photo
  // to a different folder later is always what changes its grouping,
  // with nothing stale left behind to contradict it.
  if (photo.category === "events") {
    const nestedSegments = path.relative(PHOTOS_DIR, filePath).split(path.sep).slice(1, -1);
    if (nestedSegments.length > 0) {
      photo.eventName = nestedSegments[0];
      if (nestedSegments.length > 1 && /^\d{4}$/.test(nestedSegments[1])) {
        photo.eventYear = parseInt(nestedSegments[1], 10);
      }
    }
  }

  if (photo.coords) {
    const coords = parseCoords(photo.coords);
    delete photo.coords;
    if (coords) Object.assign(photo, coords);
  }

  return photo;
});

photos.sort((a, b) => {
  const aTime = a.addedAt ? Date.parse(a.addedAt) : 0;
  const bTime = b.addedAt ? Date.parse(b.addedAt) : 0;
  return bTime - aTime;
});

fs.writeFileSync(OUTPUT, JSON.stringify(photos, null, 2) + "\n");
console.log("Wrote " + OUTPUT + " with " + photos.length + " photos.");
