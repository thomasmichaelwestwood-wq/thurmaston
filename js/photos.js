const PHOTO_CATEGORIES = {
  streets: { label: "Streets & Buildings" },
  people: { label: "People & Events" },
  nature: { label: "Nature & Views" },
  other: { label: "Other" }
};

var PHOTOS_DATA_PROMISE = fetch("data/photos.json")
  .then(function (res) { return res.ok ? res.json() : []; })
  .catch(function () { return []; });

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
  var activeCategory = "all";
  var allPhotos = [];
  var visiblePhotos = [];
  var currentIndex = 0;

  PHOTOS_DATA_PROMISE.then(function (photos) {
    allPhotos = photos;
    renderGrid();
    maybeOpenFromHash();
  });

  function matches(photo, query) {
    if (activeCategory !== "all" && photo.category !== activeCategory) return false;
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
        (photo.example ? '<span class="map-example-badge photo-thumb-badge">Example</span>' : "");
      fig.addEventListener("click", function () { openLightbox(index); });
      gridEl.appendChild(fig);
    });
  }

  function openLightbox(index) {
    currentIndex = index;
    showPhoto();
    lightbox.classList.add("open");
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

    if (lightboxViewMap) {
      var hasLocation = typeof photo.lat === "number" && typeof photo.lng === "number";
      lightboxViewMap.hidden = !hasLocation;
      lightboxViewMap.onclick = hasLocation ? function () {
        closeLightbox();
        if (typeof window.flyToPhotoLocation === "function") {
          window.flyToPhotoLocation(photo.lat, photo.lng, photo);
        }
      } : null;
    }
  }

  function onKeydown(e) {
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowRight") { currentIndex = (currentIndex + 1) % visiblePhotos.length; showPhoto(); }
    if (e.key === "ArrowLeft") { currentIndex = (currentIndex - 1 + visiblePhotos.length) % visiblePhotos.length; showPhoto(); }
  }

  function maybeOpenFromHash() {
    var match = location.hash.match(/^#photo-(.+)$/);
    if (!match) return;
    var idx = visiblePhotos.findIndex(function (p) { return p.id === match[1]; });
    if (idx === -1) return;
    document.getElementById("photos").scrollIntoView();
    openLightbox(idx);
  }

  lightbox.querySelector(".photo-lightbox-close").addEventListener("click", closeLightbox);
  lightbox.querySelector(".photo-lightbox-next").addEventListener("click", function () {
    currentIndex = (currentIndex + 1) % visiblePhotos.length; showPhoto();
  });
  lightbox.querySelector(".photo-lightbox-prev").addEventListener("click", function () {
    currentIndex = (currentIndex - 1 + visiblePhotos.length) % visiblePhotos.length; showPhoto();
  });
  lightbox.addEventListener("click", function (e) {
    if (e.target === lightbox) closeLightbox();
  });

  if (filterEl) {
    filterEl.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-category]");
      if (!btn) return;
      activeCategory = btn.dataset.category;
      Array.prototype.forEach.call(filterEl.querySelectorAll("button"), function (b) {
        b.classList.toggle("active", b === btn);
      });
      renderGrid();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", renderGrid);
  }
});
