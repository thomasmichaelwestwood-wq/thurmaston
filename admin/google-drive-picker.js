// Lets an editor pick a photo straight from Google Drive instead of
// only a local file — replaces an earlier Google Photos picker attempt
// (admin/google-photos-picker.js, since removed — see git history),
// which hit repeated, unresolved reliability problems with Google's
// very new (2025) Photos Picker API. The Google Picker API used here,
// for Drive, is long-established, widely used technology with none of
// those issues.
//
// Needs one-time Google Cloud Console setup by the site owner (not
// something this code can create) — see CLAUDE.md for the exact
// steps: enabling the Google Picker API + Google Drive API, creating
// an API key (separate from the OAuth Client ID), and adding the
// drive.file scope to the OAuth consent screen. Downloading the
// picked file's actual bytes goes through
// netlify/functions/google-drive-download.js rather than fetching
// Drive's content endpoint directly from here, for the same
// CORS-avoidance reason as the (now unused) Photos integration had.

var GOOGLE_DRIVE_CLIENT_ID = "121328946353-omrpogqh5boe8akptqggikc6lo73gc6b.apps.googleusercontent.com";
var GOOGLE_DRIVE_API_KEY = "AIzaSyDjA8yvXwFVQFjVanIrYyADOSUvQiYOGW8";
var GOOGLE_DRIVE_APP_ID = "121328946353";
var GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
var GOOGLE_DRIVE_TOKEN_KEY = "thurmaston-cms-google-drive-token";

var gdpGisLoadPromise = null;
var gdpPickerApiLoadPromise = null;

function gdpLoadGis() {
  if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
  if (gdpGisLoadPromise) return gdpGisLoadPromise;
  gdpGisLoadPromise = new Promise(function (resolve, reject) {
    var script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = function () { resolve(); };
    script.onerror = function () { reject(new Error("Couldn't reach Google — check your internet connection and try again.")); };
    document.head.appendChild(script);
  });
  return gdpGisLoadPromise;
}

function gdpLoadPickerApi() {
  if (window.google && window.google.picker) return Promise.resolve();
  if (gdpPickerApiLoadPromise) return gdpPickerApiLoadPromise;
  gdpPickerApiLoadPromise = new Promise(function (resolve, reject) {
    var script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = function () {
      gapi.load("picker", { callback: resolve, onerror: function () { reject(new Error("Couldn't load Google Drive. Please try again.")); } });
    };
    script.onerror = function () { reject(new Error("Couldn't reach Google — check your internet connection and try again.")); };
    document.head.appendChild(script);
  });
  return gdpPickerApiLoadPromise;
}

function gdpGetCachedToken() {
  try {
    var saved = JSON.parse(sessionStorage.getItem(GOOGLE_DRIVE_TOKEN_KEY) || "null");
    if (saved && saved.token && saved.expiresAt > Date.now() + 30000) return saved.token;
  } catch (e) {}
  return null;
}
function gdpSetCachedToken(token, expiresAt) {
  try { sessionStorage.setItem(GOOGLE_DRIVE_TOKEN_KEY, JSON.stringify({ token: token, expiresAt: expiresAt })); } catch (e) {}
}

function gdpGetAccessToken() {
  var cached = gdpGetCachedToken();
  if (cached) return Promise.resolve(cached);
  return gdpLoadGis().then(function () {
    return new Promise(function (resolve, reject) {
      var client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_DRIVE_CLIENT_ID,
        scope: GOOGLE_DRIVE_SCOPE,
        callback: function (response) {
          if (!response || !response.access_token) {
            reject(new Error("Couldn't sign in to Google Drive. Please try again."));
            return;
          }
          gdpSetCachedToken(response.access_token, Date.now() + (Number(response.expires_in || 3600) * 1000));
          resolve(response.access_token);
        },
        error_callback: function (err) {
          var cancelled = err && (err.type === "popup_closed" || err.type === "user_cancel");
          reject(new Error(cancelled ? "Sign-in to Google Drive was cancelled." : "Couldn't sign in to Google Drive. Please try again."));
        }
      });
      client.requestAccessToken();
    });
  });
}

// Shows the Drive picker and resolves the array of picked documents
// (each { id, name, mimeType }), or [] if the editor closed it without
// picking anything (a deliberate cancel — not an error).
function gdpShowPicker(token, allowMultiple) {
  return gdpLoadPickerApi().then(function () {
    return new Promise(function (resolve, reject) {
      try {
        var view = new google.picker.DocsView(google.picker.ViewId.DOCS_IMAGES).setIncludeFolders(true);
        var builder = new google.picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(token)
          .setDeveloperKey(GOOGLE_DRIVE_API_KEY)
          .setAppId(GOOGLE_DRIVE_APP_ID)
          .setCallback(function (data) {
            if (data[google.picker.Response.ACTION] === google.picker.Action.CANCEL) {
              resolve([]);
              return;
            }
            if (data[google.picker.Response.ACTION] !== google.picker.Action.PICKED) return; // ignore intermediate events (e.g. just navigating folders)
            var docs = data[google.picker.Response.DOCUMENTS] || [];
            resolve(docs.map(function (doc) {
              return {
                id: doc[google.picker.Document.ID],
                name: doc[google.picker.Document.NAME],
                mimeType: doc[google.picker.Document.MIME_TYPE]
              };
            }));
          });
        if (allowMultiple) builder.enableFeature(google.picker.Feature.MULTISELECT_ENABLED);
        builder.build().setVisible(true);
      } catch (e) {
        reject(new Error("Couldn't open Google Drive. Please try again."));
      }
    });
  });
}

function gdpDownloadViaFunction(fileId, token) {
  return fetch("/.netlify/functions/google-drive-download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId: fileId, token: token })
  }).then(function (res) {
    if (!res.ok) throw new Error("Couldn't download that file from Google Drive. Please try again.");
    return res.json();
  });
}

function gdpDownloadSequentially(docs, token) {
  var results = [];
  var index = 0;
  function next() {
    if (index >= docs.length) return Promise.resolve(results);
    var doc = docs[index++];
    return gdpDownloadViaFunction(doc.id, token).then(function (downloaded) {
      results.push({
        filename: doc.name || "drive-photo.jpg",
        base64: downloaded.base64,
        type: downloaded.contentType || doc.mimeType || "image/jpeg"
      });
      return next();
    });
  }
  return next();
}

// Resolves { base64, filename } for the one photo picked, or null if
// the editor closed the picker without choosing anything. Rejects for
// a genuine failure.
function googleDrivePickOne() {
  var accessToken;
  return gdpGetAccessToken().then(function (token) {
    accessToken = token;
    return gdpShowPicker(token, false);
  }).then(function (docs) {
    if (!docs.length) return null;
    return gdpDownloadViaFunction(docs[0].id, accessToken).then(function (downloaded) {
      return { base64: downloaded.base64, filename: docs[0].name || "drive-photo.jpg" };
    });
  });
}

// Resolves an array of { filename, base64, type } — the same shape
// events.html already uses for newPhotosBase64 — or [] if cancelled.
function googleDrivePickMany() {
  var accessToken;
  return gdpGetAccessToken().then(function (token) {
    accessToken = token;
    return gdpShowPicker(token, true);
  }).then(function (docs) {
    if (!docs.length) return [];
    return gdpDownloadSequentially(docs, accessToken);
  });
}
