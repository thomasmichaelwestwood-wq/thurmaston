// Shared infrastructure for the bespoke CMS: GitHub Contents API helpers,
// slug generation (same convention Sveltia used), and a shared page shell
// (sign-out button + plain-English error banner) — used by every /cms/
// screen. Extends the exact pattern already proven in admin/pin-grave.html's
// githubPutFile/utf8ToBase64, completing the one thing create-only never
// needed: fetching a file's current sha before overwriting or deleting it.

var CMS_OWNER = "thomasmichaelwestwood-wq";
var CMS_REPO = "thurmaston";
var CMS_BRANCH = "main";

// --- Encoding helpers ------------------------------------------------

// UTF-8-safe base64 — plain btoa()/atob() mangle anything outside
// Latin-1 (an accented letter, a curly quote in a name or caption).
function cmsUtf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function cmsBase64ToUtf8(base64) {
  return decodeURIComponent(escape(atob(String(base64).replace(/\s/g, ""))));
}

// Raw base64 for an uploaded image file — never round-tripped through
// the UTF-8 functions above, which would corrupt binary data.
function cmsReadFileAsBase64(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () {
      var dataUrl = reader.result;
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function cmsSlugify(str) {
  return String(str || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "entry";
}

// Same {{year}}{{month}}{{day}}{{hour}}{{minute}}{{second}}-{{slug}}
// convention Sveltia's collections used, so new entries sort and look
// the same as before.
function cmsTimestampSlug(name) {
  var d = new Date();
  function pad(n) { return String(n).padStart(2, "0"); }
  var prefix = "" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  return prefix + "-" + cmsSlugify(name);
}

function cmsFileExtension(filename) {
  var match = String(filename || "").match(/\.[^.]+$/);
  return match ? match[0].toLowerCase() : "";
}

// --- GitHub Contents API ---------------------------------------------

function cmsApiHeaders(token) {
  return {
    "Authorization": "token " + token,
    "Accept": "application/vnd.github+json",
    "Content-Type": "application/json"
  };
}
function cmsContentsUrl(path) {
  return "https://api.github.com/repos/" + CMS_OWNER + "/" + CMS_REPO + "/contents/" + path;
}

function cmsThrowApiError(res) {
  return res.json().catch(function () { return {}; }).then(function (data) {
    var err = new Error((data && data.message) || ("GitHub API returned " + res.status));
    err.status = res.status;
    throw err;
  });
}

// Returns { sha, content } (content already decoded to a UTF-8 string)
// for a text/JSON file, or null if the file doesn't exist yet.
function cmsGetFile(path, token) {
  return fetch(cmsContentsUrl(path) + "?ref=" + CMS_BRANCH, { headers: cmsApiHeaders(token) }).then(function (res) {
    if (res.status === 404) return null;
    if (!res.ok) return cmsThrowApiError(res);
    return res.json().then(function (data) {
      return { sha: data.sha, content: cmsBase64ToUtf8(data.content) };
    });
  });
}

// Returns just a file's current sha (or null if it doesn't exist),
// without decoding its content — the only safe way to look up the sha
// of a binary file (an image); cmsGetFile's UTF-8 decode step would
// throw on real binary bytes.
function cmsGetFileSha(path, token) {
  return fetch(cmsContentsUrl(path) + "?ref=" + CMS_BRANCH, { headers: cmsApiHeaders(token) }).then(function (res) {
    if (res.status === 404) return null;
    if (!res.ok) return cmsThrowApiError(res);
    return res.json().then(function (data) { return data.sha; });
  });
}

// Returns an array of { name, path, type, sha } entries, or [] if the
// folder doesn't exist yet (nothing added in that collection so far).
function cmsListFolder(path, token) {
  return fetch(cmsContentsUrl(path) + "?ref=" + CMS_BRANCH, { headers: cmsApiHeaders(token) }).then(function (res) {
    if (res.status === 404) return [];
    if (!res.ok) return cmsThrowApiError(res);
    return res.json();
  });
}

function cmsPutRaw(path, base64Content, message, token, sha) {
  var body = { message: message, content: base64Content, branch: CMS_BRANCH };
  if (sha) body.sha = sha;
  return fetch(cmsContentsUrl(path), { method: "PUT", headers: cmsApiHeaders(token), body: JSON.stringify(body) }).then(function (res) {
    if (!res.ok) return cmsThrowApiError(res);
    return res.json();
  });
}

function cmsPutTextFile(path, content, message, token, sha) {
  return cmsPutRaw(path, cmsUtf8ToBase64(content), message, token, sha);
}
function cmsPutBinaryFile(path, base64Content, message, token, sha) {
  return cmsPutRaw(path, base64Content, message, token, sha);
}

function cmsDeleteFile(path, sha, message, token) {
  return fetch(cmsContentsUrl(path), {
    method: "DELETE",
    headers: cmsApiHeaders(token),
    body: JSON.stringify({ message: message, sha: sha, branch: CMS_BRANCH })
  }).then(function (res) {
    if (!res.ok) return cmsThrowApiError(res);
    return res.json();
  });
}

// --- Shared page shell -------------------------------------------------

function cmsInitShell() {
  var signoutBtn = document.getElementById("cms-signout-btn");
  if (signoutBtn) signoutBtn.addEventListener("click", cmsSignOut);
}

function cmsShowError(message) {
  var banner = document.getElementById("cms-error-banner");
  if (!banner) return;
  banner.textContent = message;
  banner.hidden = false;
}
function cmsHideError() {
  var banner = document.getElementById("cms-error-banner");
  if (banner) banner.hidden = true;
}

// Never show a raw error object or stack trace — always plain English.
function cmsFriendlyError(err) {
  var message = (err && err.message) || "";
  if (/Failed to fetch|NetworkError|network/i.test(message)) {
    return "Couldn't save — check your internet connection and try again.";
  }
  if (err && (err.status === 401 || /Bad credentials/i.test(message))) {
    return "You've been signed out — please sign in again and try saving once more.";
  }
  if (err && err.status === 409) {
    return "Someone else just saved a change here — refresh the page and try again.";
  }
  if (err && err.status === 404) {
    return "Couldn't find that — it may have already been removed.";
  }
  return "Something went wrong and this couldn't be saved. Please try again, and if it keeps happening, let Tom know.";
}
