// Cemetery landing page (cemetery.html) — the full alphabetical
// directory (data/cemetery.json, built from the admin's "Graves"
// collection). Uses the shared CEMETERY_DATA_PROMISE (js/main.js)
// rather than its own fetch, same reasoning as
// js/chronology.js/CHRONOLOGY_DATA_PROMISE — initSearch() is already
// fetching this file for the site search index.
//
// The aerial overview photo (data/cemetery-overview.json) used to also
// show as a static banner here, but its only real purpose is showing
// where each grave actually is — moved to live solely on
// cemetery-map.html (js/cemetery-map.js), which is what the pins need
// it for; showing the same photo again here with no pins on it was
// redundant.
document.addEventListener("DOMContentLoaded", function () {
  var directoryEl = document.getElementById("cemetery-directory");
  var emptyEl = document.getElementById("cemetery-empty");
  var toolbarEl = document.getElementById("cemetery-pick-toolbar");
  var selectAllBtn = document.getElementById("cemetery-select-all");
  var selectNoneBtn = document.getElementById("cemetery-select-none");
  var downloadPdfBtn = document.getElementById("cemetery-download-pdf-btn");
  if (!directoryEl) return;

  if (typeof CEMETERY_DATA_PROMISE === "undefined") return;
  var allGraves = [];
  CEMETERY_DATA_PROMISE.then(function (graves) {
    allGraves = graves;
    if (graves.length === 0) {
      emptyEl.hidden = false;
      return;
    }
    directoryEl.innerHTML = graves.map(renderRow).join("");

    if (graves.length > 1) {
      toolbarEl.hidden = false;
      wireCheckboxSelectAll(".pick-checkbox", selectAllBtn, selectNoneBtn);
      wireDownloadPdf();
    }
  });

  function renderRow(grave) {
    var meta = [grave.number ? "No. " + grave.number : null, grave.dates].filter(Boolean).join(" · ");
    return (
      '<li>' +
        '<input type="checkbox" class="pick-checkbox" data-id="' + escapeAttr(grave.id) + '" checked>' +
        '<a href="grave.html?grave=' + encodeURIComponent(grave.id) + '">' +
          '<span class="cemetery-directory-name">' + escapeHtml(grave.name) + "</span>" +
          (meta ? '<span class="cemetery-directory-meta">' + escapeHtml(meta) + "</span>" : "") +
        "</a>" +
      "</li>"
    );
  }

  function escapeAttr(str) { return escapeHtml(str); }

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
});
