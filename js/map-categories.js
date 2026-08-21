/* Interactive Map category taxonomy — fixed, not editorial content, so it
   stays as plain JS rather than a CMS-editable data file. The actual
   pins (buildings, places) live in data/map-pins.json, editable via the
   admin — see js/map.js, which fetches that file at runtime. */
const MAP_CATEGORIES = {
  streets:  { label: "Streets & Buildings", color: "#2c6b4f" },
  people:   { label: "People", color: "#b9822f" },
  events:   { label: "Events", color: "#6b4c8a" },
  nature:   { label: "Nature & Views", color: "#2f7d5b" },
  aerial:   { label: "Aerial", color: "#3f7ea6" },
  other:    { label: "Other", color: "#7a3b3b" },
  churches: { label: "Churches & Religious Buildings", color: "#8c5a3c" },
  groups:   { label: "Groups & Organisations", color: "#4a90a4" },
  industry: { label: "Industry", color: "#5a5a5a" },
  maps:     { label: "Maps", color: "#3d4f91" },
  military: { label: "Military", color: "#6b6b2e" },
  schools:  { label: "Schools", color: "#d17a22" },
  sports:   { label: "Sports", color: "#b23a6b" },
  photo:    { label: "Photo", color: "#2f6f9e" }
};
