/* Historic Map category taxonomy — fixed, not editorial content, so it
   stays as plain JS rather than a CMS-editable data file. The actual
   pins (buildings, places) live in data/map-pins.json, editable via the
   admin — see js/map.js, which fetches that file at runtime. */
const MAP_CATEGORIES = {
  streets: { label: "Streets & Buildings", color: "#2c6b4f" },
  people:  { label: "People & Events", color: "#b9822f" },
  nature:  { label: "Nature & Views", color: "#2f7d5b" },
  other:   { label: "Other", color: "#7a3b3b" },
  photo:   { label: "Photo", color: "#2f6f9e" }
};
