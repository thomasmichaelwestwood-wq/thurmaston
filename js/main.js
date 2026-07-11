document.addEventListener("DOMContentLoaded", function () {
  initNavToggle();
  initHero();
  initSearch();
});

function initNavToggle() {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".main-nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
}

function initHero() {
  var hero = document.querySelector("[data-hero]");
  if (!hero) return;

  fetch("data/hero.json")
    .then(function (res) { return res.ok ? res.json() : []; })
    .catch(function () { return []; })
    .then(function (heroPhotos) {
      // Real synced photos replace the placeholder illustrations
      // outright, once there are any — otherwise the illustrations
      // already in the page stay as the fallback.
      if (heroPhotos && heroPhotos.length > 0) {
        Array.prototype.forEach.call(hero.querySelectorAll(".hero-slide"), function (el) { el.remove(); });
        var contentEl = hero.querySelector(".hero-content");
        heroPhotos.forEach(function (photo, i) {
          var slide = document.createElement("div");
          slide.className = "hero-slide" + (i === 0 ? " active" : "");
          slide.style.backgroundImage = "url('" + photo.src + "')";
          if (photo.caption) {
            var caption = document.createElement("span");
            caption.className = "hero-slide-caption";
            caption.textContent = photo.caption;
            slide.appendChild(caption);
          }
          hero.insertBefore(slide, contentEl);
        });
      }
      startSlideshow();
    });

  function startSlideshow() {
    var slides = Array.prototype.slice.call(hero.querySelectorAll(".hero-slide"));
    var dotsWrap = hero.querySelector(".hero-dots");
    if (slides.length < 2) return;

    var current = 0;
    var timer;

    slides.forEach(function (slide, i) {
      if (dotsWrap) {
        var dot = document.createElement("button");
        dot.className = "hero-dot" + (i === 0 ? " active" : "");
        dot.setAttribute("aria-label", "Show slide " + (i + 1) + " of " + slides.length);
        dot.addEventListener("click", function () {
          goTo(i);
          restart();
        });
        dotsWrap.appendChild(dot);
      }
    });

    var dots = dotsWrap ? Array.prototype.slice.call(dotsWrap.children) : [];

    function goTo(index) {
      slides[current].classList.remove("active");
      if (dots[current]) dots[current].classList.remove("active");
      current = index;
      slides[current].classList.add("active");
      if (dots[current]) dots[current].classList.add("active");
    }

    function next() {
      goTo((current + 1) % slides.length);
    }

    function restart() {
      clearInterval(timer);
      timer = setInterval(next, 6000);
    }

    restart();

    hero.addEventListener("mouseenter", function () { clearInterval(timer); });
    hero.addEventListener("mouseleave", restart);
  }
}

function initSearch() {
  var openBtns = document.querySelectorAll("[data-search-open]");
  var overlay = document.querySelector(".search-overlay");
  if (!overlay) return;
  var closeBtn = overlay.querySelector(".search-close");
  var input = overlay.querySelector("#site-search-input");
  var resultsList = overlay.querySelector("#site-search-results");

  openBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      overlay.classList.add("open");
      input.value = "";
      renderResults("");
      setTimeout(function () { input.focus(); }, 30);
    });
  });

  closeBtn.addEventListener("click", closeOverlay);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeOverlay();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.classList.contains("open")) closeOverlay();
  });

  function closeOverlay() {
    overlay.classList.remove("open");
  }

  input.addEventListener("input", function () {
    renderResults(input.value.trim());
  });

  var photoSearchEntries = [];
  if (typeof PHOTOS_DATA_PROMISE !== "undefined") {
    PHOTOS_DATA_PROMISE.then(function (photos) {
      photoSearchEntries = photos.map(function (p) {
        return {
          title: p.caption,
          url: "memories.html#photo-" + p.id,
          category: "Photo",
          excerpt: [p.date, p.credit !== "—" ? "Credit: " + p.credit : null].filter(Boolean).join(" · ")
        };
      });
      if (input.value.trim()) renderResults(input.value.trim());
    });
  }

  function renderResults(query) {
    resultsList.innerHTML = "";
    var index = (typeof SITE_SEARCH_INDEX !== "undefined") ? SITE_SEARCH_INDEX.concat(photoSearchEntries) : photoSearchEntries;

    if (!query) {
      var hint = document.createElement("li");
      hint.className = "search-hint";
      hint.textContent = "Search the village website — try “parish council”, “library” or “events”.";
      resultsList.appendChild(hint);
      return;
    }

    var q = query.toLowerCase();
    var matches = index.filter(function (item) {
      return (
        item.title.toLowerCase().indexOf(q) !== -1 ||
        item.excerpt.toLowerCase().indexOf(q) !== -1 ||
        item.category.toLowerCase().indexOf(q) !== -1
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
      a.innerHTML =
        '<span class="result-title">' + escapeHtml(item.title) +
        '<span class="result-cat">' + escapeHtml(item.category) + "</span></span>" +
        '<div class="result-excerpt">' + escapeHtml(item.excerpt) + "</div>";
      li.appendChild(a);
      resultsList.appendChild(li);
    });
  }
}

function escapeHtml(str) {
  var div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
