// Landing page for Events (events.html) — one tile per Event Page
// (data/events/<id>.json, built via the admin's "Event Pages"
// collection: a description plus a whole list of photos in one
// entry), linking to event.html?event=<id>. A single Events-category
// photo added via the older "Events (single photos)" collection isn't
// listed here — see the "Browse single Events photos" link, which
// goes to the plain flat category grid instead.
document.addEventListener("DOMContentLoaded", function () {
  var tilesEl = document.getElementById("events-tiles");
  var emptyEl = document.getElementById("events-empty");
  if (!tilesEl) return;

  fetch("data/events.json").then(function (res) { return res.ok ? res.json() : []; }).catch(function () { return []; }).then(function (events) {
    if (events.length === 0) {
      emptyEl.hidden = false;
      return;
    }

    tilesEl.innerHTML = events.map(function (event) {
      var cover = event.photos && event.photos[0];
      var count = (event.photos || []).length;
      var meta = [event.date, count + (count === 1 ? " photo" : " photos")].filter(Boolean).join(" · ");
      var bg = cover ? "background-image:url('" + escapeAttr(cover.image) + "')" : "";
      return (
        '<a href="event.html?event=' + encodeURIComponent(event.id) + '" style="' + bg + '">' +
          "<span>" + escapeHtml(event.name) +
            '<small style="display:block;font-weight:400;font-size:0.75rem;opacity:0.9;margin-top:2px">' + escapeHtml(meta) + "</small></span>" +
        "</a>"
      );
    }).join("");
  });

  function escapeAttr(str) { return escapeHtml(str); }
});
