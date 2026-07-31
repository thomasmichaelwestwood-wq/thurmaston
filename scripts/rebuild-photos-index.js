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
 *
 *    ref also re-syncs to match a *replaced* photo, using a second
 *    hidden field (refSource) that records which filename ref was last
 *    auto-generated from. Why this exists: duplicating an entry in the
 *    CMS (to reuse a similar photo's fields) copies ref's value as-is,
 *    including into an entry whose photo is then swapped for a
 *    completely different upload — without refSource, that duplicated
 *    entry would keep showing the ORIGINAL photo's ref forever, since
 *    "only fill in if blank" never fires once a value already exists.
 *    ref is only auto-refreshed when it still equals its own
 *    refSource — i.e. nothing has touched it by hand since it was last
 *    machine-generated — so a genuinely hand-typed ref (e.g. "014
 *    Garden Centre" instead of a raw filename) is never overwritten.
 *
 * data/events/*.json (a whole occasion, description plus several
 * photos in one entry — see the "Event Pages" admin collection) is a
 * separate concept with its own aggregate and its own rebuild script,
 * scripts/rebuild-events-index.js — not handled here.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PHOTOS_DIR = path.join(ROOT, "data", "photos");
const IMAGES_DIR = path.join(ROOT, "images", "photos");
const OUTPUT = path.join(ROOT, "data", "photos.json");

// Matches a photo's own src, e.g. "/images/photos/aerial/foo.jpg" —
// used to find and relocate the actual image file alongside its JSON
// (see the Category-mismatch block below).
const SRC_PATTERN = /^\/images\/photos\/([^/]+)\/([^/]+)$/;

// Matches admin/config.yml's 12 photos_* collection folders exactly —
// the only categories a photo's Category field (a select dropdown,
// not free text) could ever actually contain.
const KNOWN_CATEGORIES = new Set([
  "aerial", "churches", "events", "groups", "industry", "maps",
  "nature", "other", "people", "schools", "sports", "streets"
]);

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

  // A photo's Category is a normal editable dropdown in the admin (see
  // admin/config.yml) — the subfolder it happens to sit in is otherwise
  // only an organisational convenience for browsing collections there,
  // never something the front end reads (the aggregate below always
  // uses photo.category directly). If someone corrects a misfiled
  // photo's Category and saves, this is what actually relocates its
  // file to match — otherwise the live site would already be right
  // (it only ever reads the field) but the admin's own collection tabs
  // would silently keep showing it under the wrong one forever. Skips
  // silently, rather than overwriting, on the near-impossible chance a
  // same-named file already exists at the destination.
  let dirty = false;
  const currentCategory = path.relative(PHOTOS_DIR, filePath).split(path.sep)[0];
  if (photo.category && KNOWN_CATEGORIES.has(photo.category) && photo.category !== currentCategory) {
    const targetDir = path.join(PHOTOS_DIR, photo.category);
    fs.mkdirSync(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, path.basename(filePath));
    if (fs.existsSync(targetPath)) {
      console.warn("Skipping relocate for " + path.relative(ROOT, filePath) + " — a file already exists at " + path.relative(ROOT, targetPath));
    } else {
      fs.renameSync(filePath, targetPath);
      console.log("Relocated " + path.relative(ROOT, filePath) + " -> " + path.relative(ROOT, targetPath) + " (Category field said \"" + photo.category + "\")");
      filePath = targetPath;
    }
  }

  // The actual image file moves too, not just the JSON — a photo whose
  // Category was corrected used to leave its image sitting in the old
  // category's folder forever (src is "just a URL," so it still
  // worked), but that meant this one recategorised photo silently
  // looked inconsistent with every other photo on the site, where the
  // image and its category always do match — confusing to notice and
  // impossible to explain to someone non-technical. Parsed straight
  // from the photo's own `src` (not from the JSON's folder above,
  // which may already have moved this same run) so this still works
  // even if the two ever get out of step with each other.
  if (photo.category && KNOWN_CATEGORIES.has(photo.category) && typeof photo.src === "string") {
    const srcMatch = photo.src.match(SRC_PATTERN);
    if (srcMatch && srcMatch[1] !== photo.category) {
      const [, srcCategory, filename] = srcMatch;
      const sourceImagePath = path.join(IMAGES_DIR, srcCategory, filename);
      const targetImageDir = path.join(IMAGES_DIR, photo.category);
      const targetImagePath = path.join(targetImageDir, filename);
      if (!fs.existsSync(sourceImagePath)) {
        console.warn("Skipping image relocate for " + path.relative(ROOT, filePath) + " — expected image not found at " + path.relative(ROOT, sourceImagePath));
      } else if (fs.existsSync(targetImagePath)) {
        console.warn("Skipping image relocate for " + path.relative(ROOT, sourceImagePath) + " — a file already exists at " + path.relative(ROOT, targetImagePath));
      } else {
        fs.mkdirSync(targetImageDir, { recursive: true });
        fs.renameSync(sourceImagePath, targetImagePath);
        photo.src = "/images/photos/" + photo.category + "/" + filename;
        dirty = true;
        console.log("Relocated image " + path.relative(ROOT, sourceImagePath) + " -> " + path.relative(ROOT, targetImagePath));
      }
    }
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
  if (!photo.addedAt) {
    photo.addedAt = new Date().toISOString();
    dirty = true;
  }
  if (typeof photo.src === "string") {
    let derivedRef;
    try {
      derivedRef = decodeURIComponent(path.basename(photo.src));
    } catch (e) {
      derivedRef = path.basename(photo.src);
    }
    if (!photo.ref) {
      // Brand-new entry (or a genuinely blank ref) — fill both in.
      photo.ref = derivedRef;
      photo.refSource = derivedRef;
      dirty = true;
    } else if (photo.refSource && photo.ref === photo.refSource && derivedRef !== photo.refSource) {
      // ref still matches what it was last machine-generated from, so
      // nobody's hand-edited it since — safe to re-sync to whatever
      // photo is actually here now (the duplicate-then-replace case).
      photo.ref = derivedRef;
      photo.refSource = derivedRef;
      dirty = true;
    } else if (!photo.refSource && photo.ref === derivedRef) {
      // A pre-existing entry from before refSource existed, whose ref
      // already happens to match its own filename — it was auto-filled
      // under the old rule, not hand-typed, so it's safe to backfill
      // refSource retroactively (lets a future photo swap on this same
      // entry be caught next time). If ref does NOT match, treat it as
      // a hand-typed value and leave both fields alone.
      photo.refSource = derivedRef;
      dirty = true;
    }
  }
  if (dirty) {
    fs.writeFileSync(filePath, JSON.stringify(photo, null, 2) + "\n");
  }

  photo.id = path.basename(filePath, ".json");

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
