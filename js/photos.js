const PHOTO_CATEGORIES = {
  streets: { label: "Streets & Buildings" },
  people: { label: "People" },
  events: { label: "Events" },
  nature: { label: "Nature & Views" },
  aerial: { label: "Aerial" },
  other: { label: "Other" }
};

// Hero images are for the homepage banner only — a photo used there
// (even one that's also archived from a category folder) is excluded
// here so it never also shows up in the photo archive or site search.
// The same Drive file gets resized into images/photos/ and
// images/hero-photos/ separately but keeps the same filename in both
// (it's derived from the shared Drive file ID), so matching by
// filename rather than full path catches the duplicate.
var PHOTOS_DATA_PROMISE = Promise.all([
  fetch("data/photos.json").then(function (res) { return res.ok ? res.json() : []; }).catch(function () { return []; }),
  fetch("data/hero.json").then(function (res) { return res.ok ? res.json() : []; }).catch(function () { return []; })
]).then(function (results) {
  var photos = results[0];
  function filename(src) { return src.split("/").pop(); }
  var heroFilenames = {};
  results[1].forEach(function (p) { heroFilenames[filename(p.src)] = true; });
  return photos.filter(function (p) { return !heroFilenames[filename(p.src)]; });
});

// Builds one photo-grid thumbnail — its own function so renderGrid()
// isn't the only thing that can produce one, if another page ever
// needs the same markup.
function buildPhotoThumb(photo) {
  var fig = document.createElement("a");
  fig.className = "photo-thumb";
  fig.href = "place.html?photo=" + encodeURIComponent(photo.id);
  fig.setAttribute("aria-label", "View photo: " + photo.caption);
  var subtitle = [photo.date, photo.location].filter(Boolean).join(" · ");
  fig.innerHTML =
    '<img src="' + photo.src + '" alt="' + escapeHtml(photo.caption) + '" loading="lazy">' +
    '<span class="photo-thumb-caption"><strong>' + escapeHtml(photo.caption) + '</strong>' +
    (subtitle ? '<span>' + escapeHtml(subtitle) + '</span>' : '') + '</span>';
  return fig;
}

document.addEventListener("DOMContentLoaded", function () {
  var gridEl = document.getElementById("photo-grid");
  var gridStatusEl = document.getElementById("photo-grid-status");
  var gridFooterEl = document.getElementById("photo-grid-footer");
  var filterEl = document.getElementById("photo-filters");
  var PREVIEW_COUNT = 8;
  var showingAll = false;
  var activeCategory = (typeof window.LOCKED_CATEGORY === "string" && window.LOCKED_CATEGORY) ? window.LOCKED_CATEGORY : "streets";
  var allPhotos = [];
  var visiblePhotos = [];

  PHOTOS_DATA_PROMISE.then(function (photos) {
    allPhotos = photos;
    setCategoryTileImages();
    renderGrid();
  });

  // Each category tab shows its most recently uploaded photo as a
  // background image — allPhotos is newest-first, so the first match
  // per category found while scanning is the most recent one.
  function setCategoryTileImages() {
    if (!filterEl) return;
    var latestByCategory = {};
    allPhotos.forEach(function (photo) {
      if (!latestByCategory[photo.category]) latestByCategory[photo.category] = photo;
    });
    Array.prototype.forEach.call(filterEl.querySelectorAll("[data-category]"), function (btn) {
      var photo = latestByCategory[btn.dataset.category];
      if (photo) btn.style.backgroundImage = "url('" + photo.src + "')";
    });
  }

  function matches(photo) {
    return photo.category === activeCategory;
  }

  // The grid never dumps the whole archive by default — with hundreds or
  // thousands of photos that's just an endless scroll. Instead it shows the
  // most recent PREVIEW_COUNT (allPhotos is newest-first) and leaves finding
  // a specific one to the search box above (js/main.js's shared dropdown
  // search, not filtered to this grid — see CLAUDE.md) or the map's pins,
  // with a "show all" escape hatch for anyone who really wants to scroll
  // the lot.
  function renderGrid() {
    if (!gridEl) return;
    visiblePhotos = allPhotos.filter(matches);

    gridEl.innerHTML = "";

    if (visiblePhotos.length === 0) {
      var empty = document.createElement("p");
      empty.className = "search-empty";
      empty.textContent = "No photos in this category yet — check back soon, or explore another category.";
      gridEl.appendChild(empty);
      setGridStatus(0, false);
      renderShowAllButton(0, false);
      return;
    }

    var capped = !showingAll && visiblePhotos.length > PREVIEW_COUNT;
    var displayPhotos = capped ? visiblePhotos.slice(0, PREVIEW_COUNT) : visiblePhotos;

    displayPhotos.forEach(function (photo) {
      gridEl.appendChild(buildPhotoThumb(photo));
    });

    setGridStatus(visiblePhotos.length, capped);
    renderShowAllButton(visiblePhotos.length, capped);
  }

  function setGridStatus(total, capped) {
    if (!gridStatusEl) return;
    if (!total) { gridStatusEl.textContent = ""; return; }
    if (capped) {
      gridStatusEl.textContent = "Showing the " + PREVIEW_COUNT + " most recently added photos of " + total + " — search above or use the map to find more.";
    } else {
      gridStatusEl.textContent = "All " + total + (total === 1 ? " photo" : " photos") + " in this category.";
    }
  }

  function renderShowAllButton(total, capped) {
    if (!gridFooterEl) return;
    gridFooterEl.innerHTML = "";
    if (!capped) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-show-all";
    btn.textContent = "Show all " + total + " photos";
    btn.addEventListener("click", function () {
      showingAll = true;
      renderGrid();
    });
    gridFooterEl.appendChild(btn);
  }

  if (filterEl) {
    filterEl.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-category]");
      if (!btn) return;
      activeCategory = btn.dataset.category;
      showingAll = false;
      Array.prototype.forEach.call(filterEl.querySelectorAll("button"), function (b) {
        b.classList.toggle("active", b.dataset.category === activeCategory);
      });
      renderGrid();
    });
  }
});
