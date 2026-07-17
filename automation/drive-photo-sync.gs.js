/**
 * Thurmaston Village — Google Drive → GitHub photo sync
 *
 * Watches the "Memories of Thurmaston Photos" Drive folder. Any image
 * dropped into one of its six category subfolders (Streets &
 * Buildings, People, Events, Nature & Views, Aerial, Other) is
 * automatically resized down to a sensible web size, committed into
 * the site repo, and added to the photo archive — no chat session, no
 * manual step, runs on its own.
 *
 * Optionally, a photo can also be placed on the site's interactive
 * Interactive Map: inside a category folder, create a further subfolder
 * named after a recognised village landmark (see KNOWN_PLACES below)
 * and drop the photo there instead of loose in the category folder.
 * Photos not in a recognised place folder just don't get a map pin —
 * that's the normal case, most old photos won't have a known spot.
 *
 * This file lives in the site repo for reference and version history.
 * The version that actually runs lives in Google Apps Script (see setup
 * below) — copy this file's contents there.
 *
 * ---------------------------------------------------------------------
 * ONE-TIME SETUP
 * ---------------------------------------------------------------------
 * 1. While logged into the Google account that owns (or can see) the
 *    Drive folder, go to https://script.google.com → New project.
 * 2. Delete the default code and paste in this whole file.
 * 3. Project Settings (gear icon, left sidebar) → Script Properties →
 *    add these four:
 *
 *      DRIVE_FOLDER_ID   1-vwsTyhNPaCtQ9aWyif4vxEV_O-paMH-
 *      GITHUB_TOKEN      (see below)
 *      GITHUB_OWNER      thomasmichaelwestwood-wq
 *      GITHUB_REPO       thurmaston
 *
 *    For GITHUB_TOKEN: on github.com, go to Settings → Developer
 *    settings → Personal access tokens → Fine-grained tokens →
 *    Generate new token. Set "Repository access" to only the
 *    "thurmaston" repo, and under Permissions grant "Contents:
 *    Read and write". Paste the generated token into this script
 *    property — never into a chat, an email, or committed to the repo.
 *
 * 4. Inside the "Memories of Thurmaston Photos" Drive folder, create
 *    seven subfolders, spelled exactly:
 *      "Streets & Buildings", "People", "Events", "Nature & Views", "Aerial", "Other", "Hero images"
 *    (If you already have an old "People & Events" folder from before
 *    it was split in two: rename it to "People", then create a new
 *    "Events" folder alongside it for anything more about an
 *    occasion/gathering than a specific person. The sync script still
 *    understands the old "People & Events" name too, so nothing breaks
 *    if you haven't got round to the rename yet — but new uploads
 *    there will keep going into "People" until you do.)
 *    Each subfolder (and the top-level folder itself) needs sharing set
 *    to "Anyone with the link" so the resize step below can fetch the
 *    image — file contents never become public any other way, since
 *    the only thing that uses that link is this script, briefly,
 *    during resizing.
 *
 * 5. Triggers (clock icon, left sidebar) → Add Trigger →
 *      Function: syncPhotos
 *      Event source: Time-driven
 *      Type: Minutes timer, Every 5 minutes
 *
 * 6. Run `syncPhotos` once manually from the editor (the ▷ Run button)
 *    to grant the script permission to read Drive and call external
 *    URLs. After that it runs unattended on the 5-minute trigger.
 * ---------------------------------------------------------------------
 *
 * HOW A PHOTO BECOMES SEARCHABLE AND SHOWS ON THE MAP
 * ---------------------------------------------------------------------
 * Searchable: automatic, no extra step — but name the file
 * descriptively before uploading (e.g. "Old forge on Melton Road
 * 1960s.jpg", not "IMG_4213.jpg"). The filename becomes the caption,
 * and the caption is what search matches against.
 *
 * Dad's own filing habits (a leading catalog number like "003 ", or a
 * "MOT 1-11" style reference code) don't need to be stripped before
 * uploading — cleanCaption() below removes both automatically so the
 * public caption stays tidy (e.g. "003 Generous Briton c1936 MOT1-11"
 * becomes "Generous Briton c1936"). Nothing is lost: the exact original
 * filename is kept as the photo's "ref" field and shown as a small
 * reference tag when the photo is opened, so his numbering still maps
 * back to the physical prints/albums.
 *
 * On the map: two ways, either works —
 *
 * 1. Precise: put "@lat,lng" anywhere in the filename, e.g.
 *      "Manor Hotel @52.6812,-1.0968.jpg"
 *    Find coordinates by right-clicking the spot on Google Maps (or,
 *    for something very small and precise like a grave plot, look it
 *    up on what3words.com/map — it shows the lat/lng alongside the
 *    3-word address). The "@lat,lng" part is stripped out of the
 *    caption automatically, so it never shows up in the text.
 *
 * 2. Approximate: drop the photo in a place-named subfolder that
 *    matches KNOWN_PLACES below (case-insensitive) instead of loose in
 *    the category folder. Good for "somewhere on this street" — not
 *    precise, but better than nothing. To add a new recognised place,
 *    add an entry to KNOWN_PLACES with its approximate coordinates and
 *    re-save the script.
 *
 * If a filename has an "@lat,lng", that always wins over the folder's
 * approximate place. Neither one present just means no map pin —
 * that's the normal case for most old photos.
 * ---------------------------------------------------------------------
 *
 * THE HOMEPAGE HERO BANNER
 * ---------------------------------------------------------------------
 * Drop photos into the "Hero images" subfolder and they become the rotating
 * banner slides at the top of the homepage, replacing the placeholder
 * illustrations there now. Any number of photos works — the banner just
 * cycles through however many are in data/hero.json. There's no
 * category, map location, or document support for these; they're just
 * a straight photo → caption → slide pipeline. Name them the same way
 * as any other photo — the filename becomes the caption shown in the
 * corner of the slide.
 *
 * A photo already synced from a category folder can also be added to
 * Hero images to reuse it as a banner slide — Drive lets the same file
 * live in two folders at once, and this script tracks "already synced
 * to the archive" and "already synced as a hero slide" separately, so
 * one doesn't block the other.
 * ---------------------------------------------------------------------
 *
 * BACKUP TO GOOGLE DRIVE
 * ---------------------------------------------------------------------
 * The photos themselves are always safe in Drive — they started there.
 * What's NOT safe anywhere except GitHub is the editorial work done on
 * top of them: cleaned captions, locations, written history, map pin
 * descriptions, story page text. backupToDrive() is a one-way, GitHub →
 * Drive safety net for exactly that: it reads the live data/photos.json,
 * data/map-pins.json, and every data/pages/*.json file from the repo,
 * and writes them into a Google Sheet ("Memories of Thurmaston — site
 * backup") inside this same Drive folder, overwriting it each run.
 *
 * This is a backup, not a second copy to work from — editing the sheet
 * does nothing to the live site, and the next run overwrites whatever
 * you typed there. If GitHub ever became unavailable, this sheet is
 * what you'd read the site's editorial content back from by hand.
 *
 * Setup (in addition to the syncPhotos trigger above): Triggers → Add
 * Trigger → Function: backupToDrive → Event source: Time-driven → Type:
 * Day timer → pick any time (e.g. 2am–3am). Once a day is plenty for a
 * backup — no need to match the 5-minute sync cadence. The first run
 * asks for one more permission (Google Sheets) alongside the Drive/
 * external-URL ones already granted; approve it the same way.
 * ---------------------------------------------------------------------
 */

