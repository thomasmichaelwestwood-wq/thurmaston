document.addEventListener("DOMContentLoaded", function () {
  initNavToggle();
  initHero();
  initSearch();
  initHeroChronology();
});

// Fetched once, shared by initSearch() (every entry becomes a search
// result) and initHeroChronology() (the homepage's "notable years"
// chips) — same idea as js/photos.js's PHOTOS_DATA_PROMISE, a single
// promise other functions in this file can await without each
// triggering their own separate fetch of the same file. Resolves to
// { year, text, sortYear } per entry — sortYear via the shared
// extractYear() (declared further down this file; safe to call from
// here since the .then() callback only actually runs once the fetch
// resolves, long after the whole script has finished loading).
var CHRONOLOGY_DATA_PROMISE = fetch("data/chronology.json")
  .then(function (res) { return res.ok ? res.json() : { entries: [] }; })
  .catch(function () { return { entries: [] }; })
  .then(function (data) {
    return (data.entries || []).map(function (e) {
      return { year: e.year || "", text: e.text || "", sortYear: extractYear(e.year) };
    });
  });

// Same shared-promise idea as CHRONOLOGY_DATA_PROMISE above — fetched
// once, consumed by initSearch() (below) and by js/cemetery.js's own
// directory listing, rather than each fetching data/cemetery.json
// separately. Already a flat array of { name, number, dates,
// whatThreeWords, inscription, notes, photo, id }, built by
// scripts/rebuild-cemetery-index.js, so no extra parsing needed here.
var CEMETERY_DATA_PROMISE = fetch("data/cemetery.json")
  .then(function (res) { return res.ok ? res.json() : []; })
  .catch(function () { return []; });

// A bulk import of Thurmaston cemetery's historical burial register
// (2,710 entries as of the spreadsheet this was built from —
// scripts/import-burial-records.js) — deliberately not a CMS
// collection or a browsable directory page of its own ("this file
// doesn't need to appear on the website, however i want it embedding
// in the search"), just searchable by name like everything else, each
// landing on its own burial-record.html?id=N page. Same shared-promise
// pattern as CEMETERY_DATA_PROMISE above — fetched once, consumed by
// initSearch() (below) and by js/burial-record.js's own per-record page.
var BURIAL_RECORDS_DATA_PROMISE = fetch("data/burial-records.json")
  .then(function (res) { return res.ok ? res.json() : []; })
  .catch(function () { return []; });

function initNavToggle() {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".main-nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
}

// Single static hero photo, no rotation — the emphasis is on getting to
// the photo archive fast, not a slideshow to watch first.
function initHero() {
  var hero = document.querySelector("[data-hero]");
  if (!hero) return;

  fetch("data/hero.json")
    .then(function (res) { return res.ok ? res.json() : []; })
    .catch(function () { return []; })
    .then(function (heroPhotos) {
      // The first real synced photo replaces the placeholder
      // illustration once there is one — otherwise the illustration
      // already in the page stays as the fallback.
      if (heroPhotos && heroPhotos.length > 0) {
        var slide = hero.querySelector(".hero-slide");
        // JSON.stringify, not "'" + src + "'" — see js/photos.js's
        // setCategoryTileImages for why a plain single-quoted string
        // silently breaks (and silently no-ops, no console error) for
        // any filename containing an apostrophe.
        if (slide) slide.style.backgroundImage = "url(" + JSON.stringify(heroPhotos[0].src) + ")";
      }
    });
}

// The homepage hero's Village Chronology card shows a handful of
// clickable "notable year" chips, not the chronology's full entry text
// or its whole era browser — CLAUDE.md already documents that a full
// chronology-on-the-homepage layout was considered and rejected once,
// since this site was deliberately redesigned to stay photo-archive-
// first rather than stacking several competing attractions on the
// front page; showing full prose here would quietly reintroduce that,
// just relocated into the hero. Chips are the middle ground: glanceable,
// interactive, and reuse the exact year.html?year=X deep link (js/year.js)
// already built.
//
// Sampled by even index spacing across the sorted list (not a
// hand-picked "featured" set) so it always spans earliest-to-most-
// recent with no new field needed in the data or the CMS. No-ops
// silently if the fetch is slow or fails — the card's own copy and CTA
// button are static HTML, so the only thing ever missing is the chips.
function initHeroChronology() {
  var listEl = document.getElementById("hero-chronology-years");
  if (!listEl) return;

  CHRONOLOGY_DATA_PROMISE.then(function (entries) {
    var dated = entries.filter(function (e) { return e.sortYear !== null; });
    if (dated.length === 0) return;
    dated.sort(function (a, b) { return a.sortYear - b.sortYear; });

    var count = Math.min(4, dated.length);
    var picks = [];
    for (var i = 0; i < count; i++) {
      var idx = count === 1 ? 0 : Math.round((i * (dated.length - 1)) / (count - 1));
      picks.push(dated[idx]);
    }
    // A short list can round two sample points to the same index —
    // drop the repeat rather than showing the same year chip twice.
    var seenYears = {};
    picks = picks.filter(function (e) {
      if (seenYears[e.sortYear]) return false;
      seenYears[e.sortYear] = true;
      return true;
    });

    listEl.innerHTML = picks.map(function (e) {
      return '<li><a class="chip" href="year.html?year=' + encodeURIComponent(e.sortYear) + '">' + escapeHtml(e.year) + "</a></li>";
    }).join("");
  });
}

