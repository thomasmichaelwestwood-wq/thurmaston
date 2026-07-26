// Landing page for Events (events.html) — one tile per Event Page
// (data/events/<id>.json, built via the admin's "Event Pages"
// collection: a description plus a whole list of photos in one
// entry), linking to event.html?event=<id>. A single Events-category
// photo added via the older "Events (single photos)" collection isn't
// listed here — see the "Browse single Events photos" link, which
// goes to the plain flat category grid instead.
document.addEventListener("DOMContentLoaded", function () {
  var tilesEl = document.getElementById("events-tiles");
  var emptyEl = document.getElementById("events-empty");
  var toolbarEl = document.getElementById("events-pick-toolbar");
  var selectAllBtn = document.getElementById("events-select-all");
  var selectNoneBtn = document.getElementById("events-select-none");
  var downloadPdfBtn = document.getElementById("events-download-pdf-btn");
  if (!tilesEl) return;

  fetch("data/events.json").then(function (res) { return res.ok ? res.json() : []; }).catch(function () { return []; }).then(function (events) {
    if (events.length === 0) {
      emptyEl.hidden = false;
      return;
    }

    // Chronological (oldest-first by the event's own date), not
    // newest-added-first — requested explicitly, same convention now
    // used on category.html and year.html. Undated events (no
    // extractYear match) are held back to the end, same as
    // js/photos.js's orderPhotosChronologically.
    var dated = [];
    var undated = [];
    events.forEach(function (e) {
      var year = extractYear(e.date);
      if (year) dated.push({ event: e, year: year });
      else undated.push(e);
    });
    dated.sort(function (a, b) { return a.year - b.year; });
    var ordered = dated.map(function (entry) { return entry.event; }).concat(undated);

    tilesEl.innerHTML = ordered.map(renderTile).join("");

    // Set after insertion (not inlined into the HTML string above) so
    // a cover photo's own filename can never break anything — see the
    // comment on js/photos.js's setCategoryTileImages for why a plain
    // "url('" + src + "')" string silently breaks (no console error,
    // just a blank tile) for any filename containing an apostrophe.
    Array.prototype.forEach.call(tilesEl.querySelectorAll("a[data-cover]"), function (a) {
      var cover = a.dataset.cover;
      if (cover) a.querySelector(".photo-filter-photo").style.backgroundImage = "url(" + JSON.stringify(cover) + ")";
    });

    if (toolbarEl && ordered.length > 1) {
      toolbarEl.hidden = false;
      wireCheckboxSelectAll(".pick-checkbox", selectAllBtn, selectNoneBtn);
      wireDownloadPdf(ordered);
    }
  });

  function renderTile(event) {
    var cover = event.photos && event.photos[0];
    var count = (event.photos || []).length;
    var meta = [event.date, count + (count === 1 ? " photo" : " photos")].filter(Boolean).join(" · ");
    return (
      '<div class="pick-photo-item">' +
        '<input type="checkbox" class="pick-checkbox" data-id="' + escapeAttr(event.id) + '" checked>' +
        '<a href="event.html?event=' + encodeURIComponent(event.id) + '" data-cover="' + escapeAttr(cover || "") + '">' +
          '<span class="photo-filter-photo"></span>' +
          '<span class="photo-filter-label">' + escapeHtml(event.name) +
            '<small style="display:block;font-weight:400;font-size:0.75rem;opacity:0.85;margin-top:2px">' + escapeHtml(meta) + "</small></span>" +
        "</a>" +
      "</div>"
    );
  }

  function escapeAttr(str) { return escapeHtml(str); }

  function wireDownloadPdf(events) {
    if (!downloadPdfBtn) return;
    downloadPdfBtn.onclick = function () {
      var checkedIds = checkedPickIds(".pick-checkbox");
      var selected = events.filter(function (e) { return checkedIds[e.id]; });
      if (selected.length === 0) {
        alert("Tick at least one event to include in the PDF.");
        return;
      }
      openPdfInViewer(function () {
        var coverSrcs = selected.map(function (e) { return (e.photos || [])[0]; }).filter(Boolean);
        return Promise.all([
          Promise.all(coverSrcs.map(function (src) { return loadImageElement(src).catch(function () { return null; }); })),
          buildQrPngDataUrl(SITE_URL + "/events.html")
        ]).then(function (results) {
          var imagesBySrc = {};
          coverSrcs.forEach(function (src, i) { imagesBySrc[src] = results[0][i]; });
          return buildEventsPdf(selected, imagesBySrc, results[1]);
        });
      }, "thurmaston-events.pdf", downloadPdfBtn, "Village Events");
    };
  }

  function buildEventsPdf(events, imagesBySrc, qrDataUrl) {
    var doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
    var title = "Village Events";
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

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100);
    y = ensureSpace(doc, y, 8, margin);
    doc.text(events.length + (events.length === 1 ? " event" : " events") + ".", margin, y);
    doc.setTextColor(0);
    y += 10;

    events.forEach(function (event) {
      y = addPdfEventEntry(doc, event, imagesBySrc[(event.photos || [])[0]], margin, y, maxWidth);
    });

    stampPdfFooter(doc, margin);
    return doc;
  }
});
