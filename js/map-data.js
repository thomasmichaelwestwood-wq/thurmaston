/* Historic Map data.
   Each entry is a building or place that no longer stands (or has
   substantially changed) in Thurmaston. Add new entries as residents
   confirm them — remove the "example: true" flag once a location is
   backed by a real source (a photo, a resident's account, a map, a
   directory listing, etc).

   category must be one of: residential, trade, inn, civic, other
   lat/lng: approximate coordinates of the site today. */
const MAP_DATA = [
  {
    id: "example-forge",
    name: "Example: The Old Forge (approximate site)",
    category: "trade",
    lat: 52.6805,
    lng: -1.0978,
    period: "Gone by the mid-20th century (example only)",
    description: "Placeholder entry showing how a village blacksmith's forge or workshop could be marked. Replace with a real record — a photo, a name, and roughly when it disappeared.",
    example: true
  },
  {
    id: "example-cottages",
    name: "Example: Row of cottages on Melton Road",
    category: "residential",
    lat: 52.6795,
    lng: -1.0970,
    period: "Demolished — exact date unknown (example only)",
    description: "Placeholder entry for housing that once stood along the historic Melton Road / Fosse Way corridor before redevelopment. If you remember these, or have a photo, please tell us.",
    example: true
  },
  {
    id: "example-inn",
    name: "Example: Old coaching inn",
    category: "inn",
    lat: 52.6788,
    lng: -1.0965,
    period: "Example only — no date recorded",
    description: "Placeholder entry for a former pub or coaching inn on the old Fosse Way route. Thurmaston likely had several over the centuries — help us record where and what they were called.",
    example: true
  },
  {
    id: "example-schoolroom",
    name: "Example: Former chapel schoolroom",
    category: "civic",
    lat: 52.6779,
    lng: -1.0958,
    period: "Example only — no date recorded",
    description: "Placeholder entry near St Michael's for a former schoolroom or chapel building. Swap this for a verified building and a short history once confirmed.",
    example: true
  },
  {
    id: "example-mill",
    name: "Example: Mill on the River Soar",
    category: "trade",
    lat: 52.6760,
    lng: -1.1005,
    period: "Example only — no date recorded",
    description: "Placeholder entry for a watermill or similar riverside building on the Soar. Thurmaston's location on the river makes this plausible, but it needs a real source before it's more than a guess.",
    example: true
  }
];

const MAP_CATEGORIES = {
  residential: { label: "Residential", color: "#2c6b4f" },
  trade:       { label: "Trade & Industry", color: "#7a5a2e" },
  inn:         { label: "Inn / Pub", color: "#b9822f" },
  civic:       { label: "Civic / Religious", color: "#274d5c" },
  other:       { label: "Other", color: "#7a3b3b" },
  photo:       { label: "Photo", color: "#2f6f9e" }
};
