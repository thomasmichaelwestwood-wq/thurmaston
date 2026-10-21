// Lets an editor pick a photo straight from their Google Photos library
// instead of only a local file. Google locked down its old Photos
// Library API in March 2025 — an app can no longer read a user's
// existing library/albums on its own, so this uses the newer Picker
// API instead: open a picker, the editor chooses, we get just those
// photos. There's no way to make this a silent background sync — it's
// a deliberate, interactive, one-at-a-time (or few-at-a-time) pick,
// same spirit as choosing a local file, just from a different source.
//
// Needs a one-time Google Cloud OAuth Client ID set up by the site
// owner (not something this code can create) — see CLAUDE.md for the
// exact steps. Downloading the actual picked photo's bytes goes through
// netlify/functions/google-photos-download.js rather than fetching
// Google's content domain directly from here, to avoid a documented
// CORS wall for browser-only apps.

var GOOGLE_PHOTOS_CLIENT_ID = "121328946353-omrpogqh5boe8akptqggikc6lo73gc6b.apps.googleusercontent.com";
var GOOGLE_PHOTOS_SCOPE = "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";

var GOOGLE_PHOTOS_TOKEN_KEY = "thurmaston-cms-google-photos-token";
var gppGisLoadPromise = null;

// Kept in sessionStorage (not just an in-memory var) so signing in once
// carries across every CMS page for the rest of this browser tab's
// visit — without this, moving from Photos to Events to Memories would
// each demand a fresh Google sign-in, since every one is a separate
// page load. sessionStorage clears itself when the tab closes, same
// safety margin as the GitHub sign-in token already gets from its own
// localStorage key.
function gppGetCachedToken() {
  try {
    var saved = JSON.parse(sessionStorage.getItem(GOOGLE_PHOTOS_TOKEN_KEY) || "null");
    if (saved && saved.token && saved.expiresAt > Date.now() + 30000) return saved;
  } catch (e) {}
  return null;
}
function gppSetCachedToken(token, expiresAt) {
  try { sessionStorage.setItem(GOOGLE_PHOTOS_TOKEN_KEY, JSON.stringify({ token: token, expiresAt: expiresAt })); } catch (e) {}
}

function gppLoadGis() {
  if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
  if (gppGisLoadPromise) return gppGisLoadPromise;
  gppGisLoadPromise = new Promise(function (resolve, reject) {
    var script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = function () { resolve(); };
    script.onerror = function () { reject(new Error("Couldn't reach Google — check your internet connection and try again.")); };
    document.head.appendChild(script);
  });
  return gppGisLoadPromise;
}

function gppGetAccessToken() {
  var cached = gppGetCachedToken();
  if (cached) return Promise.resolve(cached.token);
  return gppLoadGis().then(function () {
    return new Promise(function (resolve, reject) {
      var client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_PHOTOS_CLIENT_ID,
        scope: GOOGLE_PHOTOS_SCOPE,
        callback: function (response) {
          if (!response || !response.access_token) {
            reject(new Error("Couldn't sign in to Google Photos. Please try again."));
            return;
          }
          gppSetCachedToken(response.access_token, Date.now() + (Number(response.expires_in || 3600) * 1000));
          resolve(response.access_token);
        },
        error_callback: function (err) {
          var cancelled = err && (err.type === "popup_closed" || err.type === "user_cancel");
          reject(new Error(cancelled ? "Sign-in to Google Photos was cancelled." : "Couldn't sign in to Google Photos. Please try again."));
        }
      });
      client.requestAccessToken();
    });
  });
}

function gppCreateSession(token) {
  // Deliberately sending an empty body — no pickingConfig/maxItemCount
  // restriction. An earlier version capped single-photo picks at
  // maxItemCount: "1", which is a less common code path through
  // Google's API than an unrestricted session; removed while tracking
  // down a real-world "Couldn't add photos" failure, to rule it out.
  return fetch("https://photospicker.googleapis.com/v1/sessions", {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({})
  }).then(function (res) {
    if (!res.ok) throw new Error("Couldn't connect to Google Photos. Please try again.");
    return res.json();
  });
}

