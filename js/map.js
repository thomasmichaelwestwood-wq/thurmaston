document.addEventListener("DOMContentLoaded", function () {
  var mapEl = document.getElementById("historic-map");
  if (!mapEl || typeof L === "undefined") return;

  var map = L.map(mapEl, { scrollWheelZoom: false }).setView([52.6789, -1.0972], 15);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  }).addTo(map);

  mapEl.addEventListener("click", function () { map.scrollWheelZoom.enable(); });
  mapEl.addEventListener("mouseleave", function () { map.scrollWheelZoom.disable(); });

  var listEl = document.getElementById("map-list");
  var filterEl = document.getElementById("map-filters");
  var markers = {};
  var activeCategory = "all";

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

  function popupHtml(item) {
    var cat = MAP_CATEGORIES[item.category] || MAP_CATEGORIES.other;
    var badge = item.example ? '<span class="map-example-badge">Example — needs a real source</span>' : "";
    return (
      '<div class="map-popup">' +
        '<span class="map-popup-cat" style="--pin-color:' + cat.color + '">' + cat.label + "</span>" +
        "<h3>" + escapeHtml(item.name) + "</h3>" +
        '<p class="map-popup-period">' + escapeHtml(item.period) + "</p>" +
        "<p>" + escapeHtml(item.description) + "</p>" +
        badge +
      "</div>"
    );
  }

  MAP_DATA.forEach(function (item) {
    var marker = L.marker([item.lat, item.lng], { icon: makeIcon(item.category) })
      .addTo(map)
      .bindPopup(popupHtml(item));
    markers[item.id] = marker;
  });

  function renderList() {
    listEl.innerHTML = "";
    var items = MAP_DATA.filter(function (item) {
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
      li.innerHTML =
        '<span class="map-list-dot" style="--pin-color:' + cat.color + '"></span>' +
        '<span><strong>' + escapeHtml(item.name) + "</strong>" +
        '<span class="map-list-period">' + escapeHtml(item.period) + "</span></span>";
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
    MAP_DATA.forEach(function (item) {
      var marker = markers[item.id];
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

  renderList();
});
