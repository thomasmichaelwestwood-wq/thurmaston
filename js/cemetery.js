// Cemetery landing page (cemetery.html) — an optional overview photo
// (data/cemetery-overview.json, a single-file CMS collection so it's
// just an image upload + caption, no gallery needed) plus the full
// alphabetical directory (data/cemetery.json, built from the admin's
// "Graves" collection). Uses the shared CEMETERY_DATA_PROMISE
// (js/main.js) rather than its own fetch, same reasoning as
// js/chronology.js/CHRONOLOGY_DATA_PROMISE — initSearch() is already
// fetching this file for the site search index.
document.addEventListener("DOMContentLoaded", function () {
  var overviewEl = document.getElementById("cemetery-overview");
  var overviewImg = document.getElementById("cemetery-overview-img");
  var overviewCaption = document.getElementById("cemetery-overview-caption");
  var directoryEl = document.getElementById("cemetery-directory");
  var emptyEl = document.getElementById("cemetery-empty");
  if (!directoryEl) return;

  fetch("data/cemetery-overview.json")
    .then(function (res) { return res.ok ? res.json() : null; })
    .catch(function () { return null; })
    .then(function (overview) {
      if (overview && overview.photo) {
        overviewImg.src = overview.photo;
        if (overview.caption) overviewCaption.textContent = overview.caption;
        overviewEl.hidden = false;
      }
    });

  if (typeof CEMETERY_DATA_PROMISE === "undefined") return;
  CEMETERY_DATA_PROMISE.then(function (graves) {
    if (graves.length === 0) {
      emptyEl.hidden = false;
      return;
    }
    directoryEl.innerHTML = graves.map(renderRow).join("");
  });

  function renderRow(grave) {
    var meta = [grave.number ? "No. " + grave.number : null, grave.dates].filter(Boolean).join(" · ");
    return (
      '<li><a href="grave.html?grave=' + encodeURIComponent(grave.id) + '">' +
        '<span class="cemetery-directory-name">' + escapeHtml(grave.name) + "</span>" +
        (meta ? '<span class="cemetery-directory-meta">' + escapeHtml(meta) + "</span>" : "") +
      "</a></li>"
    );
  }
});
