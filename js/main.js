document.addEventListener("DOMContentLoaded", function () {
  initNavToggle();
  initHero();
  initSearch();
});

function initNavToggle() {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".main-nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
}

// Single static hero photo, no rotation — the emphasis is on getting to
// the photo archive fast, not a slideshow to watch first.
function initHero() {
  var hero = document.querySelector("[data-hero]");
  if (!hero) return;

  fetch("data/hero.json")
    .then(function (res) { return res.ok ? res.json() : []; })
    .catch(function () { return []; })
    .then(function (heroPhotos) {
      // The first real synced photo replaces the placeholder
      // illustration once there is one — otherwise the illustration
      // already in the page stays as the fallback.
      if (heroPhotos && heroPhotos.length > 0) {
        var slide = hero.querySelector(".hero-slide");
        if (slide) slide.style.backgroundImage = "url('" + heroPhotos[0].src + "')";
      }
    });
}

// Two search boxes can exist on one page now — the header's icon-
// triggered overlay (every page) and, on the homepage only, a second
// one sitting right under the hero (#home-search-input/-results). Both
// search the same combined index (SITE_SEARCH_INDEX + every photo), so
// the index and the matching/rendering logic are built once here and
// shared, rather than duplicated per box.
function initSearch() {
  var searchIndex = (typeof SITE_SEARCH_INDEX !== "undefined") ? SITE_SEARCH_INDEX.slice() : [];
  var boxes = [];

  if (typeof PHOTOS_DATA_PROMISE !== "undefined") {
    PHOTOS_DATA_PROMISE.then(function (photos) {
      var photoEntries = photos.map(function (p) {
        return {
          title: p.caption,
          url: "place.html?photo=" + encodeURIComponent(p.id),
          category: "Photo",
          excerpt: [p.date, p.location, p.credit !== "—" ? "Credit: " + p.credit : null].filter(Boolean).join(" · "),
          // Matched against, but never shown — a photo's location
          // ("Garden Street"), Dad's original filing reference, and
          // any written History are all things a visitor might type
          // that don't otherwise appear in the caption/date/credit
          // shown as the title/excerpt above, so search would silently
          // miss a real match (e.g. "garden" finding the caption
          // "Garden Centre" but not a different photo whose only
          // mention of "Garden" is its Location field).
          keywords: [p.location, p.ref, p.history].filter(Boolean).join(" ")
        };
      });
      searchIndex = (typeof SITE_SEARCH_INDEX !== "undefined" ? SITE_SEARCH_INDEX : []).concat(photoEntries);
      boxes.forEach(function (box) { box.refresh(); });
    });
  }

  function renderResultsInto(resultsList, query, emptyHint) {
    resultsList.innerHTML = "";

    if (!query) {
      if (!emptyHint) return;
      var hint = document.createElement("li");
      hint.className = "search-hint";
      hint.textContent = emptyHint;
      resultsList.appendChild(hint);
      return;
    }

    var q = query.toLowerCase();
    var matches = searchIndex.filter(function (item) {
      return (
        item.title.toLowerCase().indexOf(q) !== -1 ||
        item.excerpt.toLowerCase().indexOf(q) !== -1 ||
        item.category.toLowerCase().indexOf(q) !== -1 ||
        (item.keywords && item.keywords.toLowerCase().indexOf(q) !== -1)
      );
    });

    if (matches.length === 0) {
      var empty = document.createElement("li");
      empty.className = "search-empty";
      empty.textContent = "No results for “" + query + "”. Try a different word, or visit the Contact page to ask us directly.";
      resultsList.appendChild(empty);
      return;
    }

    matches.slice(0, 20).forEach(function (item) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = item.url;
      a.innerHTML =
        '<span class="result-title">' + escapeHtml(item.title) +
        '<span class="result-cat">' + escapeHtml(item.category) + "</span></span>" +
        '<div class="result-excerpt">' + escapeHtml(item.excerpt) + "</div>";
      li.appendChild(a);
      resultsList.appendChild(li);
    });
  }

  // Wires one input+results pair up to the shared index, and returns a
  // handle with .refresh() so callers (the overlay's open button) can
  // force a re-render — e.g. after the index gains its photo entries,
  // or when the overlay opens with whatever query was left in it.
  function wireSearchBox(input, resultsList, emptyHint) {
    if (!input || !resultsList) return null;
    var box = { refresh: function () { renderResultsInto(resultsList, input.value.trim(), emptyHint); } };
    boxes.push(box);
    input.addEventListener("input", box.refresh);
    return box;
  }

  var overlay = document.querySelector(".search-overlay");
  if (overlay) {
    var openBtns = document.querySelectorAll("[data-search-open]");
    var closeBtn = overlay.querySelector(".search-close");
    var overlayInput = overlay.querySelector("#site-search-input");
    var overlayBox = wireSearchBox(
      overlayInput,
      overlay.querySelector("#site-search-results"),
      "Search the village website — try “parish council”, “library” or “events”."
    );

    openBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        overlay.classList.add("open");
        overlayInput.value = "";
        if (overlayBox) overlayBox.refresh();
        setTimeout(function () { overlayInput.focus(); }, 30);
      });
    });

    closeBtn.addEventListener("click", closeOverlay);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeOverlay();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay.classList.contains("open")) closeOverlay();
    });
  }

  function closeOverlay() {
    overlay.classList.remove("open");
  }

  // The homepage's own search box, sitting right under the hero —
  // present only on index.html, so this is a no-op (wireSearchBox
  // bails on missing elements) everywhere else.
  wireSearchBox(
    document.getElementById("home-search-input"),
    document.getElementById("home-search-results"),
    null
  );
}

function escapeHtml(str) {
  var div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
