// Coming-soon holding page for index.html only — every other page on
// the site is untouched and still reachable directly to anyone with a
// link to it (a deliberate choice: this just keeps casual visitors who
// land on thurmaston.com from finding a half-finished front door before
// launch, not a real access-control system for the site as a whole).
//
// This is a client-side password check, not real security — anyone who
// opens this file (view-source, dev tools) can read the password below.
// That's a proportionate trade for "not ready to show off yet," not for
// anything actually sensitive — there's no private data behind it, just
// an unfinished homepage. To change the password, edit the line below;
// it takes effect for every visitor immediately, no redeploy needed
// beyond this one file.
var COMING_SOON_PASSWORD = "thurmaston2026";

// sessionStorage, not localStorage — remembers the unlock for as long
// as this browser tab/window stays open (reloading, clicking around,
// coming back to the tab later all skip the gate), but asks again once
// the tab's actually closed and reopened. Landed here after first
// trying "always ask" (too annoying to re-type constantly) and,
// earlier, "remember forever" (asked to turn off) — this is the
// middle ground that was actually wanted: not re-typed every reload,
// but not a permanent bypass sitting in the browser indefinitely either.
(function () {
  if (sessionStorage.getItem("thurmaston-unlocked") === "1") {
    document.documentElement.classList.add("unlocked");
  }
})();

document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("coming-soon-form");
  if (!form) return;
  var input = document.getElementById("coming-soon-password");
  var error = document.getElementById("coming-soon-error");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (input.value === COMING_SOON_PASSWORD) {
      sessionStorage.setItem("thurmaston-unlocked", "1");
      document.documentElement.classList.add("unlocked");
      error.hidden = true;
    } else {
      error.hidden = false;
      input.value = "";
      input.focus();
    }
  });
});
