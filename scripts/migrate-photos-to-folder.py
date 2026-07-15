#!/usr/bin/env python3
"""
One-time migration: splits the bare-array data/photos.json into one file
per photo under data/photos/<id>.json (the new CMS-editable source of
truth), and regenerates data/photos.json as the aggregate the site
actually reads — same bare-array shape as before, so no front-end code
needs to change.

Assigns a synthetic "addedAt" ISO timestamp to each photo, spaced a
minute apart, preserving the current newest-first order exactly. Going
forward, the sync script sets a real addedAt on every new photo, and the
GitHub Actions rebuild step sorts by it.

Run once, from the repo root: python3 scripts/migrate-photos-to-folder.py
"""
import json
import os
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS_JSON = os.path.join(ROOT, "data", "photos.json")
PHOTOS_DIR = os.path.join(ROOT, "data", "photos")

FIELD_ORDER = [
    "id", "src", "caption", "ref", "category", "date", "credit",
    "consentNoted", "location", "history", "doc", "pageSlug",
    "lat", "lng", "addedAt",
]


def ordered(entry):
    out = {}
    for key in FIELD_ORDER:
        if key in entry:
            out[key] = entry[key]
    for key in entry:
        if key not in out:
            out[key] = entry[key]
    return out


def main():
    with open(PHOTOS_JSON) as f:
        photos = json.load(f)

    os.makedirs(PHOTOS_DIR, exist_ok=True)

    now = datetime.now(timezone.utc)
    for i, photo in enumerate(photos):
        added_at = (now - timedelta(minutes=i)).strftime("%Y-%m-%dT%H:%M:%SZ")
        photo["addedAt"] = added_at
        entry = ordered(photo)
        path = os.path.join(PHOTOS_DIR, photo["id"] + ".json")
        with open(path, "w") as f:
            json.dump(entry, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print("wrote", path)

    # Regenerate the aggregate the same way the CI rebuild step will,
    # so the repo demonstrates the full round-trip before that workflow
    # exists.
    rebuilt = sorted(photos, key=lambda p: p["addedAt"], reverse=True)
    rebuilt = [ordered(p) for p in rebuilt]
    with open(PHOTOS_JSON, "w") as f:
        json.dump(rebuilt, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("rewrote", PHOTOS_JSON, "with", len(rebuilt), "entries")


if __name__ == "__main__":
    main()
