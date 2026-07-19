#!/usr/bin/env node
/**
 * Rebuilds data/events.json (the single fast array events.html/event.html
 * actually read) from data/events/*.json (the CMS-editable source of
 * truth, one file per Event Page — see the admin's "Event Pages"
 * collection). Run by .github/workflows/rebuild-photos-index.yml on
 * every push that touches data/events/** — never run by hand as part
 * of normal editing, this is purely a derived file. Same idea as
 * scripts/rebuild-photos-index.js, kept as its own separate script
 * since Event Pages are a different shape (one entry = a description
 * plus a whole list of photos, not one entry per photo).
 *
 * Sorted newest-first by addedAt, same convention as data/photos.json.
 *
 * Normalises two things, same reasoning as rebuild-photos-index.js:
 *  - id is always set to the filename (minus .json), overriding
 *    whatever's stored.
 *  - coords ("52.679363, -1.097994") is parsed into numeric lat/lng
 *    for the aggregate, so js/map.js can plot an Event Page exactly
 *    like it already does a photo or a curated map pin.
 *  - addedAt, if missing (a brand new Event Page), is backfilled with
 *    the current time and written back to the entry's own file — not
 *    just the aggregate — so it's set once and stays stable across
 *    later rebuilds.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const EVENTS_DIR = path.join(ROOT, "data", "events");
const OUTPUT = path.join(ROOT, "data", "events.json");

function parseCoords(str) {
  const match = typeof str === "string" && str.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
}

if (!fs.existsSync(EVENTS_DIR)) {
  fs.writeFileSync(OUTPUT, "[]\n");
  console.log("No data/events/ directory yet — wrote empty " + OUTPUT + ".");
  process.exit(0);
}

const files = fs.readdirSync(EVENTS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
  .map((entry) => path.join(EVENTS_DIR, entry.name));

const events = files.map((filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  let event;
  try {
    event = JSON.parse(raw);
  } catch (e) {
    throw new Error("Invalid JSON in " + path.relative(ROOT, filePath) + ": " + e.message);
  }

  if (!event.addedAt) {
    event.addedAt = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(event, null, 2) + "\n");
  }

  event.id = path.basename(filePath, ".json");
  event.photos = Array.isArray(event.photos) ? event.photos : [];

  if (event.coords) {
    const coords = parseCoords(event.coords);
    delete event.coords;
    if (coords) Object.assign(event, coords);
  }

  return event;
});

events.sort((a, b) => {
  const aTime = a.addedAt ? Date.parse(a.addedAt) : 0;
  const bTime = b.addedAt ? Date.parse(b.addedAt) : 0;
  return bTime - aTime;
});

fs.writeFileSync(OUTPUT, JSON.stringify(events, null, 2) + "\n");
console.log("Wrote " + OUTPUT + " with " + events.length + " event pages.");
