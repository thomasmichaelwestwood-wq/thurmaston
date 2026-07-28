// Cemetery page (cemetery.html) — the cemetery's aerial photo with a
// pin per grave that has a Position on the cemetery map set
// (admin/pin-grave.html is what produces that value — see its own
// comment for why this can't be a normal CMS widget), one search box,
// and the full alphabetical directory below. Uses the shared
// CEMETERY_DATA_PROMISE (js/main.js) rather than its own fetch of
// data/cemetery.json, same reasoning as js/chronology.js.
//
// This used to be two separate pages (cemetery.html for the directory,
// cemetery-map.html for the map) with two separate search boxes —
// folded back into one page and one search after it turned out to be
// more complexity than it was worth: two pages to link between, two
// near-identical "type a name" boxes with different behaviour
// depending which page you happened to be on. One search now covers
// every grave (not just pinned ones, which is all the map-only search
// used to consider): a match with a map position scrolls to and
// highlights that pin (same effect as before); a match without one
// highlights its row in the full directory below instead, since that's
// the only place it can be shown. Either way you land somewhere real,
// never a dead end.
document.addEventListener("DOMContentLoaded", function () {
  var wrapEl = document.getElementById("cemetery-map-wrap");
  var imgEl = document.getElementById("cemetery-map-img");
  var pinsEl = document.getElementById("cemetery-map-pins");
  var mapEmptyEl = document.getElementById("cemetery-map-empty");
  var noPhotoEl = document.getElementById("cemetery-map-no-photo");
  var searchInput = document.getElementById("cemetery-search-input");
  var searchResults = document.getElementById("cemetery-search-results");
  var directoryEl = document.getElementById("cemetery-directory");
  var emptyEl = document.getElementById("cemetery-empty");
  var toolbarEl = document.getElementById("cemetery-pick-toolbar");
  var selectAllBtn = document.getElementById("cemetery-select-all");
  var selectNoneBtn = document.getElementById("cemetery-select-none");
  var downloadPdfBtn = document.getElementById("cemetery-download-pdf-btn");
  if (!directoryEl) return;

  var allGraves = [];
  var highlightTimeout = null;

  fetch("data/cemetery-overview.json")
    .then(function (res) { return res.ok ? res.json() : null; })
    .catch(function () { return null; })
    .then(function (overview) {
      if (overview && overview.photo) {
        imgEl.src = overview.photo;
        wrapEl.hidden = false;
      } else {
        noPhotoEl.hidden = false;
      }
    });

  if (typeof CEMETERY_DATA_PROMISE === "undefined") return;
  CEMETERY_DATA_PROMISE.then(function (graves) {
    allGraves = graves;
    if (graves.length === 0) {
      emptyEl.hidden = false;
      return;
    }

    var pinned = graves.filter(function (g) { return typeof g.pinX === "number" && typeof g.pinY === "number"; });
    if (pinned.length > 0) {
      pinsEl.innerHTML = pinned.map(renderPin).join("");
    } else if (imgEl.src) {
      mapEmptyEl.hidden = false;
    }

    directoryEl.innerHTML = graves.map(renderRow).join("");

    if (graves.length > 1) {
      toolbarEl.hidden = false;
      wireCheckboxSelectAll(".pick-checkbox", selectAllBtn, selectNoneBtn);
      wireDownloadPdf();
    }

    wireSearch();
  });

  function renderPin(grave) {
    return (
      '<a class="cemetery-map-pin" href="grave.html?grave=' + encodeURIComponent(grave.id) + '" data-grave-id="' + escapeAttr(grave.id) + '" style="left:' + grave.pinX + '%;top:' + grave.pinY + '%">' +
        '<span class="cemetery-map-pin-label">' + escapeHtml(grave.name) + "</span>" +
      "</a>"
    );
  }

  function renderRow(grave) {
    var meta = [grave.number ? "No. " + grave.number : null, grave.dates].filter(Boolean).join(" · ");
    return (
      '<li data-grave-id="' + escapeAttr(grave.id) + '">' +
        '<input type="checkbox" class="pick-checkbox" data-id="' + escapeAttr(grave.id) + '" checked>' +
        '<a href="grave.html?grave=' + encodeURIComponent(grave.id) + '">' +
          '<span class="cemetery-directory-name">' + escapeHtml(grave.name) + "</span>" +
          (meta ? '<span class="cemetery-directory-meta">' + escapeHtml(meta) + "</span>" : "") +
        "</a>" +
      "</li>"
    );
  }

  function escapeAttr(str) { return escapeHtml(str); }

  function wireSearch() {
    if (!searchInput || !searchResults) return;
    searchInput.addEventListener("input", function () { renderSearchResults(searchInput.value.trim()); });
    searchInput.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var q = searchInput.value.trim().toLowerCase();
      if (!q) return;
      var matches = allGraves.filter(function (g) { return g.name.toLowerCase().indexOf(q) !== -1; });
      if (matches.length >= 1) {
        e.preventDefault();
        jumpToGrave(matches[0]);
      }
    });
  }

  function renderSearchResults(query) {
    searchResults.innerHTML = "";
    if (!query) return;

    var q = query.toLowerCase();
    var matches = allGraves.filter(function (g) { return g.name.toLowerCase().indexOf(q) !== -1; });

    if (matches.length === 0) {
      var empty = document.createElement("li");
      empty.className = "search-empty";
      empty.textContent = "No grave found for “" + query + "”.";
      searchResults.appendChild(empty);
      return;
    }

    matches.slice(0, 15).forEach(function (grave) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.style.width = "100%";
      btn.style.textAlign = "left";
      btn.style.background = "none";
      btn.style.border = "none";
      btn.style.font = "inherit";
      btn.style.cursor = "pointer";
      var meta = [grave.number ? "No. " + grave.number : null, grave.dates].filter(Boolean).join(" · ");
      btn.innerHTML =
        '<span class="result-title">' + escapeHtml(grave.name) + "</span>" +
        (meta ? '<div class="result-excerpt">' + escapeHtml(meta) + "</div>" : "");
      btn.addEventListener("click", function () { jumpToGrave(grave); });
      li.appendChild(btn);
      searchResults.appendChild(li);
    });
  }

  // A match with a map position scrolls to and highlights its pin
  // (the more useful destination — you can see roughly where it is
  // among neighbouring graves); a match without one highlights its row
  // in the full directory below instead, since there's nothing to show
  // it on the map. Either way, something on the page lights up rather
  // than the search just closing with no visible effect.
  function jumpToGrave(grave) {
    searchResults.innerHTML = "";
    searchInput.value = grave.name;

    if (highlightTimeout) clearTimeout(highlightTimeout);
    Array.prototype.forEach.call(document.querySelectorAll(".highlighted"), function (el) {
      el.classList.remove("highlighted");
    });

    var hasPin = typeof grave.pinX === "number" && typeof grave.pinY === "number";
    var pin = hasPin ? pinsEl.querySelector('[data-grave-id="' + cssEscape(grave.id) + '"]') : null;
    var row = directoryEl.querySelector('[data-grave-id="' + cssEscape(grave.id) + '"]');

    if (pin) {
      pin.classList.add("highlighted");
      pin.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      if (row) row.classList.add("highlighted");
      highlightTimeout = setTimeout(function () {
        pin.classList.remove("highlighted");
        if (row) row.classList.remove("highlighted");
      }, 4000);
    } else if (row) {
      row.classList.add("highlighted");
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      highlightTimeout = setTimeout(function () { row.classList.remove("highlighted"); }, 4000);
    }
  }

  function cssEscape(str) {
    return String(str).replace(/["\\]/g, "\\$&");
  }

  function wireDownloadPdf() {
    downloadPdfBtn.onclick = function () {
      var checkedIds = checkedPickIds(".pick-checkbox");
      var selected = allGraves.filter(function (g) { return checkedIds[g.id]; });
      if (selected.length === 0) {
        alert("Tick at least one grave to include in the PDF.");
        return;
      }
      openPdfInViewer(function () {
        var photoSrcs = selected.map(function (g) { return g.photo; }).filter(Boolean);
        return Promise.all([
          Promise.all(photoSrcs.map(function (src) { return loadImageElement(src).catch(function () { return null; }); })),
          buildQrPngDataUrl(SITE_URL + "/cemetery.html")
        ]).then(function (results) {
          var imagesBySrc = {};
          photoSrcs.forEach(function (src, i) { imagesBySrc[src] = results[0][i]; });
          return buildCemeteryPdf(selected, imagesBySrc, results[1]);
        });
      }, "thurmaston-cemetery.pdf", downloadPdfBtn, "Cemetery");
    };
  }

  function buildCemeteryPdf(graves, imagesBySrc, qrDataUrl) {
    var doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
    var title = "Cemetery";
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
    doc.text(graves.length + (graves.length === 1 ? " grave" : " graves") + ".", margin, y);
    doc.setTextColor(0);
    y += 10;

    graves.forEach(function (grave) {
      y = addGravePdfEntry(doc, grave, imagesBySrc[grave.photo], margin, y, maxWidth);
    });

    stampPdfFooter(doc, margin);
    return doc;
  }

  function addGravePdfEntry(doc, grave, img, margin, y, maxWidth) {
    if (img) y = addPdfImage(doc, img, grave.photo, margin, y, maxWidth, 80);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    y = ensureSpace(doc, y, 7, margin);
    doc.text(grave.name || "Unnamed grave", margin, y);
    y += 7;

    var metaParts = [grave.number ? "Grave " + grave.number : null, grave.dates];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    y = ensureSpace(doc, y, 6, margin);
    doc.text(metaParts.filter(Boolean).join("  ·  "), margin, y);
    doc.setTextColor(0);
    y += 6;

    if (grave.whatThreeWords) {
      var words = grave.whatThreeWords.replace(/^\/+/, "").trim();
      doc.setFontSize(10);
      y = ensureSpace(doc, y, 6, margin);
      doc.text("what3words: ///" + words, margin, y);
      y += 8;
    } else {
      y += 2;
    }

    doc.setFontSize(11);
    if (grave.inscription) {
      y = addPdfParagraph(doc, grave.inscription, margin, y, maxWidth);
    }
    if (grave.notes) {
      y = addPdfParagraph(doc, grave.notes, margin, y, maxWidth);
    }
    return y + 4;
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
});
