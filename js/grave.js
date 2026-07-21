// One grave's own page (grave.html?grave=<id>) — name, number, dates,
// inscription, notes, what3words location and an optional headstone
// photo. Uses the shared CEMETERY_DATA_PROMISE (js/main.js) rather than
// its own fetch of data/cemetery.json, same reasoning as
// js/chronology.js/CHRONOLOGY_DATA_PROMISE — initSearch() is already
// fetching this file for the site search index. Photo zoom overlay is
// the same mechanism as js/event.js's (vendor/panzoom), trimmed to a
// single photo — Prev/Next stay hidden since there's only ever one.
document.addEventListener("DOMContentLoaded", function () {
  var headingEl = document.getElementById("grave-heading");
  var crumbEl = document.getElementById("grave-crumb");
  var subheadingEl = document.getElementById("grave-subheading");
  var w3wBannerEl = document.getElementById("grave-w3w-banner");
  var inscriptionEl = document.getElementById("grave-inscription");
  var notesEl = document.getElementById("grave-notes");
  var galleryEl = document.getElementById("grave-gallery");
  var notFoundEl = document.getElementById("grave-not-found");
  var zoomOverlay = document.getElementById("place-zoom-overlay");
  var zoomStage = document.getElementById("place-zoom-stage");
  var zoomImage = document.getElementById("place-zoom-image");
  var zoomCloseBtn = document.getElementById("place-zoom-close");
  var zoomInBtn = document.getElementById("place-zoom-in");
  var zoomOutBtn = document.getElementById("place-zoom-out");
  var zoomResetBtn = document.getElementById("place-zoom-reset");
  if (!galleryEl) return;

  var params = new URLSearchParams(location.search);
  var graveId = params.get("grave");
  if (!graveId) {
    showNotFound();
  } else if (typeof CEMETERY_DATA_PROMISE === "undefined") {
    showNotFound();
  } else {
    CEMETERY_DATA_PROMISE.then(function (graves) {
      var grave = graves.find(function (g) { return g.id === graveId; });
      if (!grave) {
        showNotFound();
        return;
      }
      renderGrave(grave);
    });
  }

  function showNotFound() {
    notFoundEl.hidden = false;
    headingEl.textContent = "Grave not found";
    crumbEl.textContent = "Not found";
  }

  function renderGrave(grave) {
    document.title = grave.name + " | Memories of Thurmaston";
    headingEl.textContent = grave.name;
    crumbEl.textContent = grave.name;

    var subParts = [grave.number ? "Grave " + grave.number : null, grave.dates].filter(Boolean);
    if (subParts.length) {
      subheadingEl.textContent = subParts.join(" · ");
      subheadingEl.hidden = false;
    }

    if (w3wBannerEl && grave.whatThreeWords) {
      var words = grave.whatThreeWords.replace(/^\/+/, "").trim();
      w3wBannerEl.href = "https://what3words.com/" + encodeURIComponent(words);
      w3wBannerEl.innerHTML = "Find this grave: <strong>///" + escapeHtml(words) + "</strong> — open in what3words →";
      w3wBannerEl.hidden = false;
    }

    if (grave.inscription) {
      inscriptionEl.innerHTML = "<h2>Inscription</h2>" + formatMultilineText(grave.inscription);
      inscriptionEl.hidden = false;
      inscriptionEl.classList.add("visible");
    }

    if (grave.notes) {
      notesEl.innerHTML = "<h2>Notes</h2>" + formatMultilineText(grave.notes);
      notesEl.hidden = false;
      notesEl.classList.add("visible");
    }

    currentPhotos = grave.photo ? [grave.photo] : [];
    galleryEl.innerHTML = currentPhotos.map(renderThumb).join("");
    Array.prototype.forEach.call(galleryEl.querySelectorAll(".photo-thumb"), function (btn, i) {
      btn.addEventListener("click", function () { openZoom(i); });
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

  var currentPhotos = [];
  var currentIndex = -1;
  var zoomInstance = null;
  function openZoom(index) {
    if (!zoomOverlay || typeof panzoom === "undefined") return;
    currentIndex = index;
    zoomImage.src = currentPhotos[currentIndex];
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
