// One Event Page (event.html?event=<id>) — its own description and a
// gallery of every photo added to it in the admin's "Event Pages"
// collection (data/events/<id>.json, aggregated into data/events.json
// by scripts/rebuild-events-index.js). `photos` is a plain array of
// image paths (strings), not objects — deliberately: Decap's list
// widget only supports selecting several images at once in the media
// library and adding one list item per file automatically when the
// list holds a single plain field (an image), not an object with
// several sub-fields (which would've meant a caption per photo, but
// forced one-at-a-time uploads instead of genuine bulk add — asked
// for explicitly, so bulk-add won over per-photo captions). Click a
// photo to open it full-screen with zoom/pan, same mechanism as
// place.html's own main photo (vendor/panzoom, .place-zoom-overlay) —
// reused here since an Event Page's photos don't have individual pages
// of their own to link out to.
document.addEventListener("DOMContentLoaded", function () {
  var headingEl = document.getElementById("event-heading");
  var crumbEl = document.getElementById("event-crumb");
  var subheadingEl = document.getElementById("event-subheading");
  var descriptionEl = document.getElementById("event-description");
  var galleryEl = document.getElementById("event-gallery");
  var notFoundEl = document.getElementById("event-not-found");
  var zoomOverlay = document.getElementById("place-zoom-overlay");
  var zoomStage = document.getElementById("place-zoom-stage");
  var zoomImage = document.getElementById("place-zoom-image");
  var zoomCloseBtn = document.getElementById("place-zoom-close");
  var zoomInBtn = document.getElementById("place-zoom-in");
  var zoomOutBtn = document.getElementById("place-zoom-out");
  var zoomResetBtn = document.getElementById("place-zoom-reset");
  if (!galleryEl) return;

  var params = new URLSearchParams(location.search);
  var eventId = params.get("event");
  if (!eventId) {
    showNotFound();
  } else {
    fetch("data/events.json").then(function (res) { return res.ok ? res.json() : []; }).catch(function () { return []; }).then(function (events) {
      var event = events.find(function (e) { return e.id === eventId; });
      if (!event) {
        showNotFound();
        return;
      }
      renderEvent(event);
    });
  }

  function showNotFound() {
    notFoundEl.hidden = false;
    headingEl.textContent = "Event not found";
    crumbEl.textContent = "Not found";
  }

  function renderEvent(event) {
    document.title = event.name + " | Memories of Thurmaston";
    headingEl.textContent = event.name;
    crumbEl.textContent = event.name;

    var photos = event.photos || [];
    if (event.date || photos.length) {
      subheadingEl.textContent = [event.date, photos.length + (photos.length === 1 ? " photo" : " photos")].filter(Boolean).join(" · ");
      subheadingEl.hidden = false;
    }

    if (event.description) {
      descriptionEl.innerHTML = formatMultilineText(event.description);
      descriptionEl.hidden = false;
      descriptionEl.classList.add("visible");
    }

    galleryEl.innerHTML = photos.map(renderThumb).join("");
    Array.prototype.forEach.call(galleryEl.querySelectorAll(".photo-thumb"), function (btn, i) {
      btn.addEventListener("click", function () { openZoom(photos[i]); });
    });
  }

  function renderThumb(src) {
    return (
      '<button type="button" class="photo-thumb" style="font:inherit" aria-label="View photo">' +
        '<img src="' + escapeAttr(src) + '" alt="" loading="lazy">' +
      "</button>"
    );
  }

  function escapeAttr(str) { return escapeHtml(str); }

  // Same zoom/pan mechanism as js/place.js's own main-photo viewer —
  // see its comment for why a vendored library (vendor/panzoom) rather
  // than hand-rolled pinch-zoom. The instance is created once (on
  // first open) and reused on later opens.
  var zoomInstance = null;
  function openZoom(src) {
    if (!zoomOverlay || typeof panzoom === "undefined") return;
    zoomImage.src = src;
    zoomImage.alt = "";
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

  function closeZoom() {
    if (!zoomOverlay) return;
    zoomOverlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  if (zoomOverlay) {
    zoomCloseBtn.onclick = closeZoom;
    zoomOverlay.addEventListener("click", function (e) {
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
      if (zoomInstance) { zoomInstance.moveTo(0, 0); zoomInstance.zoomAbs(0, 0, 1); }
    };
  }
});