var CATEGORY_FOLDERS = {
  "Streets & Buildings": "streets",
  // "People & Events" is being split into two folders, "People" and
  // "Events" — keeping the old name mapped too so nothing is silently
  // miscategorised as "Other" in the gap before that Drive folder is
  // actually renamed/split by hand.
  "People & Events": "people",
  "People": "people",
  "Events": "events",
  "Nature & Views": "nature",
  "Aerial": "aerial",
  "Other": "other"
};

var KNOWN_PLACES = {
  "melton road": { lat: 52.6800, lng: -1.0973 },
  "st michael's church": { lat: 52.6779, lng: -1.0958 },
  "elizabeth park": { lat: 52.6810, lng: -1.0940 },
  "watermead country park": { lat: 52.6760, lng: -1.1030 },
  "river soar": { lat: 52.6755, lng: -1.1010 }
};

var MAX_DIMENSION = 1600; // longest edge, in pixels, for published photos
var HERO_MAX_DIMENSION = 2000; // hero banner slides are shown large, full-width
var JPEG_QUALITY = 82;
var HERO_FOLDER_NAME = "Hero images";

function syncPhotos() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty("DRIVE_FOLDER_ID");
  var token = props.getProperty("GITHUB_TOKEN");
  var owner = props.getProperty("GITHUB_OWNER");
  var repo = props.getProperty("GITHUB_REPO");

  var processed = JSON.parse(props.getProperty("PROCESSED_IDS") || "[]");
  var processedSet = {};
  processed.forEach(function (id) { processedSet[id] = true; });

  // Tracked separately from the set above: a photo already synced into
  // the archive from a category folder can also be dropped into Hero
  // images to reuse it as a banner slide — the two pipelines shouldn't
  // block each other just because they share the same underlying file.
  var processedHero = JSON.parse(props.getProperty("PROCESSED_HERO_IDS") || "[]");
  var processedHeroSet = {};
  processedHero.forEach(function (id) { processedHeroSet[id] = true; });

  var root = DriveApp.getFolderById(folderId);
  var newIds = [];
  var newHeroIds = [];

  // Root-level photos (no category chosen) default to "other", no place.
  scanFolder(root, "other", null);

  var subfolders = root.getFolders();
  while (subfolders.hasNext()) {
    var sub = subfolders.next();

    if (sub.getName() === HERO_FOLDER_NAME) {
      scanHeroFolder(sub);
      continue;
    }

    var category = CATEGORY_FOLDERS[sub.getName()] || "other";
    scanFolder(sub, category, null);

    var placeFolders = sub.getFolders();
    while (placeFolders.hasNext()) {
      var placeFolder = placeFolders.next();
      var place = KNOWN_PLACES[placeFolder.getName().toLowerCase().trim()] || null;
      scanFolder(placeFolder, category, place);
    }
  }

  function scanHeroFolder(folder) {
    var imageFiles = [];
    var files = folder.getFiles();
    while (files.hasNext()) {
      var file = files.next();
      if (processedHeroSet[file.getId()]) continue;

      var mime = file.getMimeType();
      if (mime === "image/jpeg" || mime === "image/png") imageFiles.push(file);
    }

    imageFiles.forEach(function (file) {
      try {
        publishHeroImage(file, token, owner, repo);
        newHeroIds.push(file.getId());
      } catch (e) {
        Logger.log("Failed to publish hero image " + file.getName() + ": " + e);
      }
    });
  }

  function scanFolder(folder, category, place) {
    var imageFiles = [];
    var files = folder.getFiles();
    while (files.hasNext()) {
      var file = files.next();
      if (processedSet[file.getId()]) continue;

      var mime = file.getMimeType();
      if (mime === "image/jpeg" || mime === "image/png") imageFiles.push(file);
    }

    imageFiles.forEach(function (file) {
      try {
        publishPhoto(file, category, place, token, owner, repo);
        newIds.push(file.getId());
      } catch (e) {
        Logger.log("Failed to publish " + file.getName() + ": " + e);
      }
    });
  }

  if (newIds.length > 0) {
    props.setProperty("PROCESSED_IDS", JSON.stringify(processed.concat(newIds)));
  }
  if (newHeroIds.length > 0) {
    props.setProperty("PROCESSED_HERO_IDS", JSON.stringify(processedHero.concat(newHeroIds)));
  }
}

