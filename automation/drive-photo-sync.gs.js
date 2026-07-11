/**
 * Thurmaston Village — Google Drive → GitHub photo sync
 *
 * Watches the "Memories of Thurmaston Photos" Drive folder. Any image
 * dropped into one of its four category subfolders (Streets &
 * Buildings, People & Events, Nature & Views, Other) is automatically
 * resized down to a sensible web size, committed into the site repo,
 * and added to the photo archive — no chat session, no manual step,
 * runs on its own.
 *
 * Optionally, a photo can also be placed on the site's interactive
 * Historic Map: inside a category folder, create a further subfolder
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
 *    four subfolders, spelled exactly:
 *      "Streets & Buildings", "People & Events", "Nature & Views", "Other"
 *    Each subfolder (and the top-level folder itself) needs sharing set
 *    to "Anyone with the link" so the resize step below can fetch the
 *    image — file contents never become public any other way, since
 *    the only thing that uses that link is this script, briefly,
 *    during resizing.
 *
 * 5. Triggers (clock icon, left sidebar) → Add Trigger →
 *      Function: syncPhotos
 *      Event source: Time-driven
 *      Type: Hour timer, Every hour
 *
 * 6. Run `syncPhotos` once manually from the editor (the ▷ Run button)
 *    to grant the script permission to read Drive and call external
 *    URLs. After that it runs unattended on the hourly trigger.
 * ---------------------------------------------------------------------
 *
 * HOW A PHOTO BECOMES SEARCHABLE AND SHOWS ON THE MAP
 * ---------------------------------------------------------------------
 * Searchable: automatic, no extra step — but name the file
 * descriptively before uploading (e.g. "Old forge on Melton Road
 * 1960s.jpg", not "IMG_4213.jpg"). The filename becomes the caption,
 * and the caption is what search matches against.
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
 */

var CATEGORY_FOLDERS = {
  "Streets & Buildings": "streets",
  "People & Events": "people",
  "Nature & Views": "nature",
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
var JPEG_QUALITY = 82;

function syncPhotos() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty("DRIVE_FOLDER_ID");
  var token = props.getProperty("GITHUB_TOKEN");
  var owner = props.getProperty("GITHUB_OWNER");
  var repo = props.getProperty("GITHUB_REPO");

  var processed = JSON.parse(props.getProperty("PROCESSED_IDS") || "[]");
  var processedSet = {};
  processed.forEach(function (id) { processedSet[id] = true; });

  var root = DriveApp.getFolderById(folderId);
  var newIds = [];

  // Root-level photos (no category chosen) default to "other", no place.
  scanFolder(root, "other", null);

  var subfolders = root.getFolders();
  while (subfolders.hasNext()) {
    var sub = subfolders.next();
    var category = CATEGORY_FOLDERS[sub.getName()] || "other";
    scanFolder(sub, category, null);

    var placeFolders = sub.getFolders();
    while (placeFolders.hasNext()) {
      var placeFolder = placeFolders.next();
      var place = KNOWN_PLACES[placeFolder.getName().toLowerCase().trim()] || null;
      scanFolder(placeFolder, category, place);
    }
  }

  function scanFolder(folder, category, place) {
    var files = folder.getFiles();
    while (files.hasNext()) {
      var file = files.next();
      var mime = file.getMimeType();
      if (mime !== "image/jpeg" && mime !== "image/png") continue;

      var id = file.getId();
      if (processedSet[id]) continue;

      try {
        publishPhoto(file, category, place, token, owner, repo);
        newIds.push(id);
      } catch (e) {
        Logger.log("Failed to publish " + file.getName() + ": " + e);
      }
    }
  }

  if (newIds.length > 0) {
    props.setProperty("PROCESSED_IDS", JSON.stringify(processed.concat(newIds)));
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

  var caption = base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  caption = caption.charAt(0).toUpperCase() + caption.slice(1);

  var slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  var shortId = file.getId().slice(0, 8);
  var filename = shortId + "-" + slug + ext;
  var repoPath = "images/photos/" + filename;

  var blob = resizeViaProxy(file);
  var base64 = Utilities.base64Encode(blob.getBytes());

  ghPut(repoPath, base64, "Add photo: " + rawName, token, owner, repo);
  appendMetadataEntry(shortId, slug, filename, caption, category, place, token, owner, repo);
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
function resizeViaProxy(file) {
  try {
    var sourceUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();
    var proxyUrl = "https://wsrv.nl/?url=" + encodeURIComponent(sourceUrl) +
      "&w=" + MAX_DIMENSION + "&h=" + MAX_DIMENSION + "&fit=inside" +
      "&output=jpg&q=" + JPEG_QUALITY;
    var res = UrlFetchApp.fetch(proxyUrl, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error("proxy returned " + res.getResponseCode());
    return res.getBlob();
  } catch (e) {
    Logger.log("Resize skipped, publishing original: " + e);
    return file.getBlob();
  }
}

function appendMetadataEntry(shortId, slug, filename, caption, category, place, token, owner, repo) {
  var dataPath = "data/photos.json";
  var current = ghGet(dataPath, token, owner, repo);
  var photos = JSON.parse(
    Utilities.newBlob(Utilities.base64Decode(current.content), "text/plain").getDataAsString()
  );

  var entry = {
    id: shortId + "-" + slug,
    src: "images/photos/" + filename,
    caption: caption,
    category: category,
    date: "Added " + Utilities.formatDate(new Date(), "Europe/London", "MMMM yyyy"),
    credit: "Unknown — needs a credit",
    consentNoted: false,
    example: false
  };
  if (place) {
    entry.lat = place.lat;
    entry.lng = place.lng;
  }

  photos.unshift(entry);
  var updated = JSON.stringify(photos, null, 2) + "\n";

  ghPut(
    dataPath,
    Utilities.base64Encode(Utilities.newBlob(updated).getBytes()),
    "Add metadata entry for " + filename,
    token, owner, repo, current.sha
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
