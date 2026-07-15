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
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PHOTOS_DIR = path.join(ROOT, "data", "photos");
const OUTPUT = path.join(ROOT, "data", "photos.json");

const files = fs.readdirSync(PHOTOS_DIR).filter((f) => f.endsWith(".json"));

const photos = files.map((file) => {
  const raw = fs.readFileSync(path.join(PHOTOS_DIR, file), "utf8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error("Invalid JSON in data/photos/" + file + ": " + e.message);
  }
});

photos.sort((a, b) => {
  const aTime = a.addedAt ? Date.parse(a.addedAt) : 0;
  const bTime = b.addedAt ? Date.parse(b.addedAt) : 0;
  return bTime - aTime;
});

fs.writeFileSync(OUTPUT, JSON.stringify(photos, null, 2) + "\n");
console.log("Wrote " + OUTPUT + " with " + photos.length + " photos.");