function publishPhoto(file, category, place, token, owner, repo) {
  var rawName = file.getName();
  var ext = ".jpg"; // resized output is always re-encoded as JPEG
  var base = rawName.replace(/\.(jpe?g|png)$/i, "");

  // A precise "@lat,lng" in the filename always overrides the
  // folder-based approximate place.
  var coordMatch = base.match(/@\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (coordMatch) {
    place = { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };
    base = base.slice(0, coordMatch.index) + base.slice(coordMatch.index + coordMatch[0].length);
  }

  var caption = cleanCaption(base);
  var slug = slugify(caption);
  var shortId = file.getId().slice(0, 8);
  var filename = shortId + "-" + slug + ext;
  var repoPath = "images/photos/" + filename;

  var blob = resizeViaProxy(file);
  var base64 = Utilities.base64Encode(blob.getBytes());

  ghPut(repoPath, base64, "Add photo: " + rawName, token, owner, repo);
  appendMetadataEntry(shortId, slug, filename, caption, rawName, category, place, token, owner, repo);
}

/**
 * Strips Dad's internal filing codes out of a filename to get a clean,
 * public-facing caption:
 *  - a leading catalog number, e.g. "003 " or "233_"
 *  - a "MOT <n>-<n>" style reference code, anywhere in the name
 * Neither is lost — the untouched original filename is kept as the
 * photo's "ref" field and shown as a small reference tag when the photo
 * is opened, so Dad's own numbering system stays traceable.
 */
function cleanCaption(base) {
  var text = base;
  text = text.replace(/^\d+[\s._-]+/, "");
  text = text.replace(/\s*\bMOT[\s.-]*\d+(?:[\s-]+\d+)*\b\s*/i, " ");
  text = text.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text) text = base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/**
 * Publishes a photo from the "Hero images" folder straight to the homepage
 * banner rotation — no category, map location, or document matching,
 * just a resized image and a caption appended to data/hero.json.
 */
function publishHeroImage(file, token, owner, repo) {
  var rawName = file.getName();
  var base = rawName.replace(/\.(jpe?g|png)$/i, "");
  var caption = cleanCaption(base);

  var slug = slugify(caption);
  var shortId = file.getId().slice(0, 8);
  var filename = shortId + "-" + slug + ".jpg";
  var repoPath = "images/hero-photos/" + filename;

  var blob = resizeViaProxy(file, HERO_MAX_DIMENSION);
  var base64 = Utilities.base64Encode(blob.getBytes());

  ghPut(repoPath, base64, "Add hero photo: " + rawName, token, owner, repo);
  appendHeroEntry(repoPath, caption, token, owner, repo);
}

function appendHeroEntry(repoPath, caption, token, owner, repo) {
  var dataPath = "data/hero.json";
  var current = ghGet(dataPath, token, owner, repo);
  var heroPhotos = JSON.parse(
    Utilities.newBlob(Utilities.base64Decode(current.content), "text/plain").getDataAsString()
  );

  heroPhotos.push({ src: repoPath, caption: caption });
  var updated = JSON.stringify(heroPhotos, null, 2) + "\n";

  ghPut(
    dataPath,
    Utilities.base64Encode(Utilities.newBlob(updated).getBytes()),
    "Add hero photo entry: " + caption,
    token, owner, repo, current.sha
  );
}

/**
 * Apps Script has no built-in image-resize API, so this hands the job
 * to wsrv.nl (a free, widely used image resizing proxy) — it fetches
 * the Drive file by its share link, returns a resized/compressed JPEG.
 * The Drive link is only ever used transiently by this one request; it
 * is never linked to from the live site. If the proxy call fails for
 * any reason, the original file is published unresized rather than
 * blocking the sync — a slightly larger photo beats a broken pipeline.
 */
function resizeViaProxy(file, maxDimension) {
  var dimension = maxDimension || MAX_DIMENSION;
  try {
    var sourceUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();
    var proxyUrl = "https://wsrv.nl/?url=" + encodeURIComponent(sourceUrl) +
      "&w=" + dimension + "&h=" + dimension + "&fit=inside" +
      "&output=jpg&q=" + JPEG_QUALITY;
    var res = UrlFetchApp.fetch(proxyUrl, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error("proxy returned " + res.getResponseCode());
    return res.getBlob();
  } catch (e) {
    Logger.log("Resize skipped, publishing original: " + e);
    return file.getBlob();
  }
}

/**
 * Writes the new photo straight to its own data/photos/<id>.json file —
 * the CMS-editable source of truth — rather than the old read-whole-
 * array-then-write-it-back approach. A GitHub Actions workflow
 * (.github/workflows/rebuild-photos-index.yml) regenerates the fast
 * data/photos.json aggregate the live site reads whenever this changes,
 * so nothing else here needs to touch that file directly. addedAt
 * drives that rebuild's newest-first sort order.
 */
function appendMetadataEntry(shortId, slug, filename, caption, ref, category, place, token, owner, repo) {
  var id = shortId + "-" + slug;
  var dataPath = "data/photos/" + id + ".json";

  var entry = {
    id: id,
    src: "/images/photos/" + filename,
    caption: caption,
    ref: ref,
    category: category,
    date: "Added " + Utilities.formatDate(new Date(), "Europe/London", "MMMM yyyy"),
    credit: "Unknown — needs a credit",
    consentNoted: false
  };
  if (place) {
    // Same "lat, lng" string format as data/map-pins.json's curated
    // pins and the Photos admin collection's "Google Maps coordinates"
    // field, so a human editing this entry later sees the same thing
    // they'd type themselves — see rebuild-photos-index.js, which
    // parses this back into numeric lat/lng for the site to read.
    entry.coords = place.lat + ", " + place.lng;
  }
  entry.addedAt = Utilities.formatDate(new Date(), "Etc/UTC", "yyyy-MM-dd'T'HH:mm:ss'Z'");

  var updated = JSON.stringify(entry, null, 2) + "\n";

  ghPut(
    dataPath,
    Utilities.base64Encode(Utilities.newBlob(updated).getBytes()),
    "Add photo entry: " + filename,
    token, owner, repo
  );
}

function ghGet(path, token, owner, repo) {
  var url = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path;
  var res = UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" }
  });
  return JSON.parse(res.getContentText());
}