// Two search boxes can exist on one page now — the header's icon-
// triggered overlay (every page) and, on the homepage only, a second
// one sitting right under the hero (#home-search-input/-results). Both
// search the same combined index (SITE_SEARCH_INDEX + every photo +
// every chronology entry), so the index and the matching/rendering
// logic are built once here and shared, rather than duplicated per box.
function initSearch() {
  // Photos and chronology entries load independently (two unrelated
  // fetches) — each is kept in its own array and the combined index is
  // rebuilt from all three every time either one resolves, rather than
  // each callback rebuilding "static + its own results" from scratch,
  // which would let whichever fetch finishes last silently wipe out the
  // other's entries.
  var photoEntries = [];
  var chronologyEntries = [];
  var cemeteryEntries = [];
  var burialEntries = [];
  var boxes = [];
  var searchIndex = (typeof SITE_SEARCH_INDEX !== "undefined") ? SITE_SEARCH_INDEX.slice() : [];

  function rebuildIndex() {
    searchIndex = (typeof SITE_SEARCH_INDEX !== "undefined" ? SITE_SEARCH_INDEX : []).concat(photoEntries, chronologyEntries, cemeteryEntries, burialEntries);
    boxes.forEach(function (box) { box.refresh(); });
  }

  if (typeof PHOTOS_DATA_PROMISE !== "undefined") {
    PHOTOS_DATA_PROMISE.then(function (photos) {
      photoEntries = photos.map(function (p) {
        return {
          title: p.caption,
          url: "place.html?photo=" + encodeURIComponent(p.id),
          category: "Photo",
          excerpt: [p.date, p.location, p.credit && p.credit !== "—" ? "Credit: " + p.credit : null].filter(Boolean).join(" · "),
          // Matched against, but never shown — a photo's location
          // ("Garden Street"), Dad's original filing reference, and
          // any written History are all things a visitor might type
          // that don't otherwise appear in the caption/date/credit
          // shown as the title/excerpt above, so search would silently
          // miss a real match (e.g. "garden" finding the caption
          // "Garden Centre" but not a different photo whose only
          // mention of "Garden" is its Location field).
          keywords: [p.location, p.ref, p.history].filter(Boolean).join(" ")
        };
      });
      rebuildIndex();
    });
  }

  // Every Village Chronology entry, individually — not just the one
  // static "Village Chronology" page link SITE_SEARCH_INDEX already
  // has — so typing a year ("1945") or a keyword ("Domesday") finds the
  // specific entry, not just the page it lives on. Links straight to
  // year.html?year=X (js/year.js — everything from that year, not just
  // this one entry) when the entry's Year has a real number to link
  // with; falls back to the plain chronology page otherwise.
  CHRONOLOGY_DATA_PROMISE.then(function (entries) {
    chronologyEntries = entries.map(function (e) {
      return {
        title: e.year || "Village Chronology",
        url: e.sortYear ? "year.html?year=" + encodeURIComponent(e.sortYear) : "chronology.html",
        category: "Chronology",
        excerpt: e.text
      };
    });
    rebuildIndex();
  });

  // Every grave, individually, by name — this is the actual point of
  // the Cemetery feature: type a name in any search box on the site and
  // land straight on that grave's own page (number + what3words
  // location), not just a static "Cemetery" page link.
  CEMETERY_DATA_PROMISE.then(function (graves) {
    cemeteryEntries = graves.map(function (g) {
      return {
        title: g.name,
        url: "grave.html?grave=" + encodeURIComponent(g.id),
        category: "Cemetery",
        excerpt: [g.number ? "Grave " + g.number : null, g.dates].filter(Boolean).join(" · "),
        keywords: [g.inscription, g.notes].filter(Boolean).join(" ")
      };
    });
    rebuildIndex();
  });

  // Every burial register entry, individually, by name — same "type a
  // name, land on its own page" point as the Cemetery entries above,
  // just a much larger bulk-imported set (see BURIAL_RECORDS_DATA_PROMISE)
  // rather than individually curated headstones.
  BURIAL_RECORDS_DATA_PROMISE.then(function (records) {
    burialEntries = records.map(function (r) {
      return {
        title: r.name,
        url: "burial-record.html?id=" + encodeURIComponent(r.id),
        category: "Burial Record",
        excerpt: [r.graveNo ? "Grave " + r.graveNo : null, [r.burialDate, r.year].filter(Boolean).join(" ")].filter(Boolean).join(" · "),
        keywords: r.note || ""
      };
    });
    rebuildIndex();
  });

  function renderResultsInto(resultsList, query, emptyHint) {
    resultsList.innerHTML = "";

    if (!query) {
      if (!emptyHint) return;
      var hint = document.createElement("li");
      hint.className = "search-hint";
      hint.textContent = emptyHint;
      resultsList.appendChild(hint);
      return;
    }

    var q = query.toLowerCase();
    var matches = searchIndex.filter(function (item) {
      return (
        item.title.toLowerCase().indexOf(q) !== -1 ||
        item.excerpt.toLowerCase().indexOf(q) !== -1 ||
        item.category.toLowerCase().indexOf(q) !== -1 ||
        (item.keywords && item.keywords.toLowerCase().indexOf(q) !== -1)
      );
    });

    if (matches.length === 0) {
      var empty = document.createElement("li");
      empty.className = "search-empty";
      empty.textContent = "No results for “" + query + "”. Try a different word, or visit the Contact page to ask us directly.";
      resultsList.appendChild(empty);
      return;
    }

    matches.slice(0, 20).forEach(function (item) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = item.url;
      // An absolute URL means this result leaves the site entirely
      // (e.g. the Facebook group) — open those in a new tab, same
      // convention already used for every hand-written Facebook link
      // elsewhere on the site, rather than navigating the visitor away
      // from the search they were just doing.
      if (/^https?:\/\//i.test(item.url)) {
        a.target = "_blank";
        a.rel = "noopener";
      }
      a.innerHTML =
        '<span class="result-title">' + escapeHtml(item.title) +
        '<span class="result-cat">' + escapeHtml(item.category) + "</span></span>" +
        '<div class="result-excerpt">' + escapeHtml(item.excerpt) + "</div>";
      li.appendChild(a);
      resultsList.appendChild(li);
    });
  }

  // Wires one input+results pair up to the shared index, and returns a
  // handle with .refresh() so callers (the overlay's open button) can
  // force a re-render — e.g. after the index gains its photo entries,
  // or when the overlay opens with whatever query was left in it.
  function wireSearchBox(input, resultsList, emptyHint) {
    if (!input || !resultsList) return null;
    var box = { refresh: function () { renderResultsInto(resultsList, input.value.trim(), emptyHint); } };
    boxes.push(box);
    input.addEventListener("input", box.refresh);
    return box;
  }

  var overlay = document.querySelector(".search-overlay");
  if (overlay) {
    var openBtns = document.querySelectorAll("[data-search-open]");
    var closeBtn = overlay.querySelector(".search-close");
    var overlayInput = overlay.querySelector("#site-search-input");
    var overlayBox = wireSearchBox(
      overlayInput,
      overlay.querySelector("#site-search-results"),
      "Search the village website — try “parish council”, “library” or “events”."
    );

    openBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        overlay.classList.add("open");
        overlayInput.value = "";
        if (overlayBox) overlayBox.refresh();
        setTimeout(function () { overlayInput.focus(); }, 30);
      });
    });

    closeBtn.addEventListener("click", closeOverlay);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeOverlay();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay.classList.contains("open")) closeOverlay();
    });
  }

  function closeOverlay() {
    overlay.classList.remove("open");
  }

  // The homepage's own search box, floating inside the hero's main
  // card — present only on index.html, so this is a no-op
  // (wireSearchBox bails on missing elements) everywhere else.
  var homeSearchInput = document.getElementById("home-search-input");
  var homeSearchResults = document.getElementById("home-search-results");
  var homeSearchBox = wireSearchBox(homeSearchInput, homeSearchResults, null);

  // Now that the dropdown floats over the "Photo archive" section
  // below it (css/style.css removed .hero's overflow:hidden so it's
  // no longer clipped there), it needs its own way to get out of the
  // way again — clicking elsewhere on the page or pressing Escape
  // hides it without clearing what was typed, and refocusing the
  // input (e.g. tabbing back to it) brings the same results straight
  // back rather than making someone retype the query.
  if (homeSearchBox && homeSearchInput && homeSearchResults) {
    homeSearchInput.addEventListener("focus", function () {
      homeSearchResults.hidden = false;
    });
    document.addEventListener("click", function (e) {
      if (!homeSearchInput.contains(e.target) && !homeSearchResults.contains(e.target)) {
        homeSearchResults.hidden = true;
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.activeElement === homeSearchInput) {
        homeSearchResults.hidden = true;
        homeSearchInput.blur();
      }
    });
  }

  // category.html's "Looking for something specific?" box — present
  // only there. Used to run its own separate filter over just that
  // page's photo grid (js/photos.js), which visitors reported as not
  // working; replaced with the exact same shared dropdown mechanism as
  // the two search boxes above, already known to work correctly,
  // rather than continuing to debug the bespoke version.
  wireSearchBox(
    document.getElementById("photo-search-input"),
    document.getElementById("photo-search-results"),
    null
  );

  // cemetery.html's own "Search for a name" box — present only there.
  // Uses the same shared, whole-site index as every other search box
  // (so a name also surfaces any matching photos/events), which is a
  // feature, not noise — see category.html's box above for the same
  // reasoning already established.
  wireSearchBox(
    document.getElementById("cemetery-search-input"),
    document.getElementById("cemetery-search-results"),
    null
  );
}