function gppOpenPicker(pickerUri) {
  // Deliberately NOT appending "/autoclose" here — that was a
  // community-documented trick (not in Google's own reference), and in
  // practice it made Google's own picker page fail with "Couldn't add
  // photos... connect to Google Photos again." The plain pickerUri
  // works; the popup just doesn't close itself automatically once
  // picking is done (polling below still detects completion fine).
  //
  // A fresh, uniquely-named window every time — a fixed, reused window
  // name meant a second attempt in the same tab reopened the SAME
  // window instance, which could still be carrying state (cookies,
  // in-page JS state) from a previous, already-finished session. That's
  // a plausible cause of this working on one attempt and failing the
  // next with Google's own "Couldn't add photos" error.
  var windowName = "google-photos-picker-" + Date.now();
  var popup = window.open(pickerUri, windowName, "width=1000,height=800");
  if (!popup) throw new Error("Couldn't open Google Photos — check your browser isn't blocking pop-ups for this site.");
  return popup;
}

// Google's duration fields serialise as strings like "5s" — this reads
// the number back out, falling back to a sane default if the shape
// doesn't match what's expected.
function gppParseDurationSeconds(value, fallbackSeconds) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    var match = value.match(/^(\d+(?:\.\d+)?)s$/);
    if (match) return parseFloat(match[1]);
  }
  return fallbackSeconds;
}

function gppPollSession(sessionId, token, pollingConfig, popup) {
  var pollIntervalMs = gppParseDurationSeconds(pollingConfig && pollingConfig.pollInterval, 2) * 1000;
  var timeoutMs = gppParseDurationSeconds(pollingConfig && pollingConfig.timeoutIn, 180) * 1000;
  var startedAt = Date.now();

  return new Promise(function (resolve, reject) {
    function tick() {
      if (popup && popup.closed) { resolve({ cancelled: true }); return; }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error("You didn't finish choosing in time — please try again."));
        return;
      }
      fetch("https://photospicker.googleapis.com/v1/sessions/" + encodeURIComponent(sessionId), {
        headers: { "Authorization": "Bearer " + token }
      }).then(function (res) {
        if (!res.ok) throw new Error("Couldn't check Google Photos. Please try again.");
        return res.json();
      }).then(function (session) {
        if (session.mediaItemsSet) { resolve({ cancelled: false }); return; }
        if (session.pollingConfig && session.pollingConfig.pollInterval) {
          pollIntervalMs = gppParseDurationSeconds(session.pollingConfig.pollInterval, pollIntervalMs / 1000) * 1000;
        }
        setTimeout(tick, pollIntervalMs);
      }).catch(reject);
    }
    setTimeout(tick, pollIntervalMs);
  });
}

function gppListMediaItems(sessionId, token) {
  var items = [];
  function fetchPage(pageToken) {
    var url = "https://photospicker.googleapis.com/v1/mediaItems?sessionId=" + encodeURIComponent(sessionId) +
      (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
    return fetch(url, { headers: { "Authorization": "Bearer " + token } }).then(function (res) {
      if (!res.ok) throw new Error("Couldn't get your chosen photos from Google. Please try again.");
      return res.json();
    }).then(function (data) {
      items = items.concat(data.mediaItems || []);
      if (data.nextPageToken) return fetchPage(data.nextPageToken);
      return items;
    });
  }
  return fetchPage(null);
}

// Google's session can report mediaItemsSet: true an instant before the
// picked item is actually queryable — without this, that race looked
// exactly like "nothing was picked" and failed silently. Retries a
// few times with a short wait before giving up.
function gppListMediaItemsWithRetry(sessionId, token) {
  var attempts = [0, 600, 1200, 2000, 2000]; // ms to wait before each attempt
  function attempt(i) {
    return new Promise(function (resolve) { setTimeout(resolve, attempts[i]); }).then(function () {
      return gppListMediaItems(sessionId, token);
    }).then(function (items) {
      if (items.length || i === attempts.length - 1) return items;
      return attempt(i + 1);
    });
  }
  return attempt(0);
}

function gppDownloadViaFunction(baseUrl, token) {
  return fetch("/.netlify/functions/google-photos-download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ baseUrl: baseUrl, token: token })
  }).then(function (res) {
    if (!res.ok) throw new Error("Couldn't download that photo from Google. Please try again.");
    return res.json();
  });
}