function ghPut(path, base64Content, message, token, owner, repo, sha) {
  var url = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path;
  var payload = { message: message, content: base64Content, branch: "main" };
  if (sha) payload.sha = sha;
  UrlFetchApp.fetch(url, {
    method: "put",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" },
    payload: JSON.stringify(payload)
  });
}

/**
 * One-way GitHub → Drive backup of the site's editorial data. See the
 * "BACKUP TO GOOGLE DRIVE" comment near the top of this file. Safe to
 * run as often as you like — each run just overwrites the same sheet
 * with whatever's currently live on GitHub.
 */
function backupToDrive() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty("GITHUB_TOKEN");
  var owner = props.getProperty("GITHUB_OWNER");
  var repo = props.getProperty("GITHUB_REPO");
  var folderId = props.getProperty("DRIVE_FOLDER_ID");

  var ss = getOrCreateBackupSheet(props, folderId);

  backupPhotos(ss, token, owner, repo);
  backupMapPins(ss, token, owner, repo);
  backupPages(ss, token, owner, repo);

  // Spreadsheets are created with a blank "Sheet1" — drop it once the
  // real tabs above exist, so the backup only shows meaningful sheets.
  var defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);

  Logger.log("Backup complete: " + ss.getUrl());
}

function getOrCreateBackupSheet(props, folderId) {
  var sheetId = props.getProperty("BACKUP_SHEET_ID");
  if (sheetId) {
    try {
      return SpreadsheetApp.openById(sheetId);
    } catch (e) {
      Logger.log("Stored backup sheet is no longer accessible, creating a new one: " + e);
    }
  }

  var ss = SpreadsheetApp.create("Memories of Thurmaston — site backup");
  props.setProperty("BACKUP_SHEET_ID", ss.getId());

  if (folderId) {
    var file = DriveApp.getFileById(ss.getId());
    DriveApp.getFolderById(folderId).addFile(file);
    DriveApp.getRootFolder().removeFile(file);
  }

  return ss;
}

