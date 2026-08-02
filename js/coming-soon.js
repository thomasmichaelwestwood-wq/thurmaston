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

// Deliberately doesn't remember an unlock across visits right now
// (requested explicitly: "I want the coming soon to appear every time
// for now") — a correct password only reveals the real homepage for
// the current page view; reloading or coming back later always shows
// the gate again. Was previously remembered via localStorage; if that's
// wanted back later, re-add a localStorage.getItem/.setItem pair around
// the "unlocked" class below.

document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("coming-soon-form");
  if (!form) return;
  var input = document.getElementById("coming-soon-password");
  var error = document.getElementById("coming-soon-error");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (input.value === COMING_SOON_PASSWORD) {
      document.documentElement.classList.add("unlocked");
      error.hidden = true;
    } else {
      error.hidden = false;
      input.value = "";
      input.focus();
    }
  });
});
