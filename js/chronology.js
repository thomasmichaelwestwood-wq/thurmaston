// The village chronology (chronology.html) — a single hand-curated list
// (data/chronology.json, editable as one whole list via the admin's
// "Village Chronology" collection, same pattern as the old Map Pins
// collection) rather than one file per entry, since a few hundred
// year/description rows never needs the folder-per-entry-plus-rebuild-
// script machinery Photos and Event Pages need at their scale. No
// aggregate/rebuild step here — this file is read directly.
document.addEventListener("DOMContentLoaded", function () {
  var timelineEl = document.getElementById("chronology-timeline");
  var emptyEl = document.getElementById("chronology-empty");
  var erasEl = document.getElementById("chronology-eras");
  var countEl = document.getElementById("chronology-count");
  var searchInput = document.getElementById("chronology-search-input");
  var downloadPdfBtn = document.getElementById("chronology-download-pdf-btn");
  if (!timelineEl) return;

  // Coarse buckets a long list groups into — both the quick-jump buttons
  // and the section headings in the timeline itself. Purely a browsing
  // aid worked out from each entry's own Year text on every page load,
  // not something stored in the data.
  var ERAS = [
    { id: "era-early", label: "Before 1700", test: function (y) { return y < 1700; } },
    { id: "era-1700s", label: "1700s", test: function (y) { return y >= 1700 && y < 1800; } },
    { id: "era-1800s", label: "1800s", test: function (y) { return y >= 1800 && y < 1900; } },
    { id: "era-1900", label: "1900–1949", test: function (y) { return y >= 1900 && y < 1950; } },
    { id: "era-1950", label: "1950–1999", test: function (y) { return y >= 1950 && y < 2000; } },
    { id: "era-2000", label: "2000 onward", test: function (y) { return y >= 2000; } }
  ];
  var UNKNOWN_ERA = { id: "era-unknown", label: "Date unknown" };

  // Pulls the first 3-4 digit number out of a Year field ("1929" → 1929,
  // "c1870" → 1870, "1848/9" → 1848, "1970s (late)" → 1970) — same
  // "first number found" approach as extractYear (js/main.js) uses for a
  // photo's date, just applied to a field that's the year on purpose
  // rather than free text a year might appear inside.
  function parseYear(str) {
    var m = String(str || "").match(/\d{3,4}/);
    return m ? parseInt(m[0], 10) : null;
  }

  function eraFor(year) {
    if (year === null) return UNKNOWN_ERA;
    for (var i = 0; i < ERAS.length; i++) {
      if (ERAS[i].test(year)) return ERAS[i];
    }
    return UNKNOWN_ERA;
  }

  var allEntries = [];

  fetch("data/chronology.json")
    .then(function (res) { return res.ok ? res.json() : { entries: [] }; })
    .catch(function () { return { entries: [] }; })
    .then(function (data) {
      allEntries = (data.entries || []).map(function (e) {
        return { year: e.year || "", text: e.text || "", sortYear: parseYear(e.year) };
      });
      // Always sorted here, not trusted from file order — an entry
      // added anywhere in the admin's list (the config's own hint says
      // "order doesn't matter when saving") still ends up in the right
      // place on the page.
      allEntries.sort(function (a, b) {
        var ay = a.sortYear === null ? Infinity : a.sortYear;
        var by = b.sortYear === null ? Infinity : b.sortYear;
        return ay - by;
      });
      countEl.textContent = allEntries.length + (allEntries.length === 1 ? " entry" : " entries");
      renderEras();
      render(allEntries);
      wireDownloadPdf();
      applyYearParam();
    });

  // A photo or Event Page with a real date links here as
  // chronology.html?year=1929 (js/place.js's renderChronologyBanner,
  // js/event.js's own copy of the same thing) — landing with that param
  // set jumps straight to, and highlights, whichever entries share that
  // year, rather than leaving a visitor to scroll/search for it
  // themselves. Matches on the same sortYear every other year-grouping
  // here already uses, so "1929" finds an entry whose Year field is
  // exactly "1929" just as readily as one written "c.1929" would.
  function applyYearParam() {
    var yearParam = parseInt(new URLSearchParams(location.search).get("year"), 10);
    if (!yearParam) return;
    var matches = timelineEl.querySelectorAll('[data-year="' + yearParam + '"]');
    if (matches.length === 0) return;
    Array.prototype.forEach.call(matches, function (el) { el.classList.add("chronology-entry-highlight"); });
    matches[0].scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderEras() {
    var present = {};
    allEntries.forEach(function (e) { present[eraFor(e.sortYear).id] = true; });
    var eras = ERAS.concat([UNKNOWN_ERA]).filter(function (era) { return present[era.id]; });
    if (eras.length < 2) return; // Not worth a jump bar for a single bucket.
    erasEl.innerHTML = eras.map(function (era) {
      return '<button type="button" data-era="' + era.id + '">' + escapeHtml(era.label) + "</button>";
    }).join("");
    erasEl.hidden = false;
    erasEl.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-era]");
      if (!btn) return;
      // Jumping to an era only makes sense against the full list — clear
      // any active search first, rather than jumping to a heading that a
      // search might have just filtered down to nothing.
      if (searchInput && searchInput.value) {
        searchInput.value = "";
        render(allEntries);
      }
      var target = document.getElementById(btn.dataset.era);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function render(entries) {
    if (entries.length === 0) {
      timelineEl.innerHTML = "";
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    var html = "";
    var currentEra = null;
    entries.forEach(function (entry) {
      var era = eraFor(entry.sortYear);
      if (era !== currentEra) {
        html += '<h2 class="location-timeline-heading" id="' + era.id + '">' + escapeHtml(era.label) + "</h2>";
        currentEra = era;
      }
      html += renderEntry(entry);
    });
    timelineEl.innerHTML = html;
  }

  function renderEntry(entry) {
    return (
      '<article class="chronology-entry"' + (entry.sortYear !== null ? ' data-year="' + entry.sortYear + '"' : "") + '>' +
        '<span class="chronology-year">' + escapeHtml(entry.year) + "</span>" +
        '<p class="chronology-text">' + escapeHtml(entry.text) + "</p>" +
      "</article>"
    );
  }

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      var q = searchInput.value.trim().toLowerCase();
      if (!q) { render(allEntries); return; }
      var filtered = allEntries.filter(function (e) {
        return (e.year + " " + e.text).toLowerCase().indexOf(q) !== -1;
      });
      render(filtered);
    });
  }

  // Same "open in a viewer tab" pipeline as a photo/place's own PDF (see
  // js/pdf-helpers.js) — one document covering the whole chronology, in
  // the same era-grouped order as the page above. No images involved,
  // so unlike js/location.js's PDF there's nothing to preload first.
  function wireDownloadPdf() {
    if (!downloadPdfBtn) return;
    downloadPdfBtn.onclick = function () {
      openPdfInViewer(function () {
        return buildQrPngDataUrl(chronologyPageUrl()).then(function (qrDataUrl) {
          return buildChronologyPdf(allEntries, qrDataUrl);
        });
      }, "thurmaston-chronology.pdf", downloadPdfBtn, "Village Chronology");
    };
  }

  // Absolute, not relative — ends up in a QR code someone scans from a
  // printed page with no browser context to resolve a relative URL
  // against. Same SITE_URL every other page's PDF QR code uses.
  function chronologyPageUrl() {
    return SITE_URL + "/chronology.html";
  }

  function buildChronologyPdf(entries, qrDataUrl) {
    var doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
    doc.setProperties({ title: "Thurmaston Chronology" });
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
    var titleLines = doc.splitTextToSize("Thurmaston Chronology", titleMaxWidth);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 8 + 4;
    if (qrDataUrl) y = Math.max(y, margin + qrSize + 13);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100);
    y = ensureSpace(doc, y, 8, margin);
    var span = entries.length ? (entries[0].year + " to " + entries[entries.length - 1].year) : "";
    doc.text(entries.length + (entries.length === 1 ? " entry" : " entries") + (span ? ", from " + span : "") + ".", margin, y);
    doc.setTextColor(0);
    y += 10;

    var currentEra = null;
    entries.forEach(function (entry) {
      var era = eraFor(entry.sortYear);
      if (era !== currentEra) {
        y = addPdfHeading(doc, era.label, margin, y);
        currentEra = era;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      y = ensureSpace(doc, y, 6, margin);
      doc.text(entry.year, margin, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      y = addPdfParagraph(doc, entry.text, margin, y, maxWidth);
    });

    stampPdfFooter(doc, margin);
    return doc;
  }
});
