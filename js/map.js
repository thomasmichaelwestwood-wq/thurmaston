document.addEventListener("DOMContentLoaded", function () {
  var mapEl = document.getElementById("historic-map");
  if (!mapEl || typeof L === "undefined") return;

  var map = L.map(mapEl, { scrollWheelZoom: false }).setView([52.6789, -1.0972], 15);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  }).addTo(map);

  mapEl.addEventListener("click", function () {
    map.scrollWheelZoom.enable();
  });
  mapEl.addEventListener("mouseleave", function () { map.scrollWheelZoom.disable(); });

  var listEl = document.getElementById("map-list");
  var filterEl = document.getElementById("map-filters");
  var markers = {};
  var activeCategory = (typeof window.LOCKED_CATEGORY === "string" && window.LOCKED_CATEGORY) ? window.LOCKED_CATEGORY : "all";

  // Curated pins (richer, hand-written descriptions, editable via the
  // admin) live in data/map-pins.json. mapItems extends that list with a
  // pin for every OTHER geotagged photo in data/photos.json — via an
  // "@lat,lng" in the filename or a recognised place subfolder — so a
  // located photo shows up on the map without anyone needing to also
  // add a curated entry by hand.
  var mapItems = [];

  function makeIcon(category) {
    var color = (MAP_CATEGORIES[category] || MAP_CATEGORIES.other).color;
    return L.divIcon({
      className: "map-pin-icon",
      html: '<span class="map-pin" style="--pin-color:' + color + '"></span>',
      iconSize: [26, 34],
      iconAnchor: [13, 34],
      popupAnchor: [0, -30]
    });
  }

  // Where a pin's popup links out to — three kinds of item can share
  // one pin: an Event Page (own page, every photo of it), a photo
  // (its own place.html page), or a curated Map pin with a Story page
  // (place.html?slug=). At most one of these is ever set per item.
  function itemHref(item) {
    if (item.eventId) return "event.html?event=" + encodeURIComponent(item.eventId);
    if (item.photoId) return "place.html?photo=" + encodeURIComponent(item.photoId);
    if (item.pageSlug) return "place.html?slug=" + encodeURIComponent(item.pageSlug);
    return null;
  }

  function popupHtml(item) {
    var cat = MAP_CATEGORIES[item.category] || MAP_CATEGORIES.other;
    var href = itemHref(item);
    var photo = item.photoSrc && href ?
      '<a class="map-popup-photo-btn" href="' + href + '" aria-label="View photo: ' + escapeHtml(item.name) + '">' +
        '<img src="' + item.photoSrc + '" alt="">' +
        '<span class="map-popup-photo-hint">Click on picture for more</span>' +
      '</a>' : "";
    var subtitle = [item.period, item.location].filter(Boolean).join(" · ");
    var desc = item.description ? "<p>" + escapeHtml(item.description) + "</p>" : "";
    // Only needed when there's no photo thumbnail to click through on —
    // if there is one, it already links to the same place, so a second
    // link to it would be redundant.
    var pageLink = href && !photo ?
      '<a class="map-popup-page-link" href="' + href + '">' + (item.eventId ? "See the photos →" : "Read the full story →") + "</a>" : "";
    return (
      '<div class="map-popup">' +
        '<span class="map-popup-cat" style="--pin-color:' + cat.color + '">' + cat.label + "</span>" +
        "<h3>" + escapeHtml(item.name) + "</h3>" +
        photo +
        (subtitle ? '<p class="map-popup-period">' + escapeHtml(subtitle) + "</p>" : "") +
        desc +
        pageLink +
      "</div>"
    );
  }

  function addMarkers() {
    mapItems.forEach(function (item) {
      var marker = L.marker([item.lat, item.lng], { icon: makeIcon(item.category) })
        .addTo(map)
        // A short hover label — the popup already has the full detail,
        // but that only opens on click; this lets someone see what a
        // pin is just by pointing at it, without committing to a click.
        .bindTooltip(item.name, { direction: "top", offset: [0, -28] })
        .bindPopup(popupHtml(item));
      markers[item.id] = marker;
    });
    applyFilter(activeCategory);
  }

  var mapPinsPromise = fetch("data/map-pins.json").then(function (res) { return res.ok ? res.json() : { pins: [] }; }).then(function (data) { return data.pins || []; }).catch(function () { return []; });
  var photosPromise = (typeof PHOTOS_DATA_PROMISE !== "undefined") ? PHOTOS_DATA_PROMISE : Promise.resolve([]);
  var eventsPromise = fetch("data/events.json").then(function (res) { return res.ok ? res.json() : []; }).catch(function () { return []; });

  // Curated pins store their location as a single "lat, lng" string —
  // the same format Google Maps gives you when you right-click a spot
  // and copy the coordinates — rather than two separate number fields.
  function parseCoords(str) {
    var match = typeof str === "string" && str.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (!match) return null;
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }

  Promise.all([mapPinsPromise, photosPromise, eventsPromise]).then(function (results) {
    var curatedPins = results[0].map(function (item) {
      var coords = parseCoords(item.coords);
      if (!coords) return null;
      return Object.assign({}, item, coords);
    }).filter(Boolean);
    var photos = results[1];
    var events = results[2];

    mapItems = curatedPins.slice();

    var curatedPhotoIds = {};
    curatedPins.forEach(function (item) { if (item.photoId) curatedPhotoIds[item.photoId] = true; });
    photos.forEach(function (photo) {
      if (typeof photo.lat !== "number" || typeof photo.lng !== "number") return;
      if (curatedPhotoIds[photo.id]) return;
      mapItems.push({
        id: "photo-" + photo.id,
        name: photo.caption,
        category: photo.category,
        lat: photo.lat,
        lng: photo.lng,
        period: photo.date,
        location: photo.location || "",
        description: photo.credit && photo.credit !== "—" ? "Credit: " + photo.credit : "",
        photoSrc: photo.src,
        photoId: photo.id,
        pageSlug: photo.pageSlug || ""
      });
    });
    // An Event Page with coordinates gets a pin the same way a located
    // photo does — "events" category colour (MAP_CATEGORIES.events),
    // linking to its own event.html page rather than place.html (see
    // itemHref above). The popup's photo thumbnail, if any, is the
    // event's own first photo.
    events.forEach(function (event) {
      if (typeof event.lat !== "number" || typeof event.lng !== "number") return;
      var cover = event.photos && event.photos[0];
      mapItems.push({
        id: "event-" + event.id,
        name: event.name,
        category: "events",
        lat: event.lat,
        lng: event.lng,
        period: event.date,
        location: event.location || "",
        description: event.description || "",
        photoSrc: cover ? cover.image : "",
        eventId: event.id
      });
    });
    addMarkers();
  });

  function renderList() {
    listEl.innerHTML = "";
    var items = mapItems.filter(function (item) {
      return activeCategory === "all" || item.category === activeCategory;
    });

    if (items.length === 0) {
      var empty = document.createElement("li");
      empty.className = "map-list-empty";
      empty.textContent = "No entries in this category yet.";
      listEl.appendChild(empty);
      return;
    }

    items.forEach(function (item) {
      var cat = MAP_CATEGORIES[item.category] || MAP_CATEGORIES.other;
      var li = document.createElement("li");
      li.className = "map-list-item";
      li.style.setProperty("--pin-color", cat.color);
      var subtitle = [item.period, item.location].filter(Boolean).join(" · ");
      li.innerHTML =
        (item.photoSrc
          ? '<img class="map-list-thumb" src="' + item.photoSrc + '" alt="" loading="lazy">'
          : '<span class="map-list-dot"></span>') +
        '<span class="map-list-text"><strong>' + escapeHtml(item.name) + "</strong>" +
        '<span class="map-list-period">' + escapeHtml(subtitle) + "</span></span>";
      li.addEventListener("click", function () {
        map.flyTo([item.lat, item.lng], 17, { duration: 0.6 });
        map.once("moveend", function () {
          markers[item.id].openPopup();
        });
      });
      listEl.appendChild(li);
    });
  }

  function applyFilter(category) {
    activeCategory = category;
    mapItems.forEach(function (item) {
      var marker = markers[item.id];
      if (!marker) return;
      var show = category === "all" || item.category === category;
      if (show && !map.hasLayer(marker)) marker.addTo(map);
      if (!show && map.hasLayer(marker)) map.removeLayer(marker);
    });
    renderList();
    if (filterEl) {
      Array.prototype.forEach.call(filterEl.querySelectorAll("button"), function (btn) {
        btn.classList.toggle("active", btn.dataset.category === category);
      });
    }
  }

  if (filterEl) {
    filterEl.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-category]");
      if (!btn) return;
      applyFilter(btn.dataset.category);
    });
  }

  var photoMarker = null;
  window.flyToPhotoLocation = function (lat, lng, photo) {
    var mapSection = document.getElementById("map");
    if (mapSection) mapSection.scrollIntoView({ behavior: "smooth" });

    map.flyTo([lat, lng], 17, { duration: 0.6 });
    map.once("moveend", function () {
      if (photoMarker) map.removeLayer(photoMarker);
      photoMarker = L.marker([lat, lng], { icon: makeIcon("photo") }).addTo(map);
      photoMarker.bindTooltip(photo.caption, { direction: "top", offset: [0, -28] });
      var cat = MAP_CATEGORIES.photo;
      var subtitle = [photo.date, photo.location].filter(Boolean).join(" · ");
      photoMarker.bindPopup(
        '<div class="map-popup">' +
          '<span class="map-popup-cat" style="--pin-color:' + cat.color + '">' + cat.label + "</span>" +
          "<h3>" + escapeHtml(photo.caption) + "</h3>" +
          '<a class="map-popup-photo-btn" href="place.html?photo=' + encodeURIComponent(photo.id) + '" aria-label="View photo: ' + escapeHtml(photo.caption) + '">' +
            '<img src="' + photo.src + '" alt="">' +
            '<span class="map-popup-photo-hint">Click on picture for more</span>' +
          "</a>" +
          (subtitle ? '<p class="map-popup-period">' + escapeHtml(subtitle) + "</p>" : "") +
        "</div>"
      ).openPopup();
    });
  };

  // A photo's "View on map" link (from place.html) lands here with
  // ?photo=ID rather than opening the map from inside a modal on the
  // same page like it used to — this is what makes that link actually
  // fly to and highlight the right pin once it arrives.
  var photoFlyParam = new URLSearchParams(location.search).get("photo");
  if (photoFlyParam) {
    photosPromise.then(function (photos) {
      var target = photos.find(function (p) { return p.id === photoFlyParam; });
      if (target && typeof target.lat === "number" && typeof target.lng === "number") {
        window.flyToPhotoLocation(target.lat, target.lng, target);
      }
    });
  }
});
