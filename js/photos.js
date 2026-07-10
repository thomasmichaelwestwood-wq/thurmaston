document.addEventListener("DOMContentLoaded", function () {
  var gridEl = document.getElementById("photo-grid");
  if (!gridEl || typeof PHOTOS_DATA === "undefined") return;

  var filterEl = document.getElementById("photo-filters");
  var lightbox = document.getElementById("photo-lightbox");
  var lightboxImg = lightbox.querySelector(".photo-lightbox-img");
  var lightboxCaption = lightbox.querySelector(".photo-lightbox-caption");
  var lightboxMeta = lightbox.querySelector(".photo-lightbox-meta");
  var activeCategory = "all";
  var visiblePhotos = [];
  var currentIndex = 0;

  function renderGrid() {
    gridEl.innerHTML = "";
    visiblePhotos = PHOTOS_DATA.filter(function (p) {
      return activeCategory === "all" || p.category === activeCategory;
    });

    if (visiblePhotos.length === 0) {
      var empty = document.createElement("p");
      empty.className = "search-empty";
      empty.textContent = "No photos in this category yet.";
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
  }

  function closeLightbox() {
    lightbox.classList.remove("open");
    document.removeEventListener("keydown", onKeydown);
  }

  function showPhoto() {
    var photo = visiblePhotos[currentIndex];
    lightboxImg.src = photo.src;
    lightboxImg.alt = photo.caption;
    lightboxCaption.textContent = photo.caption;
    var cat = (PHOTO_CATEGORIES[photo.category] || {}).label || photo.category;
    lightboxMeta.textContent = [cat, photo.date, photo.credit !== "—" ? "Credit: " + photo.credit : null]
      .filter(Boolean).join(" · ");
  }

  function onKeydown(e) {
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowRight") { currentIndex = (currentIndex + 1) % visiblePhotos.length; showPhoto(); }
    if (e.key === "ArrowLeft") { currentIndex = (currentIndex - 1 + visiblePhotos.length) % visiblePhotos.length; showPhoto(); }
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

  renderGrid();
});
