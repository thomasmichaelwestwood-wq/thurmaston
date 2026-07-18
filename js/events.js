// Landing page for the Events category (events.html) — one tile per
// named, recurring event (grouped by eventName, derived by
// scripts/rebuild-photos-index.js from the photo's own nested folder
// path — see admin/config.yml's photos_events "Event / Year folder"
// — not a typed field), rather than the usual flat photo grid. Each
// tile links to event.html?event=<slug>, which shows every year that
// event has been photographed. Event-category photos filed loose
// (no event folder) still show up in a plain grid further down the
// page, so nothing goes missing.
//
// Loads js/photos.js purely for PHOTOS_DATA_PROMISE and buildPhotoThumb
// — its own DOMContentLoaded handler no-ops safely here since none of
// #photo-grid/#photo-filters/etc exist on this page.
document.addEventListener("DOMContentLoaded", function () {
  var tilesEl = document.getElementById("events-tiles");
  var emptyEl = document.getElementById("events-empty");
  var otherSectionEl = document.getElementById("events-other-section");
  var otherGridEl = document.getElementById("events-other-grid");
  if (!tilesEl || typeof PHOTOS_DATA_PROMISE === "undefined") return;

  PHOTOS_DATA_PROMISE.then(function (photos) {
    var eventPhotos = photos.filter(function (p) { return p.category === "events"; });

    var groups = {};
    var order = [];
    var ungrouped = [];
    eventPhotos.forEach(function (p) {
      var name = typeof p.eventName === "string" ? p.eventName.trim() : "";
      if (!name) {
        ungrouped.push(p);
        return;
      }
      var slug = slugifyText(name);
      if (!groups[slug]) {
        groups[slug] = { name: name, photos: [] };
        order.push(slug);
      }
      groups[slug].photos.push(p);
    });

    // eventPhotos (via allPhotos) is newest-first already, so the first
    // photo seen for a slug is its most recent — same "latest as the
    // tile image" convention setCategoryTileImages() uses for the
    // homepage's own category tiles.
    if (order.length === 0) {
      emptyEl.hidden = false;
    } else {
      tilesEl.innerHTML = order.map(function (slug) {
        var group = groups[slug];
        var cover = group.photos[0];
        var years = distinctYears(group.photos);
        var meta = group.photos.length + (group.photos.length === 1 ? " photo" : " photos");
        if (years.length > 0) meta += " · " + (years.length === 1 ? years[0] : years[0] + "–" + years[years.length - 1]);
        return (
          '<a href="event.html?event=' + encodeURIComponent(slug) + '" style="background-image:url(\'' + escapeAttr(cover.src) + '\')">' +
            '<span>' + escapeHtml(group.name) + '<small style="display:block;font-weight:400;font-size:0.75rem;opacity:0.9;margin-top:2px">' + escapeHtml(meta) + '</small></span>' +
          '</a>'
        );
      }).join("");
    }

    if (ungrouped.length > 0) {
      otherSectionEl.hidden = false;
      otherGridEl.innerHTML = "";
      ungrouped.forEach(function (p) { otherGridEl.appendChild(buildPhotoThumb(p)); });
    }
  });

  function distinctYears(photoList) {
    var years = {};
    photoList.forEach(function (p) {
      // eventYear (from the photo's own "<event>/<year>" folder) is
      // authoritative when set — falling back to the date field's
      // extractYear only for a photo filed under an event with no
      // year subfolder yet.
      var y = p.eventYear || extractYear(p.date);
      if (y) years[y] = true;
    });
    return Object.keys(years).map(Number).sort(function (a, b) { return a - b; });
  }

  function escapeAttr(str) { return escapeHtml(str); }
});