function backupPhotos(ss, token, owner, repo) {
  var photos = fetchJsonFile("data/photos.json", token, owner, repo) || [];
  var headers = ["id", "caption", "category", "date", "credit", "location", "history", "ref", "pageSlug", "lat", "lng", "consentNoted", "src"];
  writeSheetRows(ss, "Photos", headers, photos);
}

function backupMapPins(ss, token, owner, repo) {
  var data = fetchJsonFile("data/map-pins.json", token, owner, repo);
  var pins = (data && data.pins) || [];
  var headers = ["id", "name", "category", "coords", "period", "location", "description", "photoId", "pageSlug"];
  writeSheetRows(ss, "Map Pins", headers, pins);
}

function backupPages(ss, token, owner, repo) {
  var files = listDirFiles("data/pages", token, owner, repo);
  var rows = files.filter(function (f) { return /\.json$/i.test(f.name); }).map(function (f) {
    var page = fetchJsonFile("data/pages/" + f.name, token, owner, repo) || {};
    var slug = f.name.replace(/\.json$/i, "");
    var content = (page.blocks || []).map(function (b) {
      if (b.type === "text") return b.text;
      if (b.type === "photo") return "[Photo: " + b.photoId + "]";
      return "";
    }).join("\n\n");
    return { slug: slug, title: page.title || "", content: content };
  });
  var headers = ["slug", "title", "content"];
  writeSheetRows(ss, "Story Pages", headers, rows);
}

function writeSheetRows(ss, sheetName, headers, rows) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  sheet.clear();
  sheet.appendRow(headers);
  rows.forEach(function (row) {
    sheet.appendRow(headers.map(function (h) {
      var v = row[h];
      return v === undefined || v === null ? "" : v;
    }));
  });
  sheet.setFrozenRows(1);
}

function fetchJsonFile(path, token, owner, repo) {
  try {
    var current = ghGet(path, token, owner, repo);
    return JSON.parse(Utilities.newBlob(Utilities.base64Decode(current.content), "text/plain").getDataAsString());
  } catch (e) {
    Logger.log("Backup: couldn't fetch " + path + ": " + e);
    return null;
  }
}

function listDirFiles(path, token, owner, repo) {
  try {
    var url = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path;
    var res = UrlFetchApp.fetch(url, {
      headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" }
    });
    return JSON.parse(res.getContentText());
  } catch (e) {
    Logger.log("Backup: couldn't list " + path + ": " + e);
    return [];
  }
}
