document.addEventListener("DOMContentLoaded", function () {
  var headingEl = document.getElementById("location-heading");
  var crumbEl = document.getElementById("location-crumb");
  var subheadingEl = document.getElementById("location-subheading");
  var timelineEl = document.getElementById("location-timeline");
  var notFoundEl = document.getElementById("location-not-found");
  var downloadPdfBtn = document.getElementById("location-download-pdf-btn");
  if (!timelineEl || typeof PHOTOS_DATA_PROMISE === "undefined") return;

  var params = new URLSearchParams(location.search);
  var locParam = params.get("loc");
  if (!locParam) {
    showNotFound();
    return;
  }

  PHOTOS_DATA_PROMISE.then(function (photos) {
    var matches = photos.filter(function (p) {
      return typeof p.location === "string" && slugifyLocation(p.location) === locParam;
    });
    if (matches.length === 0) {
      showNotFound();
      return;
    }

    var placeName = matches[0].location;
    document.title = placeName + " | Memories of Thurmaston";
    headingEl.textContent = placeName;
    crumbEl.textContent = placeName;
    subheadingEl.textContent = matches.length + (matches.length === 1 ? " photo" : " photos") + " of this place, from earliest to most recent.";
    subheadingEl.hidden = false;

    var ordered = orderPhotos(matches);
    renderTimeline(ordered);
    renderDownloadPdf(placeName, ordered);
  });

  function showNotFound() {
    notFoundEl.hidden = false;
    headingEl.textContent = "Place not found";
    crumbEl.textContent = "Not found";
  }

  // "Added <Month> <Year>" is the auto-filled placeholder used
  // everywhere on this site for a photo whose real date isn't known
  // (see automation/drive-photo-sync.gs.js and the Photos admin
  // form's own hint text for that field) — it's the date it was
  // *uploaded*, not anything about when the photo was actually taken,
  // so it must never be read as a real year here. Anything else with a
  // plain 4-digit number in it ("1913", "c.1936", "2002") is treated
  // as a genuine year.
  function extractYear(dateStr) {
    if (!dateStr || /^added\b/i.test(dateStr.trim())) return null;
    var m = dateStr.match(/\d{4}/);
    return m ? parseInt(m[0], 10) : null;
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
        '<a class="location-entry-media" href="place.html?photo=' + encodeURIComponent(photo.id) + '">' +
          '<img src="' + escapeAttr(photo.src) + '" alt="' + escapeHtml(photo.caption) + '" loading="lazy">' +
        "</a>" +
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
  // (js/place.js, see js/pdf-helpers.js for the shared parts) — one
  // PDF covering every photo of this place, in the same timeline
  // order as the page above, each with its own image, date/credit and
  // full History text.
  function renderDownloadPdf(placeName, ordered) {
    if (!downloadPdfBtn) return;
    downloadPdfBtn.onclick = function () {
      openPdfInViewer(function () {
        var allPhotos = ordered.dated.concat(ordered.undated);
        return Promise.all([
          Promise.all(allPhotos.map(function (p) {
            return loadImageElement(p.src).catch(function () { return null; });
          })),
          buildQrPngDataUrl(locationPageUrl())
        ]).then(function (results) {
          var imagesByPhotoId = {};
          allPhotos.forEach(function (p, i) { imagesByPhotoId[p.id] = results[0][i]; });
          return buildLocationPdf(placeName, ordered, imagesByPhotoId, results[1]);
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
      y = addLocationPdfEntry(doc, photo, imagesByPhotoId[photo.id], margin, y, maxWidth);
    });
    if (ordered.undated.length > 0) {
      y = addPdfHeading(doc, "Date unknown", margin, y);
      ordered.undated.forEach(function (photo) {
        y = addLocationPdfEntry(doc, photo, imagesByPhotoId[photo.id], margin, y, maxWidth);
      });
    }

    stampPdfFooter(doc, margin);
    return doc;
  }

  function addLocationPdfEntry(doc, photo, img, margin, y, maxWidth) {
    if (img) {
      var ratio = img.naturalHeight / img.naturalWidth;
      var imgWidth = maxWidth;
      var imgHeight = imgWidth * ratio;
      var maxImgHeight = 90;
      if (imgHeight > maxImgHeight) {
        imgHeight = maxImgHeight;
        imgWidth = imgHeight / ratio;
      }
      y = ensureSpace(doc, y, imgHeight, margin);
      doc.addImage(img, guessImageFormat(photo.src), margin, y, imgWidth, imgHeight);
      y += imgHeight + 6;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    y = ensureSpace(doc, y, 7, margin);
    doc.text(photo.caption || "Untitled photo", margin, y);
    y += 7;

    var metaParts = [photo.date];
    if (photo.credit && photo.credit !== "—") metaParts.push("Credit: " + photo.credit);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    y = ensureSpace(doc, y, 6, margin);
    doc.text(metaParts.filter(Boolean).join("  ·  "), margin, y);
    doc.setTextColor(0);
    y += 8;

    doc.setFontSize(11);
    if (photo.history) {
      y = addPdfParagraph(doc, photo.history, margin, y, maxWidth);
    }
    return y + 8;
  }
});
