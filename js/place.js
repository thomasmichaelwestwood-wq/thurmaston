document.addEventListener("DOMContentLoaded", function () {
  var contentEl = document.getElementById("place-content");
  var notFoundEl = document.getElementById("place-not-found");
  var headingEl = document.getElementById("place-heading");
  var crumbEl = document.getElementById("place-crumb");
  var photoPanelEl = document.getElementById("place-photo-panel");
  var relatedEl = document.getElementById("place-related");
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
      renderRelatedPhotos(primaryPhoto, photos);
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
        (photo.history ? '<p class="place-photo-panel-history">' + escapeHtml(photo.history) + "</p>" : "") +
        (photo.ref ? '<p class="place-photo-panel-ref">Ref: ' + escapeHtml(photo.ref) + "</p>" : "") +
        '<a class="place-photo-panel-link" href="' + escapeAttr(archiveUrl) + '">View in the photo archive →</a>' +
      "</div>";
    photoPanelEl.hidden = false;
    photoPanelEl.classList.add("visible");
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
