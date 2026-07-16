document.addEventListener("DOMContentLoaded", function () {
  var contentEl = document.getElementById("place-content");
  var notFoundEl = document.getElementById("place-not-found");
  var headingEl = document.getElementById("place-heading");
  var crumbEl = document.getElementById("place-crumb");
  var photoPanelEl = document.getElementById("place-photo-panel");
  var historyEl = document.getElementById("place-history");
  var submitEl = document.getElementById("place-submit");
  var relatedEl = document.getElementById("place-related");
  var backLinkEl = document.getElementById("place-back-link");
  if (!contentEl) return;

  var DOC_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v5h5"/></svg>';

  var params = new URLSearchParams(location.search);
  var slug = params.get("slug");
  var photoParam = params.get("photo");
  if (!slug) {
    showNotFound();
    return;
  }

  Promise.all([
    fetch("data/pages/" + encodeURIComponent(slug) + ".json").then(function (res) { return res.ok ? res.json() : null; }).catch(function () { return null; }),
    fetch("data/photos.json").then(function (res) { return res.ok ? res.json() : []; }).catch(function () { return []; })
  ]).then(function (results) {
    var page = results[0];
    var photos = results[1];
    if (!page) {
      showNotFound();
      return;
    }
    renderPage(page, photos);
  });

  function showNotFound() {
    notFoundEl.hidden = false;
    headingEl.textContent = "Page not found";
    crumbEl.textContent = "Not found";
  }

  function renderPage(page, photos) {
    document.title = page.title + " | Memories of Thurmaston";
    headingEl.textContent = page.title;
    crumbEl.textContent = page.title;

    var photoById = {};
    photos.forEach(function (p) { photoById[p.id] = p; });

    var primaryPhoto = photoParam ? photoById[photoParam] : null;
    if (primaryPhoto) {
      renderPhotoPanel(primaryPhoto);
      renderHistorySection(primaryPhoto);
      renderSubmitSection(primaryPhoto);
      renderRelatedPhotos(primaryPhoto, photos);
      renderBackLink(primaryPhoto);
    }

    var html = (page.blocks || []).map(function (block) {
      if (block.type === "text" && block.text) return renderTextBlock(block.text);
      if (block.type === "photo" && block.photoId) return renderPhotoBlock(photoById[block.photoId]);
      if (block.type === "document" && block.file) return renderDocumentBlock(block);
      return "";
    }).join("");

    contentEl.innerHTML = html;
  }

  // Mirrors the photo lightbox's info panel (js/photos.js's showPhoto)
  // so landing on a story page shows the same facts you'd already seen
  // there, before the page's own written history goes further.
  function renderPhotoPanel(photo) {
    if (!photoPanelEl) return;
    var cat = (typeof MAP_CATEGORIES !== "undefined" && MAP_CATEGORIES[photo.category]) ? MAP_CATEGORIES[photo.category].label : photo.category;
    var metaParts = [cat];
    if (photo.credit && photo.credit !== "—") metaParts.push("Credit: " + photo.credit);
    var archiveUrl = "category.html?cat=" + encodeURIComponent(photo.category) + "#photo-" + encodeURIComponent(photo.id);

    photoPanelEl.innerHTML =
      '<div class="place-photo-panel-media">' +
        '<a href="' + escapeAttr(archiveUrl) + '"><img src="' + escapeAttr(photo.src) + '" alt="' + escapeHtml(photo.caption) + '" loading="lazy"></a>' +
      "</div>" +
      '<div class="place-photo-panel-info">' +
        '<p class="place-photo-panel-caption">' + escapeHtml(photo.caption) + "</p>" +
        '<p class="place-photo-panel-datelocation">' + escapeHtml([photo.date, photo.location].filter(Boolean).join(" · ")) + "</p>" +
        '<p class="place-photo-panel-meta">' + escapeHtml(metaParts.filter(Boolean).join(" · ")) + "</p>" +
        (photo.ref ? '<p class="place-photo-panel-ref">Ref: ' + escapeHtml(photo.ref) + "</p>" : "") +
        '<a class="place-photo-panel-link" href="' + escapeAttr(archiveUrl) + '">View in the photo archive →</a>' +
      "</div>";
    photoPanelEl.hidden = false;
    photoPanelEl.classList.add("visible");
  }

  // History gets its own full-width, light-background section — same
  // reasoning as the submit form below: easier to read than crammed
  // into the facts panel's narrow dark info column alongside the
  // terser caption/date/credit/ref facts.
  function renderHistorySection(photo) {
    if (!historyEl || !photo.history) return;
    historyEl.innerHTML = "<h2>History</h2><p>" + escapeHtml(photo.history) + "</p>";
    historyEl.hidden = false;
    historyEl.classList.add("visible");
  }

  // Kept as its own full-width section rather than squeezed into the
  // facts panel's narrow info column — the form is long enough that
  // cramming it in there stretched the photo above it to match.
  function renderSubmitSection(photo) {
    if (!submitEl) return;
    submitEl.innerHTML = renderSubmitForm(photo);
    submitEl.hidden = false;
    submitEl.classList.add("visible");
  }

  // Same static "Know more about this photo?" form as the lightbox
  // (.photo-lightbox-submit in index.html/category.html) — not wired
  // to a backend here either, see the note in the form itself.
  function renderSubmitForm(photo) {
    return (
      '<div class="photo-lightbox-submit">' +
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
        "</form>" +
      "</div>"
    );
  }

  function renderBackLink(photo) {
    if (!backLinkEl) return;
    var cat = (typeof MAP_CATEGORIES !== "undefined" && MAP_CATEGORIES[photo.category]) ? MAP_CATEGORIES[photo.category].label : photo.category;
    backLinkEl.textContent = "← Back to " + cat;
    backLinkEl.href = "category.html?cat=" + encodeURIComponent(photo.category) + "#photo-" + encodeURIComponent(photo.id);
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
    var url = "category.html?cat=" + encodeURIComponent(photo.category) + "#photo-" + encodeURIComponent(photo.id);
    return (
      '<a class="place-photo-block" href="' + url + '">' +
        '<img src="' + photo.src + '" alt="' + escapeHtml(photo.caption) + '" loading="lazy">' +
        '<span class="place-photo-caption">' + escapeHtml(photo.caption) + "</span>" +
      "</a>"
    );
  }

  function renderDocumentBlock(block) {
    var label = block.label ? escapeHtml(block.label) : "View document";
    return (
      '<a class="place-doc-block" href="' + escapeAttr(block.file) + '" target="_blank" rel="noopener">' +
        DOC_ICON +
        "<span>" + label + "</span>" +
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
