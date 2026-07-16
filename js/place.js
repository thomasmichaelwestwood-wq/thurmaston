document.addEventListener("DOMContentLoaded", function () {
  var contentEl = document.getElementById("place-content");
  var notFoundEl = document.getElementById("place-not-found");
  var headingEl = document.getElementById("place-heading");
  var crumbEl = document.getElementById("place-crumb");
  var photoPanelEl = document.getElementById("place-photo-panel");
  var historyEl = document.getElementById("place-history");
  var knowMoreBtn = document.getElementById("place-know-more-btn");
  var knowMoreModal = document.getElementById("place-know-more-modal");
  var relatedEl = document.getElementById("place-related");
  var backLinkEl = document.getElementById("place-back-link");
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
      renderPhotoPanel(primaryPhoto);
      renderHistorySection(primaryPhoto);
      renderKnowMore(primaryPhoto);
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
    var mapUrl = "index.html?photo=" + encodeURIComponent(photo.id) + "#map";

    photoPanelEl.innerHTML =
      '<div class="place-photo-panel-media">' +
        '<img src="' + escapeAttr(photo.src) + '" alt="' + escapeHtml(photo.caption) + '" loading="lazy">' +
      "</div>" +
      '<div class="place-photo-panel-info">' +
        '<p class="place-photo-panel-caption">' + escapeHtml(photo.caption) + "</p>" +
        '<p class="place-photo-panel-datelocation">' + escapeHtml([photo.date, photo.location].filter(Boolean).join(" · ")) + "</p>" +
        '<p class="place-photo-panel-meta">' + escapeHtml(metaParts.filter(Boolean).join(" · ")) + "</p>" +
        (photo.ref ? '<p class="place-photo-panel-ref">Ref: ' + escapeHtml(photo.ref) + "</p>" : "") +
        (hasLocation ? '<a class="place-photo-panel-link" href="' + escapeAttr(mapUrl) + '">View on map →</a>' : "") +
      "</div>";
    photoPanelEl.hidden = false;
    photoPanelEl.classList.add("visible");
  }

  // Its own full-width, light-background section — easier to read a
  // longer paragraph there than crammed into the facts panel's narrow
  // dark info column alongside the terser caption/date/credit/ref facts.
  function renderHistorySection(photo) {
    if (!historyEl || !photo.history) return;
    historyEl.innerHTML = "<h2>History</h2><p>" + escapeHtml(photo.history) + "</p>";
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
