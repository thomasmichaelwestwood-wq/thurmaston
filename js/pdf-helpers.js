// Shared jsPDF building blocks used by both a single photo's PDF
// (js/place.js) and a place's combined timeline PDF (js/location.js).
// Split out here once a second page needed the same "open a PDF in a
// viewer tab" pipeline, rather than duplicating it — see each of
// those files for what they build with these.

// Hardcoded rather than derived from location.origin, on purpose: the
// site is still on its temporary Netlify address, but this is where
// it's moving once the real domain is set up — deliberately
// pre-baking the intended permanent address into every PDF now rather
// than the here-today address, so PDFs already downloaded and printed
// still point somewhere real once that move happens. Update this one
// constant when the domain is live (and swap the email in each PDF's
// footer text too, if that ever changes).
var SITE_URL = "https://www.thurmaston.com";

function loadImageElement(src) {
  return new Promise(function (resolve, reject) {
    var img = new Image();
    img.onload = function () { resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}

function guessImageFormat(src) {
  var ext = (String(src).split(".").pop() || "").toLowerCase().split(/[?#]/)[0];
  if (ext === "png") return "PNG";
  if (ext === "webp") return "WEBP";
  return "JPEG";
}

function downloadedDateLabel() {
  return new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

// qrcode-generator's own createDataURL() actually returns a GIF, not a
// PNG despite the name — and PDF has no native GIF image filter, so
// handing that straight to jsPDF forces it to silently decode and
// re-encode as JPEG to embed it, which risks softening the sharp
// module edges a scanner depends on. Redrawing it into an off-DOM
// canvas 1:1 (imageSmoothingEnabled off, so no blur is added here
// either) and reading it back out as a real PNG keeps the whole path
// lossless, matching the crisp black/white a QR code needs.
function buildQrPngDataUrl(text) {
  if (typeof window.qrcode !== "function") return Promise.resolve(null);
  var gifDataUrl;
  try {
    var qr = window.qrcode(0, "M");
    qr.addData(text);
    qr.make();
    gifDataUrl = qr.createDataURL(8, 4);
  } catch (e) {
    return Promise.resolve(null);
  }
  return new Promise(function (resolve) {
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      var ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = function () { resolve(null); };
    img.src = gifDataUrl;
  });
}

function ensureSpace(doc, y, needed, margin) {
  var pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - margin) {
    doc.addPage();
    return margin;
  }
  return y;
}

function addPdfHeading(doc, text, margin, y) {
  y = ensureSpace(doc, y, 10, margin);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(text, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  return y + 8;
}

function addPdfParagraph(doc, text, margin, y, maxWidth) {
  var lines = doc.splitTextToSize(text.replace(/\*\*|\*|\[|\]\([^)]*\)/g, ""), maxWidth);
  lines.forEach(function (line) {
    y = ensureSpace(doc, y, 6, margin);
    doc.text(line, margin, y);
    y += 6;
  });
  return y + 4;
}

// ---------- Pick-and-choose PDF pattern ----------
// Shared by every page that lists more than one of something with a
// checkbox per item and combines whichever are ticked into one PDF:
// year.html, category.html, events.html, location.html, cemetery.html.
// Each page still builds its own PDF layout (the items differ too much
// to share that), but the selection UI and the per-photo/per-event PDF
// blocks are identical everywhere they're used, so they live here once.

// Wires a page's "Select all"/"Select none" buttons to every checkbox
// matching checkboxSelector — e.g. ".pick-checkbox" or a more specific
// selector if a page has more than one independent group of checkboxes
// (year.html does: entries/events/photos are one combined "select all").
function wireCheckboxSelectAll(checkboxSelector, selectAllBtn, selectNoneBtn) {
  function setAllChecked(checked) {
    Array.prototype.forEach.call(document.querySelectorAll(checkboxSelector), function (box) {
      box.checked = checked;
    });
  }
  if (selectAllBtn) selectAllBtn.addEventListener("click", function () { setAllChecked(true); });
  if (selectNoneBtn) selectNoneBtn.addEventListener("click", function () { setAllChecked(false); });
}

// Reads whichever checkboxes are ticked *right now* (not a stored
// selection — there isn't one) into a plain { id: true } lookup, keyed
// by each checkbox's data-id. Read fresh at the moment Download is
// clicked, same reasoning as everywhere else on this site that a
// "build a PDF from what's currently selected" button exists.
function checkedPickIds(checkboxSelector) {
  var ids = {};
  Array.prototype.forEach.call(document.querySelectorAll(checkboxSelector + ":checked"), function (box) {
    ids[box.dataset.id] = true;
  });
  return ids;
}

function addPdfImage(doc, img, src, margin, y, maxWidth, maxImgHeight) {
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

// One photo's block in a combined PDF — image (if preloaded), caption,
// date/location/credit, and its History text if it has one. Used by
// year.html, category.html and location.html alike; previously each
// had its own near-identical version (location.html's had credit/
// History but not Location text, year.html's had Location text but not
// credit/History) — this is the union of both, a strict improvement
// for both callers rather than a lowest-common-denominator cut-down.
function addPdfPhotoEntry(doc, photo, img, margin, y, maxWidth) {
  if (img) y = addPdfImage(doc, img, photo.src, margin, y, maxWidth, 90);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  y = ensureSpace(doc, y, 7, margin);
  doc.text(photo.caption || "Untitled photo", margin, y);
  y += 7;

  var metaParts = [photo.date, photo.location];
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
  return y + 4;
}

// One Event Page's block in a combined PDF — its cover photo (first in
// its own photos list, if any — not the whole gallery, to keep a
// multi-event PDF from ballooning), name, date and description.
function addPdfEventEntry(doc, event, img, margin, y, maxWidth) {
  var coverSrc = (event.photos || [])[0];
  if (img) y = addPdfImage(doc, img, coverSrc, margin, y, maxWidth, 80);

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

function pdfFilenameBase(text) {
  var base = (text || "document").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return base || "document";
}

// Stamped on every page of a PDF (not just the last), the same
// contact/site line regardless of which page builds it — a photo's
// PDF and a place's timeline PDF both end with this, so it lives here
// once rather than twice.
function pdfFooterText() {
  return "Memories of Thurmaston — " + SITE_URL.replace(/^https?:\/\//, "") + "  ·  Questions? memories@thurmaston.com";
}

function stampPdfFooter(doc, margin) {
  var footerText = pdfFooterText();
  var totalPages = doc.internal.getNumberOfPages();
  for (var i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(footerText, margin, doc.internal.pageSize.getHeight() - 10);
  }
}

// Opens the finished PDF in a new tab (the browser's own built-in
// viewer) rather than forcing an immediate download — the visitor
// decides from there whether to save it, print it, or just look and
// close the tab, using controls they already know from every other
// PDF they've ever opened online, rather than a file just landing in
// their downloads folder unasked.
//
// window.open() has to happen synchronously, before buildDoc() (which
// is async — waiting on image loads, QR rendering) — browsers only
// allow a popup without asking permission if it's opened directly
// inside a user gesture's own call stack, and by the time an async
// build finishes it would no longer count as "the click that opened
// it" and get blocked. Opening a blank tab immediately, then
// navigating it to the finished PDF once ready, keeps the gesture
// link intact.
//
// buildDoc() must return a Promise resolving to a jsPDF document
// (already have its own .setProperties({title}) set, and its own
// filename chosen — this helper doesn't guess either of those, since
// what makes a good title/filename differs between a single photo and
// a whole place's timeline).
function openPdfInViewer(buildDoc, filename, btn, loadingTitle) {
  if (typeof window.jspdf === "undefined") {
    alert("Sorry, the PDF tool didn't load. Try refreshing the page.");
    return;
  }
  // A plain window.open("", "_blank") with no window-feature string just
  // opens another tab in the same browser window — passing a size here
  // is what tells the browser to spawn it as a genuinely separate
  // window instead (standard behaviour: a browser can't sensibly turn
  // "here's a fixed size for this" into just another tab). Deliberately
  // not adding "noopener" alongside it — that would make window.open()
  // return null instead of a usable reference, which is exactly what
  // this function needs to write the loading page into and later
  // navigate to the finished PDF.
  var pdfWindow = window.open("", "_blank", "width=1000,height=1000");
  if (pdfWindow) {
    pdfWindow.document.write(
      "<title>" + escapeHtml(loadingTitle || "Preparing your PDF…") + "</title>" +
      '<body style="font:15px/1.5 -apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;color:#52584c;padding:40px;text-align:center;">' +
      "Preparing your PDF…</body>"
    );
    // Some browsers leave the popup's document in an open/loading
    // state until this is called, which can make the later
    // location = ... navigation unreliable (seen as the tab just
    // sitting on "Preparing your PDF…" forever instead of switching to
    // the finished file).
    pdfWindow.document.close();
  }

  var originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Preparing PDF…";

  buildDoc().then(function (doc) {
    // A tab opened synchronously can still end up blocked or closed
    // out from under us by the time the async build finishes (some
    // popup blockers silently close it a tick after opening rather
    // than returning null from window.open) — re-check right before
    // navigating, and fall back to a normal download rather than
    // silently losing the PDF with no way to reach it.
    if (pdfWindow && !pdfWindow.closed) {
      try {
        // The blob (and its URL) belong to this page, not the new tab
        // — fine, since the browser keeps it alive for as long as the
        // tab holds a reference to it, same as any other blob: URL.
        pdfWindow.location = doc.output("bloburl");
      } catch (e) {
        doc.save(filename);
      }
    } else {
      doc.save(filename);
    }
  }).catch(function () {
    if (pdfWindow && !pdfWindow.closed) pdfWindow.close();
    alert("Sorry, something went wrong making that PDF.");
  }).then(function () {
    btn.disabled = false;
    btn.textContent = originalLabel;
  });
}
