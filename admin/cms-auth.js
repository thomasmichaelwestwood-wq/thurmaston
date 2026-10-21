// GitHub sign-in for the bespoke CMS — reuses the exact OAuth proxy
// Sveltia already authenticates against (Netlify's hosted GitHub OAuth
// endpoint at api.netlify.com), confirmed by reading @sveltia/cms's own
// source (npm pack, inspected locally). Needs zero new GitHub OAuth App
// registration — this is the same app already set up in this site's
// Netlify dashboard settings for Sveltia at /admin/.
var CMS_TOKEN_KEY = "thurmaston-cms-token";

function cmsSignIn() {
  return new Promise(function (resolve, reject) {
    var authUrl = "https://api.netlify.com/auth?" + new URLSearchParams({
      provider: "github", site_id: location.hostname, scope: "repo"
    });
    var left = Math.max(0, window.screen.availWidth / 2 - 300);
    var top = Math.max(0, window.screen.availHeight / 2 - 400);
    var popup = window.open(authUrl, "thurmaston-cms-auth", "width=600,height=800,top=" + top + ",left=" + left);
    if (!popup) { reject(new Error("Couldn't open the sign-in window — check your browser isn't blocking pop-ups for this site.")); return; }
    var done = false;
    function finish(err, token) {
      if (done) return; done = true;
      clearInterval(closedCheck); window.removeEventListener("message", onMessage);
      if (!popup.closed) popup.close();
      if (err) reject(err); else resolve(token);
    }
    function onMessage(event) {
      if (event.source !== popup || event.origin !== "https://api.netlify.com") return;
      if (typeof event.data !== "string") return;
      if (event.data === "authorizing:github") { popup.postMessage(event.data, event.origin); return; }
      var match = event.data.match(/^authorization:github:(success|error):(.+)$/);
      if (!match) return;
      var result;
      try { result = JSON.parse(match[2]); } catch (e) { result = {}; }
      if (match[1] === "success" && result.token) { finish(null, result.token); }
      else { finish(new Error(result.error || "Sign-in didn't complete. Please try again.")); }
    }
    window.addEventListener("message", onMessage);
    var closedCheck = setInterval(function () { if (popup.closed) finish(new Error("Sign-in was cancelled.")); }, 500);
  });
}
function cmsGetToken() { try { return localStorage.getItem(CMS_TOKEN_KEY); } catch (e) { return null; } }
function cmsSetToken(token) { try { localStorage.setItem(CMS_TOKEN_KEY, token); } catch (e) {} }
function cmsSignOut() { try { localStorage.removeItem(CMS_TOKEN_KEY); } catch (e) {} location.href = "index.html"; }
function cmsRequireAuth() {
  var token = cmsGetToken();
  if (!token) { location.href = "index.html"; return null; }
  return token;
}
