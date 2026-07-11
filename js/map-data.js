/* Historic Map data.
   Each entry is a building or place that no longer stands (or has
   substantially changed) in Thurmaston. Add new entries as residents
   confirm them — remove the "example: true" flag once a location is
   backed by a real source (a photo, a resident's account, a map, a
   directory listing, etc).

   category must be one of: streets, people, nature, other — the same
   categories used by the photo archive, so both features sort things
   the same way.
   lat/lng: approximate coordinates of the site today.
   photoSrc/photoId (optional): shows the real photo in the pin's popup,
   and links to it in the Photo Archive lightbox — photoId must match
   that photo's id in data/photos.json. */
const MAP_DATA = [
  {
    id: "generous-briton",
    name: "The Generous Briton",
    category: "streets",
    lat: 52.679363200371284,
    lng: -1.0979936680376168,
    period: "Pictured c.1936",
    description: "A village pub, pictured around 1936. If you know more about it — when it closed, or what stands there now — get in touch.",
    photoSrc: "images/photos/1RjrLTG9-003-generous-briton-c1936-mot-1-11.jpg",
    photoId: "1RjrLTG9-003-generous-briton-c1936-mot-1-11",
    example: false
  },
  {
    id: "manor-hotel-building",
    name: "Manor Hotel",
    category: "streets",
    lat: 52.672797650614264,
    lng: -1.1033455758707467,
    period: "Exact date unknown",
    description: "If you know more about the Manor Hotel's history — when it operated, or what's there now — get in touch.",
    photoSrc: "images/photos/1w3CZ0o6-manor-hotel.jpg",
    photoId: "1w3CZ0o6-manor-hotel",
    example: false
  }
];

const MAP_CATEGORIES = {
  streets: { label: "Streets & Buildings", color: "#2c6b4f" },
  people:  { label: "People & Events", color: "#b9822f" },
  nature:  { label: "Nature & Views", color: "#2f7d5b" },
  other:   { label: "Other", color: "#7a3b3b" },
  photo:   { label: "Photo", color: "#2f6f9e" }
};
