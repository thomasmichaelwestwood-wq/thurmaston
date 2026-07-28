// Cemetery Map (cemetery-map.html) — the cemetery's aerial overview
// photo (data/cemetery-overview.json, same file cemetery.html's own
// banner uses) with a pin per grave that has a Position on the
// cemetery map set (admin/pin-grave.html is what produces that value —
// see its own comment for why this can't be a normal CMS widget).
// Uses the shared CEMETERY_DATA_PROMISE (js/main.js) rather than its
// own fetch of data/cemetery.json, same reasoning as js/cemetery.js.
//
// The "Find a name on the map" search box at the top of the page is
// deliberately its own small search, not the shared wireSearchBox used
// everywhere else on the site (js/main.js) — that one searches the
// WHOLE site (photos, events, chronology…) and links off to whatever
// page matched, which is right for the header search but wrong here:
// asked for explicitly as "typing a name shows you on the map where it
// is," so this one only ever considers graves that actually have a pin
// (nothing to show on the map for one that doesn't), and selecting a
// result scrolls to and highlights that pin in place rather than
// navigating anywhere.
document.addEventListener("DOMContentLoaded", function () {
  var wrapEl = document.getElementById("cemetery-map-wrap");
  var imgEl = document.getElementById("cemetery-map-img");
  var pinsEl = document.getElementById("cemetery-map-pins");
  var emptyEl = document.getElementById("cemetery-map-empty");
  var noPhotoEl = document.getElementById("cemetery-map-no-photo");
  var searchInput = document.getElementById("cemetery-map-search-input");
  var searchResults = document.getElementById("cemetery-map-search-results");
  if (!wrapEl) return;

  var pinnedGraves = [];
  var highlightTimeout = null;

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
        pinnedGraves = graves.filter(function (g) { return typeof g.pinX === "number" && typeof g.pinY === "number"; });
        if (pinnedGraves.length === 0) {
          emptyEl.hidden = false;
          return;
        }
        pinsEl.innerHTML = pinnedGraves.map(renderPin).join("");
        wrapEl.hidden = false;
        wireSearch();
      });
    });

  function renderPin(grave) {
    return (
      '<a class="cemetery-map-pin" href="grave.html?grave=' + encodeURIComponent(grave.id) + '" data-grave-id="' + escapeAttr(grave.id) + '" style="left:' + grave.pinX + '%;top:' + grave.pinY + '%">' +
        '<span class="cemetery-map-pin-label">' + escapeHtml(grave.name) + "</span>" +
      "</a>"
    );
  }

  function wireSearch() {
    if (!searchInput || !searchResults) return;
    searchInput.addEventListener("input", function () { renderSearchResults(searchInput.value.trim()); });
    searchInput.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var q = searchInput.value.trim().toLowerCase();
      if (!q) return;
      var matches = pinnedGraves.filter(function (g) { return g.name.toLowerCase().indexOf(q) !== -1; });
      if (matches.length >= 1) {
        e.preventDefault();
        jumpToGrave(matches[0]);
      }
    });
  }

  function renderSearchResults(query) {
    searchResults.innerHTML = "";
    if (!query) return;

    var q = query.toLowerCase();
    var matches = pinnedGraves.filter(function (g) { return g.name.toLowerCase().indexOf(q) !== -1; });

    if (matches.length === 0) {
      var empty = document.createElement("li");
      empty.className = "search-empty";
      empty.textContent = "No pinned grave found for “" + query + "” — it may not have a map location recorded yet. Check the full directory instead.";
      searchResults.appendChild(empty);
      return;
    }

    matches.slice(0, 15).forEach(function (grave) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.style.width = "100%";
      btn.style.textAlign = "left";
      btn.style.background = "none";
      btn.style.border = "none";
      btn.style.font = "inherit";
      btn.style.cursor = "pointer";
      var meta = [grave.number ? "No. " + grave.number : null, grave.dates].filter(Boolean).join(" · ");
      btn.innerHTML =
        '<span class="result-title">' + escapeHtml(grave.name) + "</span>" +
        (meta ? '<div class="result-excerpt">' + escapeHtml(meta) + "</div>" : "");
      btn.addEventListener("click", function () { jumpToGrave(grave); });
      li.appendChild(btn);
      searchResults.appendChild(li);
    });
  }

  function jumpToGrave(grave) {
    var pin = pinsEl.querySelector('[data-grave-id="' + cssEscape(grave.id) + '"]');
    if (!pin) return;

    searchResults.innerHTML = "";
    searchInput.value = grave.name;

    if (highlightTimeout) clearTimeout(highlightTimeout);
    Array.prototype.forEach.call(pinsEl.querySelectorAll(".cemetery-map-pin.highlighted"), function (el) {
      el.classList.remove("highlighted");
    });
    pin.classList.add("highlighted");
    pin.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    highlightTimeout = setTimeout(function () { pin.classList.remove("highlighted"); }, 4000);
  }

  function cssEscape(str) {
    return String(str).replace(/["\\]/g, "\\$&");
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function escapeAttr(str) { return escapeHtml(str); }
});
