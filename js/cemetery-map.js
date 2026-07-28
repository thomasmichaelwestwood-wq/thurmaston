// Cemetery Map (cemetery-map.html) — the cemetery's aerial overview
// photo (data/cemetery-overview.json, same file cemetery.html's own
// banner uses) with a pin per grave that has a Position on the
// cemetery map set (admin/pin-grave.html is what produces that value —
// see its own comment for why this can't be a normal CMS widget).
// Uses the shared CEMETERY_DATA_PROMISE (js/main.js) rather than its
// own fetch of data/cemetery.json, same reasoning as js/cemetery.js.
document.addEventListener("DOMContentLoaded", function () {
  var wrapEl = document.getElementById("cemetery-map-wrap");
  var imgEl = document.getElementById("cemetery-map-img");
  var pinsEl = document.getElementById("cemetery-map-pins");
  var emptyEl = document.getElementById("cemetery-map-empty");
  var noPhotoEl = document.getElementById("cemetery-map-no-photo");
  if (!wrapEl) return;

  fetch("data/cemetery-overview.json")
    .then(function (res) { return res.ok ? res.json() : null; })
    .catch(function () { return null; })
    .then(function (overview) {
      if (!overview || !overview.photo) {
        noPhotoEl.hidden = false;
        return;
      }
      imgEl.src = overview.photo;

      if (typeof CEMETERY_DATA_PROMISE === "undefined") {
        noPhotoEl.hidden = false;
        return;
      }
      CEMETERY_DATA_PROMISE.then(function (graves) {
        var pinned = graves.filter(function (g) { return typeof g.pinX === "number" && typeof g.pinY === "number"; });
        if (pinned.length === 0) {
          emptyEl.hidden = false;
          return;
        }
        pinsEl.innerHTML = pinned.map(renderPin).join("");
        wrapEl.hidden = false;
      });
    });

  function renderPin(grave) {
    return (
      '<a class="cemetery-map-pin" href="grave.html?grave=' + encodeURIComponent(grave.id) + '" style="left:' + grave.pinX + '%;top:' + grave.pinY + '%">' +
        '<span class="cemetery-map-pin-label">' + escapeHtml(grave.name) + "</span>" +
      "</a>"
    );
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
});
