/* Photo archive data — see PHOTOS.md for the full workflow.

   Each entry:
   - id:        unique slug, no spaces
   - src:       path to the optimised image in images/photos/
   - caption:   what's in the photo
   - category:  one of PHOTO_CATEGORIES below
   - date:      approximate date or period, as free text
   - credit:    who contributed it (or "Unknown" if not recorded)
   - consentNoted: true once you've confirmed it's OK to publish
   - example:   true for placeholder entries — remove this flag (and
                swap the src for a real photo) once it's a real record

   Remove the "example" entries below once real photos are added —
   they exist only to show the archive working end to end. */

const PHOTO_CATEGORIES = {
  streets:   { label: "Streets & Buildings" },
  people:    { label: "People & Events" },
  nature:    { label: "Nature & Views" },
  other:     { label: "Other" }
};

const PHOTOS_DATA = [
  {
    id: "example-melton-road",
    src: "images/hero/melton-road.svg",
    caption: "Example: Melton Road (placeholder illustration, not a real photo)",
    category: "streets",
    date: "Example only",
    credit: "—",
    consentNoted: false,
    example: true
  },
  {
    id: "example-watermead",
    src: "images/hero/watermead.svg",
    caption: "Example: Watermead Country Park (placeholder illustration, not a real photo)",
    category: "nature",
    date: "Example only",
    credit: "—",
    consentNoted: false,
    example: true
  },
  {
    id: "example-elizabeth-park",
    src: "images/hero/elizabeth-park.svg",
    caption: "Example: Elizabeth Park Sports & Community Centre (placeholder illustration, not a real photo)",
    category: "people",
    date: "Example only",
    credit: "—",
    consentNoted: false,
    example: true
  },
  {
    id: "example-st-michaels",
    src: "images/hero/st-michaels.svg",
    caption: "Example: St Michael's Church (placeholder illustration, not a real photo)",
    category: "streets",
    date: "Example only",
    credit: "—",
    consentNoted: false,
    example: true
  }
];