function escapeHtml(str) {
  var div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Turns a free-text field into a stable, URL-safe slug — used for a
// photo's Event name ("Remembrance Day Parade" -> event.html's
// ?event= param). Purely computed at read time from the text itself —
// no separate id stored anywhere — so two photos with the same text
// automatically resolve to the same slug/page with no extra admin
// step (see CLAUDE.md). Location grouping used to use this too; see
// placeKey below for why that changed.
function slugifyText(text) {
  return (text || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// A photo's "place identity" for grouping — used by js/place.js's
// location banner/"More photos from…" grid and js/location.js's
// timeline page, so all three can never disagree about which photos
// belong together. Three tiers, in priority order:
//  1. Manual override (placeId, the admin's "Internal — manual place
//     grouping" field) — for the case coordinates+text genuinely can't
//     bridge on their own: an old photo of a building on a street that
//     was later renamed (a real example: Melton Road used to be Main
//     Street), where nobody's pinpointed the old photo's exact
//     coordinates and its Location text was written using the old
//     street name, so it would never automatically match a modern
//     photo of the same building. Two photos with the same placeId
//     always group together, no matter what their coordinates/Location
//     say.
//  2. GPS coordinates (pasted from Google Maps) — two photos of the
//     same physical spot almost always share identical coordinates,
//     even when their Location text varies in wording (a real example:
//     three Harrow Inn photos all share one exact coordinate, but one
//     read "The Harrow Inn, Melton Road, Thurmaston" while the other
//     two read "The Harrow Inn, Melton Road" — no ", Thurmaston" — an
//     exact-text match silently left that one out of the group).
//     Rounded to 5 decimal places (~1m of precision) rather than
//     compared as raw strings, so two coordinates pasted at slightly
//     different precision still match.
//  3. Location text — only when a photo has neither of the above.
function placeKey(photo) {
  if (typeof photo.placeId === "string" && photo.placeId.trim()) {
    return "manual:" + slugifyText(photo.placeId);
  }
  if (typeof photo.lat === "number" && typeof photo.lng === "number") {
    return "geo:" + photo.lat.toFixed(5) + "," + photo.lng.toFixed(5);
  }
  if (typeof photo.location === "string" && photo.location.trim()) {
    return "loc:" + slugifyText(photo.location);
  }
  return null;
}

// "Added <Month> <Year>" is the auto-filled placeholder used everywhere
// on this site for a photo whose real date isn't known (see
// automation/drive-photo-sync.gs.js and the Photos admin form's own
// hint text for that field) — it's the date it was *uploaded*, not
// anything about when the photo was actually taken, so it must never
// be read as a real year here. Anything else with a plain 4-digit
// number in it ("1913", "c.1936", "2002") is treated as a genuine
// year. Shared by js/location.js, js/events.js and js/event.js so a
// photo's year can never be read differently depending which page
// happens to be looking at it.
function extractYear(dateStr) {
  if (!dateStr || /^added\b/i.test(dateStr.trim())) return null;
  var m = dateStr.match(/\d{4}/);
  return m ? parseInt(m[0], 10) : null;
}

// A History field can be several paragraphs, separated by plain "\n"
// line breaks in the stored text (that's just how they get typed into
// the admin's textarea) — rendered as one escapeHtml()'d string inside
// a single <p>, HTML collapses all of that into one run-on line with
// no visible break at all. Splits on blank lines into one <p> per
// paragraph instead (each line individually escaped first, so no
// unescaped text ever reaches innerHTML).
function formatMultilineText(str) {
  return (str || "")
    .split(/\n+/)
    .map(function (line) { return line.trim(); })
    .filter(Boolean)
    .map(function (line) { return "<p>" + escapeHtml(line) + "</p>"; })
    .join("");
}
