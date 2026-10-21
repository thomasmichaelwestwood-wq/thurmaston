// The ONLY backend code in this entire project. Everything else on this
// site is a plain static page talking straight to GitHub's own API from
// the browser — no server, no database, nothing to maintain.
//
// This one function exists purely to work around a real, documented
// limitation: fetching the actual bytes of a photo picked via Google's
// Photos Picker API directly from browser JavaScript runs into Google's
// CORS restrictions on its content-serving domain. So instead of the
// browser downloading the photo itself, it asks this function to do that
// one fetch server-side (where CORS doesn't apply) and hand the bytes
// back. The browser already has a real, user-granted Google access
// token at this point (from admin/google-photos-picker.js) — this
// function holds no Google credentials of its own, stores nothing, and
// is not a general-purpose proxy: it only ever fetches a URL on Google's
// own photo-serving domain, and only with a token the browser supplies.
//
// Deliberately kept this narrow. If this ever needs to do more than
// "relay one authorized photo download," that's a sign it's grown
// beyond what it was built for.

var ALLOWED_HOST_SUFFIX = ".googleusercontent.com";

exports.handler = async function (event) {
  var corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  var payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Invalid request." }) };
  }

  var baseUrl = payload.baseUrl;
  var token = payload.token;

  if (!baseUrl || !token || typeof baseUrl !== "string" || typeof token !== "string") {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Missing baseUrl or token." }) };
  }

  var hostname;
  try {
    hostname = new URL(baseUrl).hostname;
  } catch (e) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Invalid baseUrl." }) };
  }
  if (hostname !== "googleusercontent.com" && hostname.slice(-ALLOWED_HOST_SUFFIX.length) !== ALLOWED_HOST_SUFFIX) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "baseUrl is not a recognised Google Photos address." }) };
  }

  try {
    var upstream = await fetch(baseUrl + "=d", {
      headers: { Authorization: "Bearer " + token }
    });

    if (!upstream.ok) {
      console.error("google-photos-download: upstream fetch failed", upstream.status, await upstream.text().catch(function () { return ""; }));
      return {
        statusCode: upstream.status === 401 || upstream.status === 403 ? 401 : 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Couldn't download that photo from Google." })
      };
    }

    var arrayBuffer = await upstream.arrayBuffer();
    var base64 = Buffer.from(arrayBuffer).toString("base64");
    var contentType = upstream.headers.get("content-type") || "image/jpeg";

    return {
      statusCode: 200,
      headers: Object.assign({ "Content-Type": "application/json" }, corsHeaders),
      body: JSON.stringify({ base64: base64, contentType: contentType })
    };
  } catch (e) {
    console.error("google-photos-download: unexpected error", e);
    return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: "Couldn't download that photo from Google." }) };
  }
};
