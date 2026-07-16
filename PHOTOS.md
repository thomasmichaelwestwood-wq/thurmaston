# Photo workflow

How photos get onto the live site — two ways: drop them into Google Drive
(fully automated, one-time setup, described below), or add one directly
through the admin at `/admin` (see "2c," below) when there's no Drive
involved — a photo someone's just handed you, say.

## 1. Drop photos into Google Drive

Inside the shared **"Memories of Thurmaston Photos"** folder, there are
six subfolders:

```
Memories of Thurmaston Photos/
├── Streets & Buildings/
├── People/
├── Events/
├── Nature & Views/
├── Other/
└── Hero images/
```

**People vs Events:** People is for portraits, individuals, and small
groups; Events is for gatherings, celebrations, fetes, and other
occasions. If a photo could go either way, go with whichever it's more
*about* — a photo of the fete committee lined up for a portrait is
People, a photo of the fete itself in full swing is Events.

Drag a photo into whichever folder matches what it shows. A photo dropped
loose in the top-level folder (not in a subfolder) is filed under "Other."

**Hero images** is different from the rest — see "The homepage hero banner,"
below.

**To make a photo searchable:** rename the file to something descriptive
before uploading — e.g. `Old forge on Melton Road 1960s.jpg`, not
`IMG_4213.jpg`. The filename becomes the photo's caption, and the caption
is what search matches against. Worth doing even for photos you're not
sure about the exact date of — "Melton Road shops, unsure of date" is a
perfectly good filename.

**Filing codes in the name are fine, no need to strip them first.** If a
filename has a leading catalog number ("003 ...") or a "MOT 1-11" style
reference code, the sync script automatically removes both from the
public caption — "003 Generous Briton c1936 MOT1-11.jpg" becomes the
caption "Generous Briton c1936". Nothing is lost: the exact original
filename is kept and shown as a small "Ref: …" tag when the photo is
opened, so it still maps back to your own numbering/albums. That ref
text is also searchable, so searching "MOT 1-11" or "003" still finds
the photo.

**To make a photo appear on the interactive map:** if you know roughly
where it was taken and it's one of these recognised village spots, put
it in a further subfolder named exactly that, inside the matching
category folder:

```
Streets & Buildings/
├── Melton Road/
├── St Michael's Church/
└── (loose photos — no exact spot known, that's completely fine)

Nature & Views/
├── Watermead Country Park/
├── River Soar/
└── (loose photos)

Events/
├── Elizabeth Park/
└── (loose photos)
```

Most old photos won't have a known exact spot, and that's the normal
case — just leave them loose in the category folder. Want a new place
added to the recognised list? Just ask — it takes a one-line change.

## 2. It publishes itself, automatically

A small script (`automation/drive-photo-sync.gs.js` in this repo) runs on
a 5-minute timer, independent of any chat session or person being online.
Every run, it:

1. Looks for any image in the category subfolders it hasn't seen before.
2. Resizes it down to a sensible web size (longest edge ~1600px), via
   a free image-resizing service — Apps Script can't resize images
   itself, so it hands the job off rather than publishing full-size
   originals.
3. Commits it into `images/photos/` in this repo.
4. Adds a matching entry to `data/photos.json` — category from the
   subfolder, caption auto-generated from the filename (with catalog
   numbers and MOT-style reference codes stripped out, see above),
   dated to when it was synced, plus coordinates if it was in a
   recognised place subfolder (see above).
5. Netlify redeploys automatically, and the photo appears on the
   homepage — searchable immediately, both in the photo archive's
   own search box and in the site-wide search, with a "View on map"
   link in its lightbox if it has a location, and a "View document"
   link if a matching PDF was found (see 2a, below).

No approval step in the middle — this is deliberately set up as a
single-trusted-uploader pipeline (see "Who can upload," below), so
anything dropped in goes live within a few minutes.

## 2a. Attaching a supporting document to a photo (optional)

Drop a PDF in the same folder as its photo, with the exact same
filename (just `.pdf` instead of `.jpg`):

```
Streets & Buildings/
├── Manor Hotel.jpg
└── Manor Hotel.pdf   <- linked to the photo above
```

The sync script matches them by filename (both produce the same slug),
publishes the PDF to `documents/` in this repo, and adds a `doc` field
to that photo's entry in `photos.json`. The site then shows a small
document-icon badge on the thumbnail and a "View document" link in the
lightbox. Matching is done against the live `photos.json`, not just
files from the same sync run, so the document can be added before or
after the photo, in any later run.

PDF only, deliberately — it's the one file type that can't be confused
with a photo, so the script never has to guess which is which. If two
different photos ever end up with the same name (unusual, but
possible over a long archive), the document links to whichever of them
is more recent.

## 2b. The homepage hero banner

Photos in the **Hero images** folder skip the whole category/map/document
pipeline — they go straight into `data/hero.json` and become the
rotating banner slides at the top of the homepage, replacing the
placeholder illustrations that are there until real photos exist.
Published to `images/hero-photos/`, resized a bit larger than regular
photos (2000px vs 1600px) since they're shown full-width. Any number
works; the banner just rotates through whatever's in the list. Name
them the same way as any other photo — the filename becomes the
caption in the corner of the slide.

## 2c. Adding a photo directly (skip Drive entirely)

Log into `/admin`, open the **Photos** collection, and click "New Photo."
Upload the image, then fill in what you know — caption, category, date,
credit, coordinates (paste straight from Google Maps, same as everywhere
else on the site — right-click the spot, click the coordinates that pop
up to copy, paste them in), location, history, a linked document, and a
story page. Save, and it's live within a minute or two, no Drive step
needed. Leave the "Internal" fields at the bottom alone — they fill
themselves in.

Good for a one-off (someone hands you a photo, a scan, something from a
different source than the family archive) — for a batch, or anything
that should also live in the Drive archive as a backup, Google Drive
(above) is still the easier way in.

## 3. Tidying up afterwards (optional, whenever)

The auto-generated caption is the filename with catalog numbers and MOT
codes stripped out — good enough to publish, but worth improving. To fix
a caption, date, credit, location, or history, or add/correct the Google
Maps coordinates, log into the admin at `/admin` and open the **Photos**
collection — find the photo by its caption, edit the field, save. No
need to touch any JSON file by hand. The `ref` field holds the untouched
original filename (shown as a small tag in the lightbox) — leave it as-is
unless it's wrong. The `consentNoted` field starts unticked for every
auto-synced photo; tick it once you've confirmed it's fine to have public
(see "Consent," below).

## Who can upload

This is set up for **a single trusted uploader** (currently: family
archive photos), not open public submission — that's why there's no
review gate before publishing. If that ever changes and multiple people
get upload access to the folder, it's worth adding a moderation step
back in before photos go live (ask, and I'll wire one up — e.g. holding
new syncs in a "pending" list until someone approves them).

## Consent

Old photos can show identifiable people or private property. The
uploader should have a rough sense of where a photo came from and
whether it's fine to be public. When in doubt, leave it out, or note
the uncertainty in the `credit` field so it's easy to spot later.

## One-time setup (already done once, here for reference)

Full instructions are in the comment block at the top of
`automation/drive-photo-sync.gs.js` — covers creating the Apps Script
project, the GitHub token it needs (scoped to just this repo, stored in
Apps Script's own settings, never in this repo or in chat), and wiring
up the 5-minute trigger.

## Why not commit full-resolution originals?

The sync script resizes before publishing, so the repo only ever holds
web-sized copies — full-resolution originals stay safe in Drive. This
keeps the site fast and stops the git repo from growing without bound
as the archive grows.
