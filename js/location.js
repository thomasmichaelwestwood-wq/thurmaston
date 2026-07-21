document.addEventListener("DOMContentLoaded", function () {
  var headingEl = document.getElementById("location-heading");
  var crumbEl = document.getElementById("location-crumb");
  var subheadingEl = document.getElementById("location-subheading");
  var timelineEl = document.getElementById("location-timeline");
  var notFoundEl = document.getElementById("location-not-found");
  var downloadPdfBtn = document.getElementById("location-download-pdf-btn");
  var selectActionsEl = document.getElementById("location-select-actions");
  var selectAllBtn = document.getElementById("location-select-all");
  var selectNoneBtn = document.getElementById("location-select-none");
  if (!timelineEl || typeof PHOTOS_DATA_PROMISE === "undefined") return;

  var params = new URLSearchParams(location.search);
  var locParam = params.get("loc");
  if (!locParam) {
    showNotFound();
    return;
  }

  PHOTOS_DATA_PROMISE.then(function (photos) {
    var matches = photos.filter(function (p) { return placeKey(p) === locParam; });
    if (matches.length === 0) {
      showNotFound();
      return;
    }

    // Grouped by placeKey (js/main.js — GPS coordinates first, Location
    // text as a fallback), so not every match is guaranteed to have its
    // own Location text (a coordinate-only match can pull in a photo
    // that never had one typed) — use the first one that does, same
    // rule js/place.js's placeLabel uses.
    var placeName = "This place";
    for (var i = 0; i < matches.length; i++) {
      if (matches[i].location) { placeName = matches[i].location; break; }
    }
    document.title = placeName + " | Memories of Thurmaston";
    headingEl.textContent = placeName;
    crumbEl.textContent = placeName;
    subheadingEl.textContent = matches.length + (matches.length === 1 ? " photo" : " photos") + " of this place, from earliest to most recent.";
    subheadingEl.hidden = false;

    var ordered = orderPhotos(matches);
    renderTimeline(ordered);
    if (matches.length > 1) {
      selectActionsEl.hidden = false;
      wireCheckboxSelectAll(".pick-checkbox", selectAllBtn, selectNoneBtn);
    }
    renderDownloadPdf(placeName, ordered);
  });

  function showNotFound() {
    notFoundEl.hidden = false;
    headingEl.textContent = "Place not found";
    crumbEl.textContent = "Not found";
  }

  // Shared by both the HTML timeline and the PDF, so the two can never
  // silently drift into showing photos in a different order — dated
  // photos oldest first, anything with no real date (see extractYear)
  // held back into its own group at the end.
  function orderPhotos(photos) {
    var dated = [];
    var undated = [];
    photos.forEach(function (p) {
      var year = extractYear(p.date);
      if (year) dated.push({ photo: p, year: year });
      else undated.push(p);
    });
    dated.sort(function (a, b) { return a.year - b.year; });
    return { dated: dated.map(function (entry) { return entry.photo; }), undated: undated };
  }

  function renderTimeline(ordered) {
    var html = ordered.dated.map(renderEntry).join("");
    if (ordered.undated.length > 0) {
      html += '<h2 class="location-timeline-heading">Date unknown</h2>' + ordered.undated.map(renderEntry).join("");
    }
    timelineEl.innerHTML = html;
  }

  function renderEntry(photo) {
    var metaParts = [photo.date];
    if (photo.credit && photo.credit !== "—") metaParts.push("Credit: " + photo.credit);
    return (
      '<article class="location-entry">' +
        '<div class="pick-photo-item" style="flex:0 0 180px">' +
          '<input type="checkbox" class="pick-checkbox" data-id="' + escapeAttr(photo.id) + '" checked>' +
          '<a class="location-entry-media" href="place.html?photo=' + encodeURIComponent(photo.id) + '">' +
            '<img src="' + escapeAttr(photo.src) + '" alt="' + escapeHtml(photo.caption) + '" loading="lazy">' +
          "</a>" +
        "</div>" +
        '<div class="location-entry-body">' +
          '<a class="location-entry-caption" href="place.html?photo=' + encodeURIComponent(photo.id) + '">' + escapeHtml(photo.caption) + "</a>" +
          '<p class="location-entry-meta">' + escapeHtml(metaParts.filter(Boolean).join(" · ")) + "</p>" +
          (photo.history ? '<div class="location-entry-history">' + formatMultilineText(photo.history) + "</div>" : "") +
        "</div>" +
      "</article>"
    );
  }

  function escapeAttr(str) { return escapeHtml(str); }

  // Same "open in a viewer tab" pipeline as a single photo's own PDF
  // (js/place.js, see js/pdf-helpers.js for the shared parts) — built
  // fresh from whichever checkboxes are ticked at the moment Download
  // is clicked (all of them, by default), each with its own image,
  // date/credit and full History text, in the same timeline order as
  // the page above.
  function renderDownloadPdf(placeName, ordered) {
    if (!downloadPdfBtn) return;
    downloadPdfBtn.onclick = function () {
      var allPhotos = ordered.dated.concat(ordered.undated);
      var checkedIds = checkedPickIds(".pick-checkbox");
      var selected = {
        dated: ordered.dated.filter(function (p) { return checkedIds[p.id]; }),
        undated: ordered.undated.filter(function (p) { return checkedIds[p.id]; })
      };
      var selectedPhotos = selected.dated.concat(selected.undated);
      if (selectedPhotos.length === 0) {
        alert("Tick at least one photo to include in the PDF.");
        return;
      }

      openPdfInViewer(function () {
        return Promise.all([
          Promise.all(selectedPhotos.map(function (p) {
            return loadImageElement(p.src).catch(function () { return null; });
          })),
          buildQrPngDataUrl(locationPageUrl())
        ]).then(function (results) {
          var imagesByPhotoId = {};
          selectedPhotos.forEach(function (p, i) { imagesByPhotoId[p.id] = results[0][i]; });
          return buildLocationPdf(placeName, selected, imagesByPhotoId, results[1]);
        });
      }, pdfFilenameBase(placeName) + ".pdf", downloadPdfBtn, placeName);
    };
  }

  // Absolute, not relative — this ends up in a QR code someone scans
  // from a printed page with no browser context to resolve a relative
  // URL against. Same SITE_URL (the intended future domain, not
  // wherever this happens to be generated from) js/place.js's own PDF
  // QR code uses.
  function locationPageUrl() {
    return SITE_URL + "/location.html?loc=" + encodeURIComponent(locParam);
  }

  function buildLocationPdf(placeName, ordered, imagesByPhotoId, qrDataUrl) {
    var doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
    doc.setProperties({ title: placeName });
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
    var titleLines = doc.splitTextToSize(placeName, titleMaxWidth);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 8 + 4;
    if (qrDataUrl) y = Math.max(y, margin + qrSize + 13);

    var total = ordered.dated.length + ordered.undated.length;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100);
    y = ensureSpace(doc, y, 8, margin);
    doc.text(total + (total === 1 ? " photo" : " photos") + " of this place, from earliest to most recent.", margin, y);
    doc.setTextColor(0);
    y += 10;

    ordered.dated.forEach(function (photo) {
      y = addPdfPhotoEntry(doc, photo, imagesByPhotoId[photo.id], margin, y, maxWidth);
    });
    if (ordered.undated.length > 0) {
      y = addPdfHeading(doc, "Date unknown", margin, y);
      ordered.undated.forEach(function (photo) {
        y = addPdfPhotoEntry(doc, photo, imagesByPhotoId[photo.id], margin, y, maxWidth);
      });
    }

    stampPdfFooter(doc, margin);
    return doc;
  }
});
