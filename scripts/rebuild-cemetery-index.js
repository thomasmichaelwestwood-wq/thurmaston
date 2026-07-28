#!/usr/bin/env node
/**
 * Rebuilds data/cemetery.json (the single fast array cemetery.html/
 * grave.html actually read) from data/graves/*.json (the CMS-editable
 * source of truth, one file per headstone — see the admin's "Graves"
 * collection). Run by .github/workflows/rebuild-photos-index.yml on
 * every push that touches data/graves/** — never run by hand as part
 * of normal editing, this is purely a derived file. Same shape as
 * scripts/rebuild-events-index.js.
 *
 * Sorted alphabetically by name — this is a directory people browse to
 * find someone, not a feed of what was added most recently.
 *
 * Normalises, same reasoning as rebuild-events-index.js:
 *  - id is always set to the filename (minus .json), overriding
 *    whatever's stored.
 *  - addedAt, if missing (a brand new grave entry), is backfilled with
 *    the current time and written back to the entry's own file.
 *  - pinPosition ("34.2, 56.7", percent-of-photo x/y, the same
 *    copy-paste-one-string convention as photos' own `coords` field —
 *    see rebuild-photos-index.js's parseCoords) is parsed into numeric
 *    pinX/pinY for the aggregate, so cemetery.html can position a
 *    marker with plain CSS `left`/`top` percentages without every page
 *    that reads this file needing to re-parse the string itself.
 *    admin/pin-grave.html (a standalone click-to-place tool, same
 *    "can't add a custom CMS widget" reasoning as
 *    admin/number-photo.html) is what actually produces this string —
 *    dad clicks the exact spot on the cemetery's aerial photo and
 *    pastes the result in here.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const GRAVES_DIR = path.join(ROOT, "data", "graves");
const OUTPUT = path.join(ROOT, "data", "cemetery.json");

function parsePinPosition(str) {
  const match = typeof str === "string" && str.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  return { pinX: parseFloat(match[1]), pinY: parseFloat(match[2]) };
}

if (!fs.existsSync(GRAVES_DIR)) {
  fs.writeFileSync(OUTPUT, "[]\n");
  console.log("No data/graves/ directory yet — wrote empty " + OUTPUT + ".");
  process.exit(0);
}

const files = fs.readdirSync(GRAVES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
  .map((entry) => path.join(GRAVES_DIR, entry.name));

const graves = files.map((filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  let grave;
  try {
    grave = JSON.parse(raw);
  } catch (e) {
    throw new Error("Invalid JSON in " + path.relative(ROOT, filePath) + ": " + e.message);
  }

  if (!grave.addedAt) {
    grave.addedAt = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(grave, null, 2) + "\n");
  }

  grave.id = path.basename(filePath, ".json");

  if (grave.pinPosition) {
    const pin = parsePinPosition(grave.pinPosition);
    delete grave.pinPosition;
    if (pin) Object.assign(grave, pin);
  }

  return grave;
});

graves.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

fs.writeFileSync(OUTPUT, JSON.stringify(graves, null, 2) + "\n");
console.log("Wrote " + OUTPUT + " with " + graves.length + " grave entries.");
