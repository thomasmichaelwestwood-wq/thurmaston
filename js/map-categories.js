/* Interactive Map category colours/labels — the real list now comes from
   data/categories.json (see js/map.js, which fills this object in once
   that fetch resolves, keyed by slug, the same way js/main.js's other
   CATEGORIES_DATA_PROMISE consumers do). Two entries stay hardcoded here:
   "other" as a safety net if that fetch ever fails, and "photo", which
   isn't a photo category at all — it's a different kind of map marker
   (see js/map.js) — so it has nothing in data/categories.json to come
   from. */
const MAP_CATEGORIES = {
  other: { label: "Other", color: "#7a3b3b" },
  photo: { label: "Photo", color: "#2f6f9e" }
};

// Resolves (to the category list itself, in case a consumer needs it —
// see js/map.js's dynamic filter chips) once MAP_CATEGORIES has been
// filled in from data/categories.json. Any page using MAP_CATEGORIES for
// more than the hardcoded "other"/"photo" fallback should wait on this
// before rendering, same reasoning as js/main.js's own
// CATEGORIES_DATA_PROMISE consumers.
var MAP_CATEGORIES_READY = (typeof CATEGORIES_DATA_PROMISE !== "undefined" ? CATEGORIES_DATA_PROMISE : Promise.resolve([])).then(function (categories) {
  categories.forEach(function (c) {
    MAP_CATEGORIES[c.slug] = { label: c.label, color: c.color };
  });
  return categories;
});
