// The site's only backend code — an earlier Google Photos equivalent
// (netlify/functions/google-photos-download.js) was removed once that
// integration was abandoned; see CLAUDE.md and git history. This one
// relays a single authenticated
// Google Drive file download past the browser: Drive's own content
// endpoint doesn't reliably support a cross-origin fetch with a custom
// Authorization header from a plain static site with no backend, so
// this does that one fetch server-side instead, where it's a normal
// same-origin-style authenticated request.
//
// Holds no Google credentials of its own and stores nothing — the
// browser already has a real, user-granted Google access token (scoped
// to just the file they picked via the Drive Picker) and hands it here
// each time. Only ever fetches a Drive file by ID; nothing else.

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

  var fileId = payload.fileId;
  var token = payload.token;
  // Drive file IDs are alphanumeric plus "-" and "_" — this is just a
  // sanity check before building a URL from it, not real validation.
  if (!fileId || !token || typeof fileId !== "string" || typeof token !== "string" || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Missing or invalid fileId/token." }) };
  }

  try {
    var upstream = await fetch(
      "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(fileId) + "?alt=media",
      { headers: { Authorization: "Bearer " + token } }
    );

    if (!upstream.ok) {
      console.error("google-drive-download: upstream fetch failed", upstream.status, await upstream.text().catch(function () { return ""; }));
      return {
        statusCode: upstream.status === 401 || upstream.status === 403 ? 401 : 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Couldn't download that file from Google Drive." })
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
    console.error("google-drive-download: unexpected error", e);
    return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: "Couldn't download that file from Google Drive." }) };
  }
};