// Fire-and-forget cleanup — a failure here should never block or fail
// the overall pick, the editor already has their photo either way.
function gppDeleteSession(sessionId, token) {
  fetch("https://photospicker.googleapis.com/v1/sessions/" + encodeURIComponent(sessionId), {
    method: "DELETE",
    headers: { "Authorization": "Bearer " + token }
  }).catch(function () {});
}

function gppDownloadSequentially(items, token) {
  var results = [];
  var index = 0;
  function next() {
    if (index >= items.length) return Promise.resolve(results);
    var item = items[index++];
    return gppDownloadViaFunction(item.mediaFile.baseUrl, token).then(function (downloaded) {
      results.push({
        filename: item.mediaFile.filename || "google-photo.jpg",
        base64: downloaded.base64,
        type: downloaded.contentType || "image/jpeg"
      });
      return next();
    });
  }
  return next();
}

// Always closes the popup once this pick is settled (success, error, or
// cancel) — each attempt now opens its own, uniquely-named window
// rather than reusing one, so nothing else will close it otherwise.
function gppSettleWithPopupClosed(promise, popup) {
  return promise.then(function (value) {
    try { if (popup && !popup.closed) popup.close(); } catch (e) {}
    return value;
  }, function (err) {
    try { if (popup && !popup.closed) popup.close(); } catch (e) {}
    throw err;
  });
}

// Resolves { base64, filename } for the one photo picked, or null if
// the editor closed the picker without choosing anything (a deliberate
// cancel — not an error). Rejects for a genuine failure.
function googlePhotosPickOne() {
  var accessToken;
  return gppGetAccessToken().then(function (token) {
    accessToken = token;
    return gppCreateSession(token);
  }).then(function (session) {
    var popup = gppOpenPicker(session.pickerUri);
    var result = gppPollSession(session.id, accessToken, session.pollingConfig, popup).then(function (result) {
      if (result.cancelled) {
        gppDeleteSession(session.id, accessToken);
        return null;
      }
      return gppListMediaItemsWithRetry(session.id, accessToken).then(function (items) {
        gppDeleteSession(session.id, accessToken);
        if (!items.length) throw new Error("Google said you picked a photo, but we couldn't find it. Please try again.");
        var item = items[0];
        return gppDownloadViaFunction(item.mediaFile.baseUrl, accessToken).then(function (downloaded) {
          return { base64: downloaded.base64, filename: item.mediaFile.filename || "google-photo.jpg" };
        });
      });
    });
    return gppSettleWithPopupClosed(result, popup);
  });
}

// Resolves an array of { filename, base64, type } — the same shape
// events.html already uses for newPhotosBase64 — or [] if cancelled.
function googlePhotosPickMany() {
  var accessToken;
  return gppGetAccessToken().then(function (token) {
    accessToken = token;
    return gppCreateSession(token);
  }).then(function (session) {
    var popup = gppOpenPicker(session.pickerUri);
    var result = gppPollSession(session.id, accessToken, session.pollingConfig, popup).then(function (result) {
      if (result.cancelled) {
        gppDeleteSession(session.id, accessToken);
        return [];
      }
      return gppListMediaItemsWithRetry(session.id, accessToken).then(function (items) {
        gppDeleteSession(session.id, accessToken);
        if (!items.length) throw new Error("Google said you picked some photos, but we couldn't find them. Please try again.");
        return gppDownloadSequentially(items, accessToken);
      });
    });
    return gppSettleWithPopupClosed(result, popup);
  });
}
