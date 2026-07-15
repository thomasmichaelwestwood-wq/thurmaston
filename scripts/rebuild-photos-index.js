#!/usr/bin/env node
/**
 * Rebuilds data/photos.json (the single fast array the site actually
 * reads) from data/photos/*.json (the CMS-editable source of truth, one
 * file per photo). Run by .github/workflows/rebuild-photos-index.yml on
 * every push that touches data/photos/** — never run by hand as part of
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
 *    uploaded image's own filename, so there's always something
 *    sensible to show as the "Ref:" tag.
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

const files = fs.readdirSync(PHOTOS_DIR).filter((f) => f.endsWith(".json"));

const photos = files.map((file) => {
  const filePath = path.join(PHOTOS_DIR, file);
  const raw = fs.readFileSync(filePath, "utf8");
  let photo;
  try {
    photo = JSON.parse(raw);
  } catch (e) {
    throw new Error("Invalid JSON in data/photos/" + file + ": " + e.message);
  }

  if (!photo.addedAt) {
    photo.addedAt = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(photo, null, 2) + "\n");
  }

  photo.id = file.slice(0, -".json".length);

  if (photo.coords) {
    const coords = parseCoords(photo.coords);
    delete photo.coords;
    if (coords) Object.assign(photo, coords);
  }

  if (!photo.ref && photo.src) {
    try {
      photo.ref = decodeURIComponent(path.basename(photo.src));
    } catch (e) {
      photo.ref = path.basename(photo.src);
    }
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
