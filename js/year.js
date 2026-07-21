// One year's own page (year.html?year=1929) — "everything from that
// year": the Village Chronology entries, events and photos that share
// it, each with a checkbox so a visitor can build their own PDF from
// just the parts they want, rather than getting the whole page or
// nothing. Replaces the old chronology.html?year=X in-page highlight —
// see js/chronology.js, which now links each entry's year straight
// here instead.
document.addEventListener("DOMContentLoaded", function () {
  var headingEl = document.getElementById("year-heading");
  var crumbEl = document.getElementById("year-crumb");
  var subheadingEl = document.getElementById("year-subheading");
  var toolbarEl = document.getElementById("year-select-toolbar");
  var chronologySectionEl = document.getElementById("year-chronology-section");
  var chronologyListEl = document.getElementById("year-chronology-list");
  var eventsSectionEl = document.getElementById("year-events-section");
  var eventsListEl = document.getElementById("year-events-list");
  var photosSectionEl = document.getElementById("year-photos-section");
  var photosListEl = document.getElementById("year-photos-list");
  var notFoundEl = document.getElementById("year-not-found");
  var selectAllBtn = document.getElementById("year-select-all");
  var selectNoneBtn = document.getElementById("year-select-none");
  var downloadPdfBtn = document.getElementById("year-download-pdf-btn");
  if (!chronologyListEl) return;

  var yearParam = parseInt(new URLSearchParams(location.search).get("year"), 10);
  if (!yearParam) {
    showNotFound();
    return;
  }

  // Same "first 3-4 digit number" approach as js/chronology.js's own
  // parseYear — duplicated rather than shared, since it's two lines
  // and the two files load independently of each other (year.html
  // doesn't load js/chronology.js, and shouldn't need to just for this).
  function parseChronologyYear(str) {
    var m = String(str || "").match(/\d{3,4}/);
    return m ? parseInt(m[0], 10) : null;
  }

  var matchedEntries = [];
  var matchedEvents = [];
  var matchedPhotos = [];

  var chronologyPromise = fetch("data/chronology.json").then(function (res) { return res.ok ? res.json() : { entries: [] }; }).catch(function () { return { entries: [] }; });
  var eventsPromise = fetch("data/events.json").then(function (res) { return res.ok ? res.json() : []; }).catch(function () { return []; });
  var photosPromise = (typeof PHOTOS_DATA_PROMISE !== "undefined") ? PHOTOS_DATA_PROMISE : Promise.resolve([]);

  Promise.all([chronologyPromise, photosPromise, eventsPromise]).then(function (results) {
    var chronologyData = results[0], photos = results[1], events = results[2];

    matchedEntries = (chronologyData.entries || []).filter(function (e) {
      return parseChronologyYear(e.year) === yearParam;
    });
    matchedEvents = events.filter(function (e) { return extractYear(e.date) === yearParam; });
    matchedPhotos = photos.filter(function (p) { return extractYear(p.date) === yearParam; });

    if (matchedEntries.length === 0 && matchedEvents.length === 0 && matchedPhotos.length === 0) {
      showNotFound();
      return;
    }

    document.title = "Thurmaston in " + yearParam + " | Memories of Thurmaston";
    headingEl.textContent = "Thurmaston in " + yearParam;
    crumbEl.textContent = String(yearParam);

    var parts = [];
    if (matchedEntries.length) parts.push(matchedEntries.length + (matchedEntries.length === 1 ? " chronology entry" : " chronology entries"));
    if (matchedEvents.length) parts.push(matchedEvents.length + (matchedEvents.length === 1 ? " event" : " events"));
    if (matchedPhotos.length) parts.push(matchedPhotos.length + (matchedPhotos.length === 1 ? " photo" : " photos"));
    subheadingEl.textContent = parts.join(", ") + ". Tick the ones you want, then download them together as a PDF.";
    subheadingEl.hidden = false;

    renderChronology();
    renderEvents();
    renderPhotos();
    toolbarEl.hidden = false;
    wireSelectButtons();
    wireDownloadPdf();
  });

  function showNotFound() {
    notFoundEl.hidden = false;
    headingEl.textContent = "Nothing found";
    crumbEl.textContent = "Not found";
  }

  function renderChronology() {
    if (matchedEntries.length === 0) return;
    chronologyListEl.innerHTML = matchedEntries.map(function (entry, i) {
      return (
        '<li class="year-pick-item">' +
          '<input type="checkbox" class="year-checkbox" data-type="entry" data-id="' + i + '" checked>' +
          '<div class="year-pick-item-body">' +
            '<p class="year-pick-item-text">' + escapeHtml(entry.text || "") + "</p>" +
          "</div>" +
        "</li>"
      );
    }).join("");
    chronologySectionEl.hidden = false;
  }

  function renderEvents() {
    if (matchedEvents.length === 0) return;
    eventsListEl.innerHTML = matchedEvents.map(function (event) {
      var meta = [event.date, (event.photos || []).length ? (event.photos.length + (event.photos.length === 1 ? " photo" : " photos")) : null].filter(Boolean).join(" · ");
      return (
        '<li class="year-pick-item">' +
          '<input type="checkbox" class="year-checkbox" data-type="event" data-id="' + escapeAttr(event.id) + '" checked>' +
          '<div class="year-pick-item-body">' +
            '<div class="year-pick-item-title"><a href="event.html?event=' + encodeURIComponent(event.id) + '">' + escapeHtml(event.name) + "</a></div>" +
            (meta ? '<p class="year-pick-item-meta">' + escapeHtml(meta) + "</p>" : "") +
          "</div>" +
        "</li>"
      );
    }).join("");
    eventsSectionEl.hidden = false;
  }

  function renderPhotos() {
    if (matchedPhotos.length === 0) return;
    photosListEl.innerHTML = matchedPhotos.map(function (photo) {
      var subtitle = [photo.date, photo.location].filter(Boolean).join(" · ");
      return (
        '<li class="year-photo-item">' +
          '<input type="checkbox" class="year-checkbox" data-type="photo" data-id="' + escapeAttr(photo.id) + '" checked>' +
          '<a class="photo-thumb" href="place.html?photo=' + encodeURIComponent(photo.id) + '">' +
            '<img src="' + escapeAttr(photo.src) + '" alt="' + escapeHtml(photo.caption) + '" loading="lazy">' +
            '<span class="photo-thumb-caption"><strong>' + escapeHtml(photo.caption) + '</strong>' +
              (subtitle ? "<span>" + escapeHtml(subtitle) + "</span>" : "") +
            "</span>" +
          "</a>" +
        "</li>"
      );
    }).join("");
    photosSectionEl.hidden = false;
  }

  function escapeAttr(str) { return escapeHtml(str); }

  function wireSelectButtons() {
    selectAllBtn.addEventListener("click", function () { setAllChecked(true); });
    selectNoneBtn.addEventListener("click", function () { setAllChecked(false); });
  }

  function setAllChecked(checked) {
    Array.prototype.forEach.call(document.querySelectorAll(".year-checkbox"), function (box) {
      box.checked = checked;
    });
  }

  function checkedIds(type) {
    var ids = {};
    Array.prototype.forEach.call(document.querySelectorAll('.year-checkbox[data-type="' + type + '"]:checked'), function (box) {
      ids[box.dataset.id] = true;
    });
    return ids;
  }

  // Same "open in a viewer tab" pipeline as every other PDF on this
  // site (see js/pdf-helpers.js) — built fresh from whichever
  // checkboxes are ticked at the moment Download is clicked, in the
  // same chronology → events → photos order the page itself shows
  // them in.
  function wireDownloadPdf() {
    downloadPdfBtn.onclick = function () {
      var checkedEntryIds = checkedIds("entry");
      var checkedEventIds = checkedIds("event");
      var checkedPhotoIds = checkedIds("photo");

      var selectedEntries = matchedEntries.filter(function (e, i) { return checkedEntryIds[i]; });
      var selectedEvents = matchedEvents.filter(function (e) { return checkedEventIds[e.id]; });
      var selectedPhotos = matchedPhotos.filter(function (p) { return checkedPhotoIds[p.id]; });

      if (selectedEntries.length === 0 && selectedEvents.length === 0 && selectedPhotos.length === 0) {
        alert("Tick at least one item to include in the PDF.");
        return;
      }

      openPdfInViewer(function () {
        // A cover photo for each selected event (first in its own
        // photos list, if any) plus every selected photo's own image —
        // preloaded together so the PDF builder never has to await an
        // image mid-layout.
        var eventCoverSrcs = selectedEvents.map(function (e) { return (e.photos || [])[0]; }).filter(Boolean);
        var photoSrcs = selectedPhotos.map(function (p) { return p.src; });
        var allSrcs = eventCoverSrcs.concat(photoSrcs);

        return Promise.all([
          Promise.all(allSrcs.map(function (src) { return loadImageElement(src).catch(function () { return null; }); })),
          buildQrPngDataUrl(yearPageUrl())
        ]).then(function (results) {
          var imagesBySrc = {};
          allSrcs.forEach(function (src, i) { imagesBySrc[src] = results[0][i]; });
          return buildYearPdf(selectedEntries, selectedEvents, selectedPhotos, imagesBySrc, results[1]);
        });
      }, "thurmaston-" + yearParam + ".pdf", downloadPdfBtn, "Thurmaston in " + yearParam);
    };
  }

  function yearPageUrl() {
    return SITE_URL + "/year.html?year=" + encodeURIComponent(yearParam);
  }

  function buildYearPdf(entries, events, photos, imagesBySrc, qrDataUrl) {
    var doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
    var title = "Thurmaston in " + yearParam;
    doc.setProperties({ title: title });
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
    var titleLines = doc.splitTextToSize(title, titleMaxWidth);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 8 + 4;
    if (qrDataUrl) y = Math.max(y, margin + qrSize + 13);

    if (entries.length) {
      y = addPdfHeading(doc, "From the Chronology", margin, y);
      entries.forEach(function (entry) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.5);
        y = addPdfParagraph(doc, entry.text, margin, y, maxWidth);
      });
    }

    if (events.length) {
      y = addPdfHeading(doc, "Events", margin, y);
      events.forEach(function (event) {
        y = addYearPdfEventEntry(doc, event, imagesBySrc[(event.photos || [])[0]], margin, y, maxWidth);
      });
    }

    if (photos.length) {
      y = addPdfHeading(doc, "Photos", margin, y);
      photos.forEach(function (photo) {
        y = addYearPdfPhotoEntry(doc, photo, imagesBySrc[photo.src], margin, y, maxWidth);
      });
    }

    stampPdfFooter(doc, margin);
    return doc;
  }

  function addYearPdfImage(doc, img, src, margin, y, maxWidth, maxImgHeight) {
    var ratio = img.naturalHeight / img.naturalWidth;
    var imgWidth = maxWidth;
    var imgHeight = imgWidth * ratio;
    if (imgHeight > maxImgHeight) {
      imgHeight = maxImgHeight;
      imgWidth = imgHeight / ratio;
    }
    y = ensureSpace(doc, y, imgHeight, margin);
    doc.addImage(img, guessImageFormat(src), margin, y, imgWidth, imgHeight);
    return y + imgHeight + 6;
  }

  function addYearPdfEventEntry(doc, event, img, margin, y, maxWidth) {
    var coverSrc = (event.photos || [])[0];
    if (img) y = addYearPdfImage(doc, img, coverSrc, margin, y, maxWidth, 80);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    y = ensureSpace(doc, y, 7, margin);
    doc.text(event.name || "Untitled event", margin, y);
    y += 7;

    if (event.date) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100);
      y = ensureSpace(doc, y, 6, margin);
      doc.text(event.date, margin, y);
      doc.setTextColor(0);
      y += 6;
    }

    doc.setFontSize(11);
    if (event.description) {
      y = addPdfParagraph(doc, event.description, margin, y, maxWidth);
    }
    return y + 6;
  }

  function addYearPdfPhotoEntry(doc, photo, img, margin, y, maxWidth) {
    if (img) y = addYearPdfImage(doc, img, photo.src, margin, y, maxWidth, 90);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    y = ensureSpace(doc, y, 7, margin);
    doc.text(photo.caption || "Untitled photo", margin, y);
    y += 7;

    var metaParts = [photo.date, photo.location];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    y = ensureSpace(doc, y, 6, margin);
    doc.text(metaParts.filter(Boolean).join("  ·  "), margin, y);
    doc.setTextColor(0);
    return y + 10;
  }
});
