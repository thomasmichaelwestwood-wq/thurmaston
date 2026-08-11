// One entry's own page (burial-record.html?id=<id>) from Thurmaston
// cemetery's bulk-imported historical burial register — see
// BURIAL_RECORDS_DATA_PROMISE (js/main.js) and
// scripts/import-burial-records.js for where this data actually comes
// from. Deliberately thinner than js/grave.js's page: no photo, no
// what3words, no pin — this register only ever has a name, a grave
// number, a burial date, an age, and sometimes a note, not the richer
// hand-curated detail a photographed/located headstone entry has.
document.addEventListener("DOMContentLoaded", function () {
  var headingEl = document.getElementById("burial-record-heading");
  var crumbEl = document.getElementById("burial-record-crumb");
  var subheadingEl = document.getElementById("burial-record-subheading");
  var detailsEl = document.getElementById("burial-record-details");
  var graveNoRowEl = document.getElementById("burial-record-graveno-row");
  var graveNoEl = document.getElementById("burial-record-graveno");
  var dateRowEl = document.getElementById("burial-record-date-row");
  var dateEl = document.getElementById("burial-record-date");
  var ageRowEl = document.getElementById("burial-record-age-row");
  var ageEl = document.getElementById("burial-record-age");
  var noteEl = document.getElementById("burial-record-note");
  var pdfBtn = document.getElementById("burial-record-pdf-btn");
  var notFoundEl = document.getElementById("burial-record-not-found");
  if (!detailsEl) return;

  var params = new URLSearchParams(location.search);
  var recordId = params.get("id");
  var currentRecord = null;

  if (recordId === null || typeof BURIAL_RECORDS_DATA_PROMISE === "undefined") {
    showNotFound();
  } else {
    BURIAL_RECORDS_DATA_PROMISE.then(function (records) {
      var record = records.find(function (r) { return String(r.id) === recordId; });
      if (!record) {
        showNotFound();
        return;
      }
      currentRecord = record;
      renderRecord(record);
    });
  }

  function showNotFound() {
    notFoundEl.hidden = false;
    headingEl.textContent = "Burial record not found";
    crumbEl.textContent = "Not found";
  }

  function renderRecord(record) {
    document.title = record.name + " | Memories of Thurmaston";
    headingEl.textContent = record.name;
    crumbEl.textContent = record.name;

    var subParts = [record.graveNo ? "Grave " + record.graveNo : null, burialDateLine(record)].filter(Boolean);
    if (subParts.length) {
      subheadingEl.textContent = subParts.join(" · ");
      subheadingEl.hidden = false;
    }

    if (record.graveNo) {
      graveNoEl.textContent = record.graveNo;
      graveNoRowEl.hidden = false;
    }
    var dateLine = burialDateLine(record);
    if (dateLine) {
      dateEl.textContent = dateLine;
      dateRowEl.hidden = false;
    }
    if (record.age !== null && record.age !== undefined) {
      ageEl.textContent = record.age;
      ageRowEl.hidden = false;
    }
    if (record.note) {
      noteEl.innerHTML = "<h2>Register note</h2>" + formatMultilineText(record.note);
      noteEl.hidden = false;
      noteEl.classList.add("visible");
    }

    detailsEl.hidden = false;
  }

  function burialDateLine(record) {
    return [record.burialDate, record.year].filter(Boolean).join(" ");
  }

  if (pdfBtn) {
    pdfBtn.addEventListener("click", function () {
      if (!currentRecord) return;
      openPdfInViewer(function () {
        return buildQrPngDataUrl(SITE_URL + "/burial-record.html?id=" + encodeURIComponent(currentRecord.id))
          .then(function (qrDataUrl) { return buildBurialRecordPdf(currentRecord, qrDataUrl); });
      }, pdfFilenameBase(currentRecord.name) + "-burial-record.pdf", pdfBtn, currentRecord.name);
    });
  }

  function buildBurialRecordPdf(record, qrDataUrl) {
    var doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
    doc.setProperties({ title: record.name + " — Burial Record" });
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
    var titleLines = doc.splitTextToSize(record.name, titleMaxWidth);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 8 + 4;
    if (qrDataUrl) y = Math.max(y, margin + qrSize + 13);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100);
    y = ensureSpace(doc, y, 8, margin);
    doc.text("Thurmaston cemetery — historical burial register", margin, y);
    doc.setTextColor(0);
    y += 10;

    var facts = [
      record.graveNo ? ["Grave no.", record.graveNo] : null,
      burialDateLine(record) ? ["Date of burial", burialDateLine(record)] : null,
      (record.age !== null && record.age !== undefined) ? ["Age", String(record.age)] : null
    ].filter(Boolean);

    doc.setFontSize(11);
    facts.forEach(function (fact) {
      y = ensureSpace(doc, y, 7, margin);
      doc.setFont("helvetica", "bold");
      doc.text(fact[0] + ":", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(fact[1], margin + 38, y);
      y += 7;
    });
    y += 4;

    if (record.note) {
      y = addPdfHeading(doc, "Register note", margin, y);
      y = addPdfParagraph(doc, record.note, margin, y, maxWidth);
    }

    stampPdfFooter(doc, margin);
    return Promise.resolve(doc);
  }
});
