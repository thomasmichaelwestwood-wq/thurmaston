# Photo workflow

How photos get from Drive to the live site — fully automated, one-time setup.

## 1. Drop photos into Google Drive

Inside the shared **"Memories of Thurmaston Photos"** folder, there are
four subfolders:

```
Memories of Thurmaston Photos/
├── Streets & Buildings/
├── People & Events/
├── Nature & Views/
└── Other/
```

That's the entire interface: drag a photo into whichever folder matches
what it shows. No renaming, no app, nothing else to learn. A photo dropped
loose in the top-level folder (not in a subfolder) is filed under "Other."

## 2. It publishes itself, automatically

A small script (`automation/drive-photo-sync.gs.js` in this repo) runs on
an hourly timer, independent of any chat session or person being online.
Every run, it:

1. Looks for any image in the four subfolders it hasn't seen before.
2. Resizes it down to a sensible web size (longest edge ~1600px), via
   a free image-resizing service — Apps Script can't resize images
   itself, so it hands the job off rather than publishing full-size
   originals.
3. Commits it into `images/photos/` in this repo.
4. Adds a matching entry to `data/photos.json` — category from the
   subfolder, caption auto-generated from the filename, dated to when
   it was synced.
5. Netlify redeploys automatically, and the photo appears on the
   Memories page — searchable immediately, both in the photo archive's
   own search box and in the site-wide search.

No approval step in the middle — this is deliberately set up as a
single-trusted-uploader pipeline (see "Who can upload," below), so
anything dropped in goes live within the hour.

## 3. Tidying up afterwards (optional, whenever)

The auto-generated caption is just the filename, cleaned up — good
enough to publish, but worth improving. To fix a caption, date, or
credit, open `data/photos.json` and edit that photo's entry directly —
it's a plain JSON file, safe to hand-edit alongside the automated
writes. The `consentNoted` field starts `false` for every auto-synced
photo; flip it to `true` once you've confirmed it's fine to have public
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
up the hourly trigger.

## Why not commit full-resolution originals?

The sync script resizes before publishing, so the repo only ever holds
web-sized copies — full-resolution originals stay safe in Drive. This
keeps the site fast and stops the git repo from growing without bound
as the archive grows.
