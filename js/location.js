document.addEventListener("DOMContentLoaded", function () {
  var headingEl = document.getElementById("location-heading");
  var crumbEl = document.getElementById("location-crumb");
  var subheadingEl = document.getElementById("location-subheading");
  var timelineEl = document.getElementById("location-timeline");
  var notFoundEl = document.getElementById("location-not-found");
  if (!timelineEl || typeof PHOTOS_DATA_PROMISE === "undefined") return;

  var params = new URLSearchParams(location.search);
  var locParam = params.get("loc");
  if (!locParam) {
    showNotFound();
    return;
  }

  PHOTOS_DATA_PROMISE.then(function (photos) {
    var matches = photos.filter(function (p) {
      return typeof p.location === "string" && slugifyLocation(p.location) === locParam;
    });
    if (matches.length === 0) {
      showNotFound();
      return;
    }

    var placeName = matches[0].location;
    document.title = placeName + " | Memories of Thurmaston";
    headingEl.textContent = placeName;
    crumbEl.textContent = placeName;
    subheadingEl.textContent = matches.length + (matches.length === 1 ? " photo" : " photos") + " of this place, from earliest to most recent.";
    subheadingEl.hidden = false;

    renderTimeline(matches);
  });

  function showNotFound() {
    notFoundEl.hidden = false;
    headingEl.textContent = "Place not found";
    crumbEl.textContent = "Not found";
  }

  // "Added <Month> <Year>" is the auto-filled placeholder used
  // everywhere on this site for a photo whose real date isn't known
  // (see automation/drive-photo-sync.gs.js and the Photos admin
  // form's own hint text for that field) — it's the date it was
  // *uploaded*, not anything about when the photo was actually taken,
  // so it must never be read as a real year here. Anything else with a
  // plain 4-digit number in it ("1913", "c.1936", "2002") is treated
  // as a genuine year.
  function extractYear(dateStr) {
    if (!dateStr || /^added\b/i.test(dateStr.trim())) return null;
    var m = dateStr.match(/\d{4}/);
    return m ? parseInt(m[0], 10) : null;
  }

  function renderTimeline(photos) {
    var dated = [];
    var undated = [];
    photos.forEach(function (p) {
      var year = extractYear(p.date);
      if (year) dated.push({ photo: p, year: year });
      else undated.push(p);
    });
    dated.sort(function (a, b) { return a.year - b.year; });

    var html = dated.map(function (entry) { return renderEntry(entry.photo); }).join("");
    if (undated.length > 0) {
      html += '<h2 class="location-timeline-heading">Date unknown</h2>' +
        undated.map(function (p) { return renderEntry(p); }).join("");
    }
    timelineEl.innerHTML = html;
  }

  function renderEntry(photo) {
    var metaParts = [photo.date];
    if (photo.credit && photo.credit !== "—") metaParts.push("Credit: " + photo.credit);
    return (
      '<article class="location-entry">' +
        '<a class="location-entry-media" href="place.html?photo=' + encodeURIComponent(photo.id) + '">' +
          '<img src="' + escapeAttr(photo.src) + '" alt="' + escapeHtml(photo.caption) + '" loading="lazy">' +
        "</a>" +
        '<div class="location-entry-body">' +
          '<a class="location-entry-caption" href="place.html?photo=' + encodeURIComponent(photo.id) + '">' + escapeHtml(photo.caption) + "</a>" +
          '<p class="location-entry-meta">' + escapeHtml(metaParts.filter(Boolean).join(" · ")) + "</p>" +
          (photo.history ? '<div class="location-entry-history">' + formatMultilineText(photo.history) + "</div>" : "") +
        "</div>" +
      "</article>"
    );
  }

  function escapeAttr(str) { return escapeHtml(str); }
});
