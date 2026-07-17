document.addEventListener("DOMContentLoaded", function () {
  var contentEl = document.getElementById("place-content");
  var notFoundEl = document.getElementById("place-not-found");
  var headingEl = document.getElementById("place-heading");
  var crumbEl = document.getElementById("place-crumb");
  var photoPanelEl = document.getElementById("place-photo-panel");
  var historyEl = document.getElementById("place-history");
  var actionsEl = document.getElementById("place-actions");
  var knowMoreBtn = document.getElementById("place-know-more-btn");
  var knowMoreModal = document.getElementById("place-know-more-modal");
  var downloadPdfBtn = document.getElementById("place-download-pdf-btn");
  var relatedEl = document.getElementById("place-related");
  var backLinkEl = document.getElementById("place-back-link");
  var locationBannerEl = document.getElementById("place-location-banner");
  var zoomOverlay = document.getElementById("place-zoom-overlay");
  var zoomStage = document.getElementById("place-zoom-stage");
  var zoomImage = document.getElementById("place-zoom-image");
  var zoomCloseBtn = document.getElementById("place-zoom-close");
  var zoomInBtn = document.getElementById("place-zoom-in");
  var zoomOutBtn = document.getElementById("place-zoom-out");
  var zoomResetBtn = document.getElementById("place-zoom-reset");
  if (!contentEl) return;

  var params = new URLSearchParams(location.search);
  var photoParam = params.get("photo");
  var slugParam = params.get("slug");
  if (!photoParam && !slugParam) {
    showNotFound();
    return;
  }

  fetch("data/photos.json").then(function (res) { return res.ok ? res.json() : []; }).catch(function () { return []; }).then(function (photos) {
    var photoById = {};
    photos.forEach(function (p) { photoById[p.id] = p; });

    var primaryPhoto = photoParam ? photoById[photoParam] : null;
    // A story page can be reached two ways: a photo whose own pageSlug
    // points at one (the normal case now), or an explicit ?slug= for a
    // page opened without a specific photo in mind. Either can supply
    // the slug; the photo, when present, is what drives everything else.
    var slug = slugParam || (primaryPhoto && primaryPhoto.pageSlug) || null;

    if (!primaryPhoto && !slug) {
      showNotFound();
      return;
    }

    if (slug) {
      fetch("data/pages/" + encodeURIComponent(slug) + ".json").then(function (res) { return res.ok ? res.json() : null; }).catch(function () { return null; }).then(function (page) {
        renderPage(page, primaryPhoto, photoById, photos);
      });
    } else {
      renderPage(null, primaryPhoto, photoById, photos);
    }
  });

  function showNotFound() {
    notFoundEl.hidden = false;
    headingEl.textContent = "Photo not found";
    crumbEl.textContent = "Not found";
  }

  function renderPage(page, primaryPhoto, photoById, photos) {
    if (!page && !primaryPhoto) {
      showNotFound();
      return;
    }

    var title = page ? page.title : primaryPhoto.caption;
    document.title = title + " | Memories of Thurmaston";
    headingEl.textContent = title;
    crumbEl.textContent = title;

    if (primaryPhoto) {
      renderLocationBanner(primaryPhoto, photos);
      renderPhotoPanel(primaryPhoto);
      renderHistorySection(primaryPhoto);
      renderKnowMore(primaryPhoto);
      renderDownloadPdf(primaryPhoto, page);
      if (actionsEl) actionsEl.hidden = false;
      renderRelatedPhotos(primaryPhoto, photos);
      renderBackLink(primaryPhoto);
    }

    var html = page ? (page.blocks || []).map(function (block) {
      if (block.type === "text" && block.text) return renderTextBlock(block.text);
      if (block.type === "photo" && block.photoId) return renderPhotoBlock(photoById[block.photoId]);
      return "";
    }).join("") : "";

    contentEl.innerHTML = html;
  }

  // Every photo's own page now — not just ones with a hand-written
  // story — so this is the primary way a photo is viewed on the site,
  // not an add-on to a story page. Mirrors what the old lightbox
  // showed (caption, date/location, category/credit, ref).
  function renderPhotoPanel(photo) {
    if (!photoPanelEl) return;
    var cat = (typeof MAP_CATEGORIES !== "undefined" && MAP_CATEGORIES[photo.category]) ? MAP_CATEGORIES[photo.category].label : photo.category;
    var metaParts = [cat];
    if (photo.credit && photo.credit !== "—") metaParts.push("Credit: " + photo.credit);
    var hasLocation = typeof photo.lat === "number" && typeof photo.lng === "number";
    var mapUrl = "map.html?photo=" + encodeURIComponent(photo.id);

    photoPanelEl.innerHTML =
      '<div class="place-photo-panel-media">' +
        '<img src="' + escapeAttr(photo.src) + '" alt="' + escapeHtml(photo.caption) + '" loading="lazy">' +
        '<span class="place-photo-panel-zoom-hint">🔍 Click to zoom</span>' +
      "</div>" +
      '<div class="place-photo-panel-info">' +
        '<p class="place-photo-panel-caption">' + escapeHtml(photo.caption) + "</p>" +
        '<p class="place-photo-panel-datelocation">' + escapeHtml([photo.date, photo.location].filter(Boolean).join(" · ")) + "</p>" +
        '<p class="place-photo-panel-meta">' + escapeHtml(metaParts.filter(Boolean).join(" · ")) + "</p>" +
        (photo.ref ? '<p class="place-photo-panel-ref">Ref: ' + escapeHtml(photo.ref) + "</p>" : "") +
        (hasLocation ? '<div class="place-mini-map" id="place-mini-map"></div>' : "") +
        (hasLocation ? '<a class="place-photo-panel-link" href="' + escapeAttr(mapUrl) + '">Explore the full map →</a>' : "") +
      "</div>";
    photoPanelEl.hidden = false;
    photoPanelEl.classList.add("visible");

    if (hasLocation) renderMiniMap(photo, mapUrl);
    renderZoomableImage(photo);
  }

  // Click the main photo to open it full-screen with zoom/pan — added
  // for a high-resolution aerial shot where the detail is worth
  // examining closely, but wired up for every photo rather than just
  // that category, since it's generally useful. Built on vendor/panzoom
  // (see css/style.css's .place-zoom-overlay comment for why a vendored
  // library rather than hand-rolled pinch-zoom). The panzoom instance
  // is created once (on first open) and reused on later opens — cheap
  // to keep around, and avoids leaking a fresh set of drag/wheel/touch
  // listeners every time the overlay is reopened.
  var zoomInstance = null;
  function renderZoomableImage(photo) {
    var trigger = photoPanelEl.querySelector(".place-photo-panel-media img");
    if (!trigger || !zoomOverlay || typeof panzoom === "undefined") return;

    trigger.setAttribute("role", "button");
    trigger.setAttribute("tabindex", "0");
    trigger.setAttribute("aria-label", "View full-screen, zoomable");
    trigger.onclick = openZoom;
    trigger.onkeydown = function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openZoom();
      }
    };

    function openZoom() {
      zoomImage.src = photo.src;
      zoomImage.alt = photo.caption;
      zoomOverlay.classList.add("open");
      document.body.style.overflow = "hidden";
      if (!zoomInstance) {
        zoomInstance = panzoom(zoomImage, {
          maxZoom: 6,
          minZoom: 1,
          bounds: true,
          boundsPadding: 0.15,
          zoomDoubleClickSpeed: 1
        });
      } else {
        zoomInstance.moveTo(0, 0);
        zoomInstance.zoomAbs(0, 0, 1);
      }
    }
  }

  function closeZoom() {
    if (!zoomOverlay) return;
    zoomOverlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  if (zoomOverlay) {
    zoomCloseBtn.onclick = closeZoom;
    zoomOverlay.addEventListener("click", function (e) {
      // .place-zoom-stage fills the whole overlay (it's just a
      // flex-centering wrapper around the image), so a click on the
      // empty area around the photo lands on the stage, not the
      // overlay div itself — treat either as "clicked the backdrop."
      // panzoom is attached to the <img> itself, not the stage, so a
      // pan-drag always starts (and, since the image tracks the
      // cursor, also ends) with the image as the event target — this
      // only fires for a genuine click on empty space, not a drag
      // release. Verified directly (Playwright: drag the image, then
      // release over backdrop space — overlay stays open).
      if (e.target === zoomOverlay || e.target === zoomStage) closeZoom();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && zoomOverlay.classList.contains("open")) closeZoom();
    });
    zoomInBtn.onclick = function () {
      if (zoomInstance) zoomInstance.smoothZoom(zoomStage.clientWidth / 2, zoomStage.clientHeight / 2, 1.5);
    };
    zoomOutBtn.onclick = function () {
      if (zoomInstance) zoomInstance.smoothZoom(zoomStage.clientWidth / 2, zoomStage.clientHeight / 2, 1 / 1.5);
    };
    zoomResetBtn.onclick = function () {
      if (zoomInstance) {
        zoomInstance.moveTo(0, 0);
        zoomInstance.zoomAbs(0, 0, 1);
      }
    };
  }

  // A small, non-interactive preview map right on the photo's own
  // page — showing the building's actual location was a feature
  // people liked on the old homepage map, so rather than only offer a
  // text link through to map.html, this puts a real (if tiny) map
  // right here too. Deliberately not pannable/zoomable (dragging,
  // scroll-zoom and double-click-zoom all off) — it's a preview, not a
  // navigable map; clicking it goes to map.html?photo=ID for the real
  // thing, same as the text link below it. Reuses the same
  // .map-pin/.map-pin-icon marker styling as map.html/category.html so
  // a pin looks identical wherever it's seen.
  function renderMiniMap(photo, mapUrl) {
    var el = document.getElementById("place-mini-map");
    if (!el || typeof L === "undefined") return;

    var map = L.map(el, {
      center: [photo.lat, photo.lng],
      zoom: 16,
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: false,
      doubleClickZoom: false,
      attributionControl: false,
      keyboard: false
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    var color = (typeof MAP_CATEGORIES !== "undefined" && MAP_CATEGORIES[photo.category]) ? MAP_CATEGORIES[photo.category].color : "#2f6f9e";
    var icon = L.divIcon({
      className: "map-pin-icon",
      html: '<span class="map-pin" style="--pin-color:' + color + '"></span>',
      iconSize: [26, 34],
      iconAnchor: [13, 34],
      popupAnchor: [0, -30]
    });
    L.marker([photo.lat, photo.lng], { icon: icon, keyboard: false }).addTo(map);

    el.style.cursor = "pointer";
    el.setAttribute("role", "link");
    el.setAttribute("aria-label", "View on the full interactive map");
    el.addEventListener("click", function () { location.href = mapUrl; });
  }

  // Its own full-width, light-background section — easier to read a
  // longer paragraph there than crammed into the facts panel's narrow
  // dark info column alongside the terser caption/date/credit/ref facts.
  function renderHistorySection(photo) {
    if (!historyEl || !photo.history) return;
    historyEl.innerHTML = "<h2>History</h2>" + formatMultilineText(photo.history);
    historyEl.hidden = false;
    historyEl.classList.add("visible");
  }

  // "Know more" is a button that opens a small popup with the form,
  // rather than a form that's always on the page — most visitors are
  // just here to look, and the always-open form was a lot of the page
  // before they get to the photo's own story.
  function renderKnowMore(photo) {
    if (!knowMoreBtn || !knowMoreModal) return;
    knowMoreModal.querySelector(".place-know-more-body").innerHTML = renderSubmitForm(photo);
    knowMoreBtn.hidden = false;

    knowMoreBtn.onclick = function () { knowMoreModal.classList.add("open"); };
    knowMoreModal.querySelector(".place-know-more-close").onclick = closeKnowMore;
    knowMoreModal.addEventListener("click", function (e) {
      if (e.target === knowMoreModal) closeKnowMore();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeKnowMore();
    });
  }

  function closeKnowMore() {
    knowMoreModal.classList.remove("open");
  }

  // One-click PDF via a locally vendored jsPDF (vendor/jspdf, same
  // pattern as Leaflet) — builds the file by hand (title, photo, facts,
  // History, any linked Story page text) rather than rendering the live
  // DOM to an image, so the result is small, crisp at any zoom, and its
  // text is actually selectable/searchable in a PDF reader. Opens in a
  // viewer tab rather than forcing a download — see openPdfInViewer in
  // js/pdf-helpers.js (shared with location.html's own "View / Print
  // PDF" for a place's whole timeline) for why and how.
  function renderDownloadPdf(photo, page) {
    if (!downloadPdfBtn) return;
    downloadPdfBtn.onclick = function () {
      openPdfInViewer(function () {
        return Promise.all([
          loadImageElement(photo.src).catch(function () { return null; }),
          buildQrPngDataUrl(photoPageUrl(photo))
        ]).then(function (results) {
          return buildPhotoPdf(photo, page, results[0], results[1]);
        });
      }, pdfFilenameBase(photo.caption || photo.id) + ".pdf", downloadPdfBtn, photo.caption);
    };
  }

  // Absolute, not relative — this ends up in a QR code someone scans
  // from a printed page with no browser context to resolve a relative
  // URL against.
  function photoPageUrl(photo) {
    return SITE_URL + "/place.html?photo=" + encodeURIComponent(photo.id);
  }

  function buildPhotoPdf(photo, page, img, qrDataUrl) {
    var doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
    // A human-readable title, not the slugified filename — Chrome's
    // built-in PDF viewer uses this for both the browser tab title and
    // the filename it suggests when someone clicks its own save icon,
    // so this is what makes "open in a viewer, let them decide whether
    // to save" (rather than an immediate forced download) still end up
    // with a sensible filename if they do save it.
    doc.setProperties({ title: photo.caption || pdfFilenameBase(photo.caption || photo.id) });
    var pageWidth = doc.internal.pageSize.getWidth();
    var margin = 18;
    var maxWidth = pageWidth - margin * 2;
    var y = margin;

    // A small QR code in the top-right corner of a printed page, so
    // someone holding a paper copy can scan straight back to this photo
    // online — printed on the first page only, same as a letterhead.
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
      // The site's content can change after this PDF is downloaded —
      // this date, next to the "scan for the live version" QR code, is
      // what tells someone reading a printed copy later that it might
      // be out of date, and exactly how to check.
      doc.text("Downloaded " + downloadedDateLabel(), qrCaptionX, margin + qrSize + 8, { align: "center" });
      doc.setTextColor(0);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    var titleLines = doc.splitTextToSize(photo.caption || "Untitled photo", titleMaxWidth);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 8 + 4;
    if (qrDataUrl) y = Math.max(y, margin + qrSize + 13);

    if (img) {
      var ratio = img.naturalHeight / img.naturalWidth;
      var imgWidth = maxWidth;
      var imgHeight = imgWidth * ratio;
      var maxImgHeight = 120;
      if (imgHeight > maxImgHeight) {
        imgHeight = maxImgHeight;
        imgWidth = imgHeight / ratio;
      }
      y = ensureSpace(doc, y, imgHeight, margin);
      doc.addImage(img, guessImageFormat(photo.src), margin, y, imgWidth, imgHeight);
      y += imgHeight + 8;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    var cat = (typeof MAP_CATEGORIES !== "undefined" && MAP_CATEGORIES[photo.category]) ? MAP_CATEGORIES[photo.category].label : photo.category;
    var facts = [
      [photo.date, photo.location].filter(Boolean).join("  ·  "),
      [cat, photo.credit && photo.credit !== "—" ? "Credit: " + photo.credit : ""].filter(Boolean).join("  ·  "),
      photo.ref ? "Ref: " + photo.ref : ""
    ].filter(Boolean);
    facts.forEach(function (line) {
      y = ensureSpace(doc, y, 6, margin);
      doc.text(line, margin, y);
      y += 6;
    });
    y += 4;

    if (photo.history) {
      y = addPdfHeading(doc, "History", margin, y);
      y = addPdfParagraph(doc, photo.history, margin, y, maxWidth);
    }

    if (page && page.blocks) {
      page.blocks.forEach(function (block) {
        if (block.type === "text" && block.text) {
          y = addPdfParagraph(doc, block.text, margin, y, maxWidth);
        }
      });
    }

    // Stamped on every page (not just the last) — ensureSpace() can add
    // more than one for a photo with a long History or story, and the
    // contact line should still be there wherever the PDF gets printed
    // from or how far someone scrolls.
    stampPdfFooter(doc, margin);

    return doc;
  }

  // Same fields as before — just now shown inside a popup instead of
  // always on the page. Still not wired to a backend, see the note in
  // the form itself.
  function renderSubmitForm(photo) {
    return (
      "<h4>Know more about this photo?</h4>" +
      "<p>Have a date, a name, a story, or another photo of the same place? Tell us and we'll add it.</p>" +
      '<form class="stack" action="#" method="post">' +
        '<input type="hidden" name="photo-id" value="' + escapeAttr(photo.id) + '">' +
        "<div>" +
          '<label for="place-submit-ref">About this photo</label>' +
          '<input type="text" id="place-submit-ref" name="photo-ref" value="' + escapeAttr(photo.ref || photo.caption || photo.id) + '" readonly>' +
        "</div>" +
        "<div>" +
          '<label for="place-submit-name">Your name</label>' +
          '<input type="text" id="place-submit-name" name="name" required>' +
        "</div>" +
        "<div>" +
          '<label for="place-submit-email">Email (kept private)</label>' +
          '<input type="email" id="place-submit-email" name="email">' +
        "</div>" +
        "<div>" +
          '<label for="place-submit-message">What do you know, or want to share?</label>' +
          '<textarea id="place-submit-message" name="message" rows="3" required></textarea>' +
        "</div>" +
        "<div>" +
          '<label for="place-submit-photo">Photo (optional)</label>' +
          '<input type="file" id="place-submit-photo" name="photo" accept="image/*">' +
        "</div>" +
        '<button class="btn btn-primary" type="submit">Submit</button>' +
        '<p style="font-size:0.75rem;color:#c7d9c9;margin:0">This form isn\'t connected to a mailbox yet — wire it up to your preferred form handler (e.g. Netlify Forms, Formspree) before going live.</p>' +
      "</form>"
    );
  }

  function renderBackLink(photo) {
    if (!backLinkEl) return;
    var cat = (typeof MAP_CATEGORIES !== "undefined" && MAP_CATEGORIES[photo.category]) ? MAP_CATEGORIES[photo.category].label : photo.category;
    backLinkEl.textContent = "← Back to " + cat;
    backLinkEl.href = "category.html?cat=" + encodeURIComponent(photo.category);
    backLinkEl.hidden = false;
  }

  // A prominent link near the top of the page to that place's own
  // timeline (location.html) — added because the "More photos from…"
  // grid further down the page (renderRelatedPhotos, below) turned out
  // to be too easy to miss: two real photos of the same building
  // (the Harrow Inn, 1913 and 2002) were correctly cross-linked by it,
  // but that wasn't obvious enough to actually be found. Only shown
  // when there's more than one photo at this exact location — a lone
  // photo has no timeline to link to. Same exact-match-on-trimmed-
  // lowercased-text rule as renderRelatedPhotos (see its comment) —
  // deliberately not deduplicated between the two functions since they
  // serve different purposes (a quick top-of-page nudge vs the full
  // list of thumbnails) and would be awkward to share without also
  // coupling their render timing.
  function renderLocationBanner(photo, photos) {
    if (!locationBannerEl || !photo.location) return;
    var location = photo.location.trim().toLowerCase();
    var siblings = photos.filter(function (p) {
      return typeof p.location === "string" && p.location.trim().toLowerCase() === location;
    });
    if (siblings.length < 2) return;

    var slug = slugifyLocation(photo.location);
    locationBannerEl.href = "location.html?loc=" + encodeURIComponent(slug);
    locationBannerEl.innerHTML =
      "This is one of " + siblings.length + " photos of <strong>" + escapeHtml(photo.location) + "</strong> — see the full history and timeline →";
    locationBannerEl.hidden = false;
  }

  // Other photos that share this one's Location text — only meaningful
  // when photos have been archived with the same location spelled the
  // same way (see CLAUDE.md), so this quietly shows nothing rather than
  // guessing at a fuzzy match.
  function renderRelatedPhotos(photo, photos) {
    if (!relatedEl || !photo.location) return;
    var location = photo.location.trim().toLowerCase();
    var others = photos.filter(function (p) {
      return p.id !== photo.id && typeof p.location === "string" && p.location.trim().toLowerCase() === location;
    });
    if (others.length === 0) return;

    var grid = others.map(function (p) { return renderPhotoBlock(p); }).join("");
    relatedEl.innerHTML =
      "<h2>More photos from " + escapeHtml(photo.location) + "</h2>" +
      '<div class="place-related-grid">' + grid + "</div>";
    relatedEl.hidden = false;
    relatedEl.classList.add("visible");
  }

  function renderPhotoBlock(photo) {
    if (!photo) return "";
    var url = "place.html?photo=" + encodeURIComponent(photo.id);
    return (
      '<a class="place-photo-block" href="' + url + '">' +
        '<img src="' + photo.src + '" alt="' + escapeHtml(photo.caption) + '" loading="lazy">' +
        '<span class="place-photo-caption">' + escapeHtml(photo.caption) + "</span>" +
      "</a>"
    );
  }

  // Text blocks come from a WYSIWYG-ish editor, not raw HTML — the whole
  // string is HTML-escaped first (so nothing typed there can inject
  // markup), then a small, deliberately limited set of patterns
  // (**bold**, *italic*, [text](url), blank-line paragraphs) is layered
  // back on top as real tags.
  function renderTextBlock(rawText) {
    var escaped = escapeHtml(rawText);
    return escaped.split(/\n{2,}/).map(function (para) {
      return "<p>" + renderInline(para).replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }

  function renderInline(text) {
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (match, label, url) {
      if (/^javascript:/i.test(url)) return label;
      var external = /^https?:\/\//i.test(url);
      return '<a href="' + escapeAttr(url) + '"' + (external ? ' target="_blank" rel="noopener"' : "") + ">" + label + "</a>";
    });
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    return text;
  }

  function escapeAttr(str) {
    return String(str).replace(/"/g, "&quot;");
  }
});
