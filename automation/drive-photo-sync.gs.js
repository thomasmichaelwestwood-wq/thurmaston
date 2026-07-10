/**
 * Thurmaston Village — Google Drive → GitHub photo sync
 *
 * Watches the "Memories of Thurmaston Photos" Drive folder. Any image
 * dropped into one of its four subfolders (Streets & Buildings,
 * People & Events, Nature & Views, Other) is automatically resized down
 * to a sensible web size, committed into the site repo, and added to
 * the photo archive — no chat session, no manual step, runs on its own.
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
 */

var CATEGORY_FOLDERS = {
  "Streets & Buildings": "streets",
  "People & Events": "people",
  "Nature & Views": "nature",
  "Other": "other"
};

var MAX_DIMENSION = 1600; // longest edge, in pixels, for published photos

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

  // Root-level photos (no category chosen) default to "other".
  scanFolder(root, "other");

  var subfolders = root.getFolders();
  while (subfolders.hasNext()) {
    var sub = subfolders.next();
    var category = CATEGORY_FOLDERS[sub.getName()] || "other";
    scanFolder(sub, category);
  }

  function scanFolder(folder, category) {
    var files = folder.getFiles();
    while (files.hasNext()) {
      var file = files.next();
      var mime = file.getMimeType();
      if (mime !== "image/jpeg" && mime !== "image/png") continue;

      var id = file.getId();
      if (processedSet[id]) continue;

      try {
        publishPhoto(file, category, token, owner, repo);
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

function publishPhoto(file, category, token, owner, repo) {
  var rawName = file.getName();
  var ext = (rawName.match(/\.(jpe?g|png)$/i) || [".jpg"])[0].toLowerCase();
  var base = rawName.replace(/\.(jpe?g|png)$/i, "");

  var caption = base.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  caption = caption.charAt(0).toUpperCase() + caption.slice(1);

  var slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  var shortId = file.getId().slice(0, 8);
  var filename = shortId + "-" + slug + ext;
  var repoPath = "images/photos/" + filename;

  var blob = resizeIfNeeded(file.getBlob());
  var base64 = Utilities.base64Encode(blob.getBytes());

  ghPut(repoPath, base64, "Add photo: " + rawName, token, owner, repo);
  appendMetadataEntry(shortId, slug, filename, caption, category, token, owner, repo);
}

/**
 * Apps Script has no real image-resize API. Google Slides can rescale
 * an inserted image and re-export it, which is the only reliable way
 * to shrink a photo from server-side script code. If anything goes
 * wrong, the original blob is published as-is rather than blocking
 * the sync.
 */
function resizeIfNeeded(blob) {
  try {
    var presentation = SlidesApp.create("tmp-resize-" + Date.now());
    var slide = presentation.getSlides()[0];
    var image = slide.insertImage(blob);

    var width = image.getWidth();
    var height = image.getHeight();
    var longest = Math.max(width, height);
    if (longest > MAX_DIMENSION) {
      var scale = MAX_DIMENSION / longest;
      image.setWidth(Math.round(width * scale));
      image.setHeight(Math.round(height * scale));
    }

    var resizedBlob = image.getAs("image/png").setName(blob.getName());
    DriveApp.getFileById(presentation.getId()).setTrashed(true);
    return resizedBlob;
  } catch (e) {
    Logger.log("Resize skipped, publishing original: " + e);
    return blob;
  }
}

function appendMetadataEntry(shortId, slug, filename, caption, category, token, owner, repo) {
  var dataPath = "js/photos-data.js";
  var current = ghGet(dataPath, token, owner, repo);
  var content = Utilities.newBlob(
    Utilities.base64Decode(current.content), "text/plain"
  ).getDataAsString();

  var entry =
    '  {\n' +
    '    id: "' + shortId + '-' + slug + '",\n' +
    '    src: "images/photos/' + filename + '",\n' +
    '    caption: "' + caption.replace(/"/g, '\\"') + '",\n' +
    '    category: "' + category + '",\n' +
    '    date: "Added ' + Utilities.formatDate(new Date(), "Europe/London", "MMMM yyyy") + '",\n' +
    '    credit: "Unknown — needs a credit",\n' +
    '    consentNoted: false,\n' +
    '    example: false\n' +
    '  },\n';

  var marker = "const PHOTOS_DATA = [";
  var idx = content.indexOf(marker);
  var updated = content.slice(0, idx + marker.length) + "\n" + entry + content.slice(idx + marker.length);

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
