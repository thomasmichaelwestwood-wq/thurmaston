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

function initSearch() {
  var openBtns = document.querySelectorAll("[data-search-open]");
  var overlay = document.querySelector(".search-overlay");
  if (!overlay) return;
  var closeBtn = overlay.querySelector(".search-close");
  var input = overlay.querySelector("#site-search-input");
  var resultsList = overlay.querySelector("#site-search-results");

  openBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      overlay.classList.add("open");
      input.value = "";
      renderResults("");
      setTimeout(function () { input.focus(); }, 30);
    });
  });

  closeBtn.addEventListener("click", closeOverlay);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeOverlay();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.classList.contains("open")) closeOverlay();
  });

  function closeOverlay() {
    overlay.classList.remove("open");
  }

  input.addEventListener("input", function () {
    renderResults(input.value.trim());
  });

  var photoSearchEntries = [];
  if (typeof PHOTOS_DATA_PROMISE !== "undefined") {
    PHOTOS_DATA_PROMISE.then(function (photos) {
      photoSearchEntries = photos.map(function (p) {
        return {
          title: p.caption,
          url: "place.html?photo=" + encodeURIComponent(p.id),
          category: "Photo",
          excerpt: [p.date, p.credit !== "—" ? "Credit: " + p.credit : null].filter(Boolean).join(" · ")
        };
      });
      if (input.value.trim()) renderResults(input.value.trim());
    });
  }

  function renderResults(query) {
    resultsList.innerHTML = "";
    var index = (typeof SITE_SEARCH_INDEX !== "undefined") ? SITE_SEARCH_INDEX.concat(photoSearchEntries) : photoSearchEntries;

    if (!query) {
      var hint = document.createElement("li");
      hint.className = "search-hint";
      hint.textContent = "Search the village website — try “parish council”, “library” or “events”.";
      resultsList.appendChild(hint);
      return;
    }

    var q = query.toLowerCase();
    var matches = index.filter(function (item) {
      return (
        item.title.toLowerCase().indexOf(q) !== -1 ||
        item.excerpt.toLowerCase().indexOf(q) !== -1 ||
        item.category.toLowerCase().indexOf(q) !== -1
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
}

function escapeHtml(str) {
  var div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
