(function () {
  var rootSel = "[data-ltf-masonry]";
  var root = document.querySelector(rootSel);
  if (!root || root.getAttribute("data-ltf-masonry-init") === "1") return;
  root.setAttribute("data-ltf-masonry-init", "1");

  var MAX_HW = 1.35;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function capMedia(media) {
    if (!media) return;
    var img = media.querySelector("img.ltf-masonry-tile__img.is-a");
    if (!img) return;
    function apply() {
      if (!img.naturalWidth) return;
      var hw = img.naturalHeight / img.naturalWidth;
      if (hw > MAX_HW + 0.01) media.classList.add("is-cap");
      else media.classList.remove("is-cap");
    }
    if (img.complete) apply();
    else img.addEventListener("load", apply, { once: true });
  }

  root.querySelectorAll(".ltf-masonry-tile__media.is-a").forEach(capMedia);

  var tiles = root.querySelectorAll(".ltf-masonry-tile.is-a");
  if (reduced) {
    tiles.forEach(function (t) { t.classList.add("is-ltf-revealed"); });
  } else if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-ltf-revealed");
          io.unobserve(e.target);
        });
      },
      { root: null, rootMargin: "0px 0px -6% 0px", threshold: 0.08 }
    );
    tiles.forEach(function (t) { io.observe(t); });
  } else {
    tiles.forEach(function (t) { t.classList.add("is-ltf-revealed"); });
  }

  var videos = root.querySelectorAll("video.ltf-masonry-tile__video.is-a[data-ltf-video-lazy]");
  if (!videos.length) return;

  function loadVideo(v) {
    if (v.getAttribute("data-ltf-video-loaded") === "1") return;
    var src = v.getAttribute("data-src");
    if (!src) return;
    v.setAttribute("data-ltf-video-loaded", "1");
    v.src = src;
    v.load();
  }

  if ("IntersectionObserver" in window) {
    var vio = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          var v = e.target;
          if (e.isIntersecting) {
            loadVideo(v);
            v.play().catch(function () {});
          } else {
            v.pause();
          }
        });
      },
      { root: null, rootMargin: "120px 0px", threshold: 0.12 }
    );
    videos.forEach(function (v) {
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.autoplay = false;
      v.setAttribute("muted", "");
      v.setAttribute("loop", "");
      v.setAttribute("playsinline", "");
      vio.observe(v);
    });
  } else {
    videos.forEach(function (v) {
      loadVideo(v);
      v.muted = true;
      v.play().catch(function () {});
    });
  }
})();
