const PHOTO_CATEGORIES = {
  streets: { label: "Streets & Buildings" },
  people: { label: "People & Events" },
  nature: { label: "Nature & Views" },
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

document.addEventListener("DOMContentLoaded", function () {
  var gridEl = document.getElementById("photo-grid");
  if (!gridEl) return;

  var filterEl = document.getElementById("photo-filters");
  var searchInput = document.getElementById("photo-search-input");
  var lightbox = document.getElementById("photo-lightbox");
  var lightboxImg = lightbox.querySelector(".photo-lightbox-img");
  var lightboxCaption = lightbox.querySelector(".photo-lightbox-caption");
  var lightboxMeta = lightbox.querySelector(".photo-lightbox-meta");
  var lightboxViewMap = lightbox.querySelector(".photo-lightbox-viewmap");
  var lightboxViewDoc = lightbox.querySelector(".photo-lightbox-viewdoc");
  var DOC_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v5h5"/></svg>';
  var docLightbox = document.getElementById("doc-lightbox");
  var docLightboxFrame = docLightbox.querySelector(".doc-lightbox-frame");
  var docLightboxTitle = docLightbox.querySelector(".doc-lightbox-title");
  var docLightboxDownload = docLightbox.querySelector(".doc-lightbox-download");
  var minimapEl = document.getElementById("photo-lightbox-minimap");
  var miniMap = null;
  var miniMarker = null;
  var activeCategory = "streets";
  var allPhotos = [];
  var visiblePhotos = [];
  var currentIndex = 0;

  PHOTOS_DATA_PROMISE.then(function (photos) {
    allPhotos = photos;
    setCategoryTileImages();
    renderGrid();
    maybeOpenFromHash();
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
    Array.prototype.forEach.call(filterEl.querySelectorAll("button[data-category]"), function (btn) {
      var photo = latestByCategory[btn.dataset.category];
      if (photo) btn.style.backgroundImage = "url('" + photo.src + "')";
    });
  }

  function matches(photo, query) {
    if (photo.category !== activeCategory) return false;
    if (!query) return true;
    var haystack = (photo.caption + " " + photo.date + " " + photo.credit).toLowerCase();
    return haystack.indexOf(query) !== -1;
  }

  function renderGrid() {
    gridEl.innerHTML = "";
    var query = searchInput ? searchInput.value.trim().toLowerCase() : "";
    visiblePhotos = allPhotos.filter(function (p) { return matches(p, query); });

    if (visiblePhotos.length === 0) {
      var empty = document.createElement("p");
      empty.className = "search-empty";
      empty.textContent = "No photos match. Try a different search or category.";
      gridEl.appendChild(empty);
      return;
    }

    visiblePhotos.forEach(function (photo, index) {
      var fig = document.createElement("button");
      fig.type = "button";
      fig.className = "photo-thumb";
      fig.setAttribute("aria-label", "View photo: " + photo.caption);
      fig.innerHTML =
        '<img src="' + photo.src + '" alt="' + escapeHtml(photo.caption) + '" loading="lazy">' +
        (photo.example ? '<span class="map-example-badge photo-thumb-badge">Example</span>' : "") +
        (photo.doc ? '<span class="photo-thumb-docbadge" title="Includes a document">' + DOC_ICON + '</span>' : "");
      fig.addEventListener("click", function () { openLightbox(index); });
      gridEl.appendChild(fig);
    });
  }

  function openLightbox(index) {
    currentIndex = index;
    lightbox.classList.add("open");
    showPhoto();
    document.addEventListener("keydown", onKeydown);
    var photo = visiblePhotos[currentIndex];
    if (photo) history.replaceState(null, "", "#photo-" + photo.id);
  }

  function closeLightbox() {
    lightbox.classList.remove("open");
    document.removeEventListener("keydown", onKeydown);
    history.replaceState(null, "", location.pathname + location.search + "#photos");
  }

  function showPhoto() {
    var photo = visiblePhotos[currentIndex];
    lightboxImg.src = photo.src;
    lightboxImg.alt = photo.caption;
    lightboxCaption.textContent = photo.caption;
    var cat = (PHOTO_CATEGORIES[photo.category] || {}).label || photo.category;
    lightboxMeta.textContent = [cat, photo.date, photo.credit !== "—" ? "Credit: " + photo.credit : null]
      .filter(Boolean).join(" · ");
    history.replaceState(null, "", "#photo-" + photo.id);

    var hasLocation = typeof photo.lat === "number" && typeof photo.lng === "number";

    if (lightboxViewMap) {
      lightboxViewMap.hidden = !hasLocation;
      lightboxViewMap.onclick = hasLocation ? function () { goToFullMap(photo); } : null;
    }

    if (minimapEl) {
      minimapEl.classList.toggle("visible", hasLocation);
      minimapEl.onclick = hasLocation ? function () { goToFullMap(photo); } : null;
      if (hasLocation) updateMinimap(photo);
    }

    if (lightboxViewDoc) {
      var hasDoc = typeof photo.doc === "string" && photo.doc;
      lightboxViewDoc.hidden = !hasDoc;
      lightboxViewDoc.onclick = hasDoc ? function () { openDocLightbox(photo); } : null;
    }
  }

  function goToFullMap(photo) {
    closeLightbox();
    if (typeof window.flyToPhotoLocation === "function") {
      window.flyToPhotoLocation(photo.lat, photo.lng, photo);
    }
  }

  function updateMinimap(photo) {
    if (typeof L === "undefined") return;
    var latlng = [photo.lat, photo.lng];
    if (!miniMap) {
      miniMap = L.map(minimapEl, {
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        boxZoom: false,
        keyboard: false,
        attributionControl: false
      }).setView(latlng, 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(miniMap);
      miniMarker = L.marker(latlng).addTo(miniMap);
    } else {
      miniMap.setView(latlng, 15);
      miniMarker.setLatLng(latlng);
    }
    miniMap.invalidateSize();
  }

  function openDocLightbox(photo) {
    docLightboxTitle.textContent = photo.caption;
    docLightboxFrame.src = photo.doc;
    docLightboxDownload.href = photo.doc;
    docLightboxDownload.setAttribute("download", photo.doc.split("/").pop());
    docLightbox.classList.add("open");
  }

  function closeDocLightbox() {
    docLightbox.classList.remove("open");
    docLightboxFrame.src = "";
  }

  function onKeydown(e) {
    if (docLightbox.classList.contains("open")) {
      if (e.key === "Escape") closeDocLightbox();
      return;
    }
    if (e.key === "Escape") closeLightbox();
  }

  function setActiveCategory(category) {
    activeCategory = category;
    if (filterEl) {
      Array.prototype.forEach.call(filterEl.querySelectorAll("button"), function (b) {
        b.classList.toggle("active", b.dataset.category === category);
      });
    }
    renderGrid();
  }

  function openPhotoById(id, skipScroll) {
    var target = allPhotos.find(function (p) { return p.id === id; });
    if (!target) return;
    if (target.category !== activeCategory) setActiveCategory(target.category);
    var idx = visiblePhotos.findIndex(function (p) { return p.id === id; });
    if (idx === -1) return;
    if (!skipScroll) document.getElementById("photos").scrollIntoView();
    openLightbox(idx);
  }
  window.openPhotoById = openPhotoById;

  function maybeOpenFromHash() {
    var match = location.hash.match(/^#photo-(.+)$/);
    if (!match) return;
    openPhotoById(match[1]);
  }

  lightbox.querySelector(".photo-lightbox-close").addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", function (e) {
    if (e.target === lightbox) closeLightbox();
  });

  docLightbox.querySelector(".doc-lightbox-close").addEventListener("click", closeDocLightbox);
  docLightbox.addEventListener("click", function (e) {
    if (e.target === docLightbox) closeDocLightbox();
  });

  if (filterEl) {
    filterEl.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-category]");
      if (!btn) return;
      setActiveCategory(btn.dataset.category);
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", renderGrid);
  }
});
