// Pin-placement math and what3words lookup, extracted from the standalone
// admin/pin-grave.html tool so it can be embedded directly in the Cemetery
// screen's own add/edit form instead of living only in a separate page.
// Same proven affine (3-point) / similarity (2-point) transform.

// refPoints: array of { px, py, lat, lng } — only entries with all four
// set are usable. Returns { lat, lng } or null if there aren't enough
// usable reference points yet.
function cmsPixelToLatLng(refPoints, x, y) {
  var pts = (refPoints || []).filter(function (p) {
    return p && p.px != null && p.py != null && p.lat != null && p.lng != null && !isNaN(p.lat) && !isNaN(p.lng);
  });
  if (pts.length >= 3) return cmsAffineTransform(pts.slice(0, 3), x, y);
  if (pts.length === 2) return cmsSimilarityTransform(pts[0], pts[1], x, y);
  return null;
}

function cmsAffineTransform(pts, x, y) {
  var m = [[pts[0].px, pts[0].py, 1], [pts[1].px, pts[1].py, 1], [pts[2].px, pts[2].py, 1]];
  var lats = [pts[0].lat, pts[1].lat, pts[2].lat];
  var lngs = [pts[0].lng, pts[1].lng, pts[2].lng];
  var latCoeffs = cmsSolve3x3(m, lats);
  var lngCoeffs = cmsSolve3x3(m, lngs);
  if (!latCoeffs || !lngCoeffs) return null;
  return { lat: latCoeffs[0] * x + latCoeffs[1] * y + latCoeffs[2], lng: lngCoeffs[0] * x + lngCoeffs[1] * y + lngCoeffs[2] };
}

function cmsSolve3x3(m, b) {
  var det = cmsDet3(m);
  if (Math.abs(det) < 1e-12) return null;
  var mA = [[b[0], m[0][1], m[0][2]], [b[1], m[1][1], m[1][2]], [b[2], m[2][1], m[2][2]]];
  var mB = [[m[0][0], b[0], m[0][2]], [m[1][0], b[1], m[1][2]], [m[2][0], b[2], m[2][2]]];
  var mC = [[m[0][0], m[0][1], b[0]], [m[1][0], m[1][1], b[1]], [m[2][0], m[2][1], b[2]]];
  return [cmsDet3(mA) / det, cmsDet3(mB) / det, cmsDet3(mC) / det];
}

function cmsDet3(m) {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

function cmsSimilarityTransform(p1, p2, x, y) {
  var dpx = p2.px - p1.px, dpy = p2.py - p1.py;
  var dqx = p2.lat - p1.lat, dqy = p2.lng - p1.lng;
  var denom = dpx * dpx + dpy * dpy;
  if (denom < 1e-9) return null;
  var a = (dqx * dpx + dqy * dpy) / denom;
  var b = (dqy * dpx - dqx * dpy) / denom;
  var dx = x - p1.px, dy = y - p1.py;
  return { lat: a * dx - b * dy + p1.lat, lng: b * dx + a * dy + p1.lng };
}

// Never rejects — resolves to a plain words string on success, or
// { error: "..." } on failure, so callers can show it directly without
// a try/catch at every call site.
function cmsLookupWhat3Words(apiKey, lat, lng) {
  if (!apiKey) return Promise.resolve({ error: "No what3words key set up yet." });
  var url = "https://api.what3words.com/v3/convert-to-3wa?coordinates=" + lat + "," + lng + "&key=" + encodeURIComponent(apiKey) + "&format=json";
  return fetch(url).then(function (res) { return res.json(); }).then(function (data) {
    if (data && data.words) return data.words;
    return { error: (data && data.error && data.error.message) || "Lookup failed." };
  }).catch(function (e) {
    return { error: e.message || "Network error." };
  });
}
