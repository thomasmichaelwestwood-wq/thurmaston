const PHOTO_CATEGORIES = {
  streets: { label: "Streets & Buildings" },
  people: { label: "People" },
  events: { label: "Events" },
  nature: { label: "Nature & Views" },
  aerial: { label: "Aerial" },
  other: { label: "Other" },
  churches: { label: "Churches & Religious Buildings" },
  groups: { label: "Groups & Organisations" },
  industry: { label: "Industry" },
  schools: { label: "Schools" },
  sports: { label: "Sports" }
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

// Same thumb, wrapped with a tick-to-include checkbox for the category
// page's "download selected as PDF" toolbar (see renderGrid below) — a
// sibling of the <a>, not nested inside it, so clicking the checkbox
// never also triggers the thumbnail's own navigation to place.html.
function buildPickablePhotoItem(photo) {
  var wrapper = document.createElement("div");
  wrapper.className = "pick-photo-item";
  var checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "pick-checkbox";
  checkbox.dataset.id = photo.id;
  checkbox.checked = true;
  wrapper.appendChild(checkbox);
  wrapper.appendChild(buildPhotoThumb(photo));
  return wrapper;
}

// Oldest-first by the photo's own real date (extractYear), with
// anything undated held back into its own group at the end — same
// convention js/location.js's orderPhotos already established for a
// place's timeline, just flattened into one array rather than a
// {dated, undated} pair, since the category grid doesn't need a
// separate "Date unknown" heading the way a timeline page does.
function orderPhotosChronologically(photos) {
  var dated = [];
  var undated = [];
  photos.forEach(function (p) {
    var year = extractYear(p.date);
    if (year) dated.push({ photo: p, year: year });
    else undated.push(p);
  });
  dated.sort(function (a, b) { return a.year - b.year; });
  return dated.map(function (entry) { return entry.photo; }).concat(undated);
}

document.addEventListener("DOMContentLoaded", function () {
  var gridEl = document.getElementById("photo-grid");
  var gridStatusEl = document.getElementById("photo-grid-status");
  var gridFooterEl = document.getElementById("photo-grid-footer");
  var filterEl = document.getElementById("photo-filters");
  var toolbarEl = document.getElementById("photo-pick-toolbar");
  var selectAllBtn = document.getElementById("photo-select-all");
  var selectNoneBtn = document.getElementById("photo-select-none");
  var downloadPdfBtn = document.getElementById("photo-download-pdf-btn");
  var PREVIEW_COUNT = 8;
  var showingAll = false;
  var activeCategory = (typeof window.LOCKED_CATEGORY === "string" && window.LOCKED_CATEGORY) ? window.LOCKED_CATEGORY : "streets";
  var allPhotos = [];
  var visiblePhotos = [];

  if (selectAllBtn && selectNoneBtn) wireCheckboxSelectAll(".pick-checkbox", selectAllBtn, selectNoneBtn);

  PHOTOS_DATA_PROMISE.then(function (photos) {
    allPhotos = photos;
    setCategoryTileImages();
    renderGrid();
  });

  // Each category tab shows its most recently uploaded photo as a
  // background image — allPhotos is newest-first, so the first match
  // per category found while scanning is the most recent one.
  //
  // Bug, fixed: building the CSS value as "url('" + src + "')" silently
  // broke for any photo whose filename contains an apostrophe or single
  // quote (a real, ordinary filename — "...Johnson's Bridge...", "'the
  // plank'..." — not an edge case) — the embedded quote closes the CSS
  // string early, the browser rejects the whole value as invalid, and
  // el.style.backgroundImage = "<invalid>" just silently no-ops rather
  // than throwing, so the tile quietly stayed blank with no console
  // error at all. JSON.stringify(src) instead produces a properly
  // double-quoted, correctly escaped CSS string no matter what
  // punctuation the filename contains.
  function setCategoryTileImages() {
    if (!filterEl) return;
    var latestByCategory = {};
    allPhotos.forEach(function (photo) {
      if (!latestByCategory[photo.category]) latestByCategory[photo.category] = photo;
    });
    Array.prototype.forEach.call(filterEl.querySelectorAll("[data-category]"), function (btn) {
      // The image lives on its own inner .photo-filter-photo element,
      // not the <a> itself — the label sits below it in normal flow
      // (not overlaid on top of the photo), so each needs its own box.
      var photoEl = btn.querySelector(".photo-filter-photo") || btn;
      var photo = latestByCategory[btn.dataset.category];
      if (photo) {
        photoEl.style.backgroundImage = "url(" + JSON.stringify(photo.src) + ")";
      } else if (btn.dataset.category === "events") {
        // Event Pages (data/events/<id>.json, aggregated into
        // data/events.json — see the admin's "Event Pages" collection)
        // keep their photos in their own list, separate from the flat
        // "Events (single photos)" collection allPhotos/data/photos.json
        // covers above — so the Events tile could have real photos
        // behind it (via Event Pages) while still finding nothing in
        // latestByCategory. Falls back to the newest Event Page that
        // has at least one photo (events.json is already sorted
        // newest-first — see rebuild-events-index.js), same "most
        // recently added" convention every other tile already follows.
        fetch("data/events.json").then(function (res) { return res.ok ? res.json() : []; }).catch(function () { return []; }).then(function (events) {
          var withPhotos = events.find(function (e) { return e.photos && e.photos.length; });
          if (withPhotos) photoEl.style.backgroundImage = "url(" + JSON.stringify(withPhotos.photos[0]) + ")";
        });
      }
    });
  }

  function matches(photo) {
    return photo.category === activeCategory;
  }

  // The grid never dumps the whole archive by default — with hundreds or
  // thousands of photos that's just an endless scroll. Instead it shows
  // the earliest PREVIEW_COUNT, oldest-first (orderPhotosChronologically
  // — was newest-added-first before "chronologically" was requested
  // explicitly) and leaves finding a specific one to the search box
  // above (js/main.js's shared dropdown search, not filtered to this
  // grid — see CLAUDE.md) or the map's pins, with a "show all" escape
  // hatch for anyone who really wants to scroll the lot.
  function renderGrid() {
    if (!gridEl) return;
    visiblePhotos = orderPhotosChronologically(allPhotos.filter(matches));

    gridEl.innerHTML = "";

    if (visiblePhotos.length === 0) {
      var empty = document.createElement("p");
      empty.className = "search-empty";
      empty.textContent = "No photos in this category yet — check back soon, or explore another category.";
      gridEl.appendChild(empty);
      setGridStatus(0, false);
      renderShowAllButton(0, false);
      updatePickToolbar([], false);
      return;
    }

    var capped = !showingAll && visiblePhotos.length > PREVIEW_COUNT;
    var displayPhotos = capped ? visiblePhotos.slice(0, PREVIEW_COUNT) : visiblePhotos;

    displayPhotos.forEach(function (photo) {
      gridEl.appendChild(buildPickablePhotoItem(photo));
    });

    setGridStatus(visiblePhotos.length, capped);
    renderShowAllButton(visiblePhotos.length, capped);
    updatePickToolbar(displayPhotos, capped);
  }

  function setGridStatus(total, capped) {
    if (!gridStatusEl) return;
    if (!total) { gridStatusEl.textContent = ""; return; }
    if (capped) {
      gridStatusEl.textContent = "Showing the earliest " + PREVIEW_COUNT + " of " + total + " photos — search above or use the map to find more, or \"Show all\" below to browse (and build a PDF from) every one.";
    } else {
      gridStatusEl.textContent = "All " + total + (total === 1 ? " photo" : " photos") + " in this category.";
    }
  }

  // The picker toolbar (Select all/none + Download PDF) only appears
  // once every matching photo is actually on the page with a checkbox
  // of its own — while the grid is still capped at PREVIEW_COUNT,
  // showing it would silently only let a visitor build a PDF from the
  // handful currently visible, not the whole category, which reads as
  // a bug ("I picked select-all, why is my PDF missing photos?") rather
  // than the deliberate space-saving the cap actually is elsewhere on
  // this page.
  function updatePickToolbar(displayPhotos, capped) {
    if (!toolbarEl) return;
    if (capped || displayPhotos.length < 2) {
      toolbarEl.hidden = true;
      return;
    }
    toolbarEl.hidden = false;
    wireDownloadPdf(displayPhotos);
  }

  function wireDownloadPdf(photos) {
    if (!downloadPdfBtn) return;
    var label = (typeof CATEGORY_INFO !== "undefined" && CATEGORY_INFO[activeCategory]) ? CATEGORY_INFO[activeCategory].label : "Photos";
    downloadPdfBtn.onclick = function () {
      var checkedIds = checkedPickIds(".pick-checkbox");
      var selected = photos.filter(function (p) { return checkedIds[p.id]; });
      if (selected.length === 0) {
        alert("Tick at least one photo to include in the PDF.");
        return;
      }
      openPdfInViewer(function () {
        return Promise.all([
          Promise.all(selected.map(function (p) { return loadImageElement(p.src).catch(function () { return null; }); })),
          buildQrPngDataUrl(SITE_URL + "/category.html?cat=" + encodeURIComponent(activeCategory))
        ]).then(function (results) {
          var imagesById = {};
          selected.forEach(function (p, i) { imagesById[p.id] = results[0][i]; });
          return buildCategoryPdf(label, selected, imagesById, results[1]);
        });
      }, pdfFilenameBase(label) + ".pdf", downloadPdfBtn, label);
    };
  }

  function buildCategoryPdf(label, photos, imagesById, qrDataUrl) {
    var doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
    doc.setProperties({ title: label });
    var pageWidth = doc.internal.pageSize.getWidth();
    var margin = 18;
    var maxWidth = pageWidth - margin * 2;
    var y = margin;

    var qrSize = 26;
    var titleMaxWidth = maxWidth;
    if (qrDataUrl) {
      titleMaxWidth = maxWidth - qrSize - 6;
      doc.addImage(qrDataUrl, "PNG", pageWidth - margin - qrSize, margin, qrSize, qrSize);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(120);
      var qrCaptionX = pageWidth - margin - qrSize / 2;
      doc.text("Scan to view online", qrCaptionX, margin + qrSize + 4, { align: "center" });
      doc.text("Downloaded " + downloadedDateLabel(), qrCaptionX, margin + qrSize + 8, { align: "center" });
      doc.setTextColor(0);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    var titleLines = doc.splitTextToSize(label, titleMaxWidth);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 8 + 4;
    if (qrDataUrl) y = Math.max(y, margin + qrSize + 13);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100);
    y = ensureSpace(doc, y, 8, margin);
    doc.text(photos.length + (photos.length === 1 ? " photo" : " photos") + ".", margin, y);
    doc.setTextColor(0);
    y += 10;

    photos.forEach(function (photo) {
      y = addPdfPhotoEntry(doc, photo, imagesById[photo.id], margin, y, maxWidth);
    });

    stampPdfFooter(doc, margin);
    return doc;
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
