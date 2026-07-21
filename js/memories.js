// Homepage "Shared memories" section (index.html only) — a small,
// hand-curated set of resident stories, admin-editable via the CMS
// (data/memories.json, same single-file "files:" collection shape as
// Village Chronology — small enough to load/edit as one whole list,
// no per-entry file + rebuild script needed).
document.addEventListener("DOMContentLoaded", function () {
  var gridEl = document.getElementById("shared-memories-grid");
  var emptyEl = document.getElementById("shared-memories-empty");
  if (!gridEl) return;

  fetch("data/memories.json")
    .then(function (res) { return res.ok ? res.json() : { entries: [] }; })
    .catch(function () { return { entries: [] }; })
    .then(function (data) {
      var entries = data.entries || [];
      if (entries.length === 0) {
        emptyEl.hidden = false;
        return;
      }
      gridEl.innerHTML = entries.map(renderCard).join("");
    });

  function renderCard(entry) {
    return (
      '<div class="card">' +
        (entry.meta ? '<div class="meta">' + escapeHtml(entry.meta) + "</div>" : "") +
        "<h3>" + escapeHtml(entry.title || "") + "</h3>" +
        formatMultilineText(entry.text || "") +
      "</div>"
    );
  }
});
