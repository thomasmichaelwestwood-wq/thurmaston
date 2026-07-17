// Per-event timeline page (event.html?event=<slug>) — every photo of
// one named, recurring event (see admin/config.yml's Event name field
// on the Events collection), grouped into one section per year it's
// been held, oldest year first. The events.html landing page is what
// links here per event; this page doesn't re-derive the event list
// itself, just filters straight to the one matching ?event=.
//
// Loads js/photos.js purely for PHOTOS_DATA_PROMISE and buildPhotoThumb
// — its own DOMContentLoaded handler no-ops safely here since none of
// #photo-grid/#photo-filters/etc exist on this page.
document.addEventListener("DOMContentLoaded", function () {
  var headingEl = document.getElementById("event-heading");
  var crumbEl = document.getElementById("event-crumb");
  var subheadingEl = document.getElementById("event-subheading");
  var timelineEl = document.getElementById("event-timeline");
  var notFoundEl = document.getElementById("event-not-found");
  if (!timelineEl || typeof PHOTOS_DATA_PROMISE === "undefined") return;

  var params = new URLSearchParams(location.search);
  var eventParam = params.get("event");
  if (!eventParam) {
    showNotFound();
    return;
  }

  PHOTOS_DATA_PROMISE.then(function (photos) {
    var matches = photos.filter(function (p) {
      return p.category === "events" && typeof p.eventName === "string" && slugifyText(p.eventName) === eventParam;
    });
    if (matches.length === 0) {
      showNotFound();
      return;
    }

    var eventName = matches[0].eventName;
    document.title = eventName + " | Memories of Thurmaston";
    headingEl.textContent = eventName;
    crumbEl.textContent = eventName;

    var years = groupByYear(matches);
    var yearCount = years.dated.length + (years.undated.length > 0 ? 1 : 0);
    subheadingEl.textContent = matches.length + (matches.length === 1 ? " photo" : " photos") +
      " across " + years.dated.length + (years.dated.length === 1 ? " year" : " years") +
      ", from earliest to most recent.";
    subheadingEl.hidden = false;

    renderTimeline(years);
  });

  function showNotFound() {
    notFoundEl.hidden = false;
    headingEl.textContent = "Event not found";
    crumbEl.textContent = "Not found";
  }

  // Same "oldest year first, undated held back to its own group at the
  // end" rule js/location.js's orderPhotos uses for a place's timeline
  // — here grouped one level further, by year rather than by photo.
  function groupByYear(photoList) {
    var byYear = {};
    var undated = [];
    photoList.forEach(function (p) {
      var year = extractYear(p.date);
      if (year) {
        if (!byYear[year]) byYear[year] = [];
        byYear[year].push(p);
      } else {
        undated.push(p);
      }
    });
    var dated = Object.keys(byYear).map(Number).sort(function (a, b) { return a - b; })
      .map(function (year) { return { year: year, photos: byYear[year] }; });
    return { dated: dated, undated: undated };
  }

  function renderTimeline(years) {
    var html = years.dated.map(renderYearGroup).join("");
    if (years.undated.length > 0) {
      html += '<h2 class="location-timeline-heading">Date unknown</h2><div class="photo-grid"></div>';
    }
    timelineEl.innerHTML = html;

    // Photo thumbnails are built as real DOM nodes (buildPhotoThumb),
    // not HTML strings, so each year's grid is filled in after the
    // headings/wrapper markup above is in place.
    var grids = timelineEl.querySelectorAll(".photo-grid");
    years.dated.forEach(function (group, i) {
      group.photos.forEach(function (p) { grids[i].appendChild(buildPhotoThumb(p)); });
    });
    if (years.undated.length > 0) {
      var undatedGrid = grids[grids.length - 1];
      years.undated.forEach(function (p) { undatedGrid.appendChild(buildPhotoThumb(p)); });
    }
  }

  function renderYearGroup(group) {
    return '<h2 class="location-timeline-heading">' + group.year + '</h2><div class="photo-grid"></div>';
  }
});
