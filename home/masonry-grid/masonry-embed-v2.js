(function () {
  var root = document.querySelector("[data-ltf-masonry-v2]");
  if (!root || root.getAttribute("data-ltf-masonry-v2-init") === "1") return;
  root.setAttribute("data-ltf-masonry-v2-init", "1");

  var MAX_HW = 1.25;
  var HEIGHT_SHRINK = 0.9;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var viewport = root.querySelector(".ltf-masonry-viewport.is-a");
  var columnsEl = root.querySelector(".ltf-masonry-columns.is-a");
  var source = root.querySelector(".ltf-masonry-source.is-a");
  if (!viewport || !columnsEl) return;

  var staggerPattern = [0, 0.14, 0.06, 0.2, 0.1, 0.16, 0.08];
  var rebuildTimer = null;
  var visibilityPaused = false;
  var ioPaused = false;

  function columnCount(w) {
    if (w >= 1100) return 5;
    if (w >= 820) return 4;
    if (w >= 520) return 3;
    return 2;
  }

  function readGapPx() {
    var g = getComputedStyle(root).getPropertyValue("--ltf-masonry-gap").trim();
    if (!g) return 14;
    if (g.indexOf("px") !== -1) return parseFloat(g) || 14;
    var probe = document.createElement("div");
    probe.style.width = g;
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    root.appendChild(probe);
    var px = probe.getBoundingClientRect().width;
    root.removeChild(probe);
    return px || 14;
  }

  function capMedia(media) {
    if (!media) return;
    var img = media.querySelector("img.ltf-masonry-tile__img.is-a");
    if (!img) return;
    function apply() {
      if (!img.naturalWidth) return;
      var hw = (img.naturalHeight / img.naturalWidth) * HEIGHT_SHRINK;
      if (hw > MAX_HW + 0.01) media.classList.add("is-cap");
      else media.classList.remove("is-cap");
    }
    if (img.complete) apply();
    else img.addEventListener("load", apply, { once: true });
  }

  function cloneTile(node) {
    var clone = node.cloneNode(true);
    clone.classList.add("is-ltf-clone");
    return clone;
  }

  function collectSourceTiles() {
    if (!source) return [];
    return Array.prototype.slice.call(
      source.querySelectorAll(":scope > .ltf-masonry-tile.is-a")
    );
  }

  function clearColumns() {
    columnsEl.innerHTML = "";
  }

  function buildColumnsFromTiles(tiles, cols) {
    clearColumns();
    var buckets = [];
    var i;
    for (i = 0; i < cols; i++) buckets[i] = [];

    tiles.forEach(function (tile, idx) {
      buckets[idx % cols].push(tile);
    });

    for (i = 0; i < cols; i++) {
      var col = document.createElement("div");
      col.className = "ltf-masonry-column is-a";
      col.setAttribute("data-ltf-masonry-col-idx", String(i));
      var vh = viewport.clientHeight || 600;
      var stagger = staggerPattern[i % staggerPattern.length] * vh;
      col.style.setProperty("--ltf-col-stagger", stagger.toFixed(1) + "px");

      var track = document.createElement("div");
      track.className = "ltf-masonry-column__track is-a";
      if (!reduced) {
        track.classList.add(i % 2 === 0 ? "is-ltf-scroll-up" : "is-ltf-scroll-down");
      }

      buckets[i].forEach(function (tile) {
        var t = cloneTile(tile);
        track.appendChild(t);
        capMedia(t.querySelector(".ltf-masonry-tile__media.is-a"));
      });

      if (!reduced && track.children.length) {
        var clones = Array.prototype.slice.call(track.children);
        clones.forEach(function (child) {
          track.appendChild(cloneTile(child));
        });
      }

      col.appendChild(track);
      columnsEl.appendChild(col);
    }
  }

  function usePrebuiltColumns() {
    var cols = columnsEl.querySelectorAll(":scope > .ltf-masonry-column.is-a");
    if (!cols.length) return false;
    cols.forEach(function (col, i) {
      var track = col.querySelector(".ltf-masonry-column__track.is-a");
      if (!track) return;
      col.setAttribute("data-ltf-masonry-col-idx", String(i));
      var vh = viewport.clientHeight || 600;
      col.style.setProperty(
        "--ltf-col-stagger",
        (staggerPattern[i % staggerPattern.length] * vh).toFixed(1) + "px"
      );
      if (!reduced) {
        track.classList.remove("is-ltf-scroll-up", "is-ltf-scroll-down");
        track.classList.add(i % 2 === 0 ? "is-ltf-scroll-up" : "is-ltf-scroll-down");
      }
      track.querySelectorAll(".ltf-masonry-tile__media.is-a").forEach(capMedia);
      if (!reduced && !track.querySelector(".is-ltf-clone")) {
        var items = Array.prototype.slice.call(
          track.querySelectorAll(":scope > .ltf-masonry-tile.is-a:not(.is-ltf-clone)")
        );
        items.forEach(function (child) {
          track.appendChild(cloneTile(child));
        });
      }
    });
    return true;
  }

  function applyLoopTiming() {
    var tracks = columnsEl.querySelectorAll(".ltf-masonry-column__track.is-a");
    tracks.forEach(function (track, i) {
      var dur = 40 + (i * 11) % 31 + (i % 3) * 2;
      track.style.setProperty("--ltf-loop-dur", dur + "s");
      track.style.setProperty("--ltf-loop-delay", (i * 1.7) + "s");
    });
  }

  function updatePauseState() {
    var paused = visibilityPaused || ioPaused;
    root.setAttribute("data-ltf-masonry-paused", paused ? "1" : "0");
  }

  function rebuildLayout() {
    var w = viewport.clientWidth;
    var cols = columnCount(w);
    var gap = readGapPx();
    var colW = cols > 0 ? (w - gap * (cols - 1)) / cols : w;
    root.style.setProperty("--ltf-col-w", colW + "px");
    root.setAttribute("data-ltf-masonry-cols", String(cols));

    if (source && source.querySelector(".ltf-masonry-tile.is-a")) {
      buildColumnsFromTiles(collectSourceTiles(), cols);
    } else if (!usePrebuiltColumns()) {
      return;
    }

    applyLoopTiming();
    wireVideos();
  }

  function scheduleRebuild() {
    if (rebuildTimer) window.clearTimeout(rebuildTimer);
    rebuildTimer = window.setTimeout(function () {
      rebuildTimer = null;
      rebuildLayout();
    }, 80);
  }

  function loadVideo(v) {
    if (v.getAttribute("data-ltf-video-loaded") === "1") return;
    var src = v.getAttribute("data-src");
    if (!src) return;
    v.setAttribute("data-ltf-video-loaded", "1");
    v.src = src;
    v.load();
  }

  function wireVideos() {
    var videos = root.querySelectorAll("video.ltf-masonry-tile__video.is-a[data-ltf-video-lazy]");
    videos.forEach(function (v) {
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.setAttribute("muted", "");
      v.setAttribute("loop", "");
      v.setAttribute("playsinline", "");
    });

    if (!("IntersectionObserver" in window)) return;

    videos.forEach(function (v) {
      if (v.getAttribute("data-ltf-video-io") === "1") return;
      v.setAttribute("data-ltf-video-io", "1");
      var vio = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            var el = e.target;
            if (e.isIntersecting && root.getAttribute("data-ltf-masonry-paused") !== "1") {
              loadVideo(el);
              el.play().catch(function () {});
            } else {
              el.pause();
            }
          });
        },
        { root: viewport, threshold: 0.15 }
      );
      vio.observe(v);
    });
  }

  if ("IntersectionObserver" in window) {
    var sectionIo = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          ioPaused = !e.isIntersecting;
          updatePauseState();
        });
      },
      { threshold: 0.05 }
    );
    sectionIo.observe(root);
  } else {
    ioPaused = false;
  }

  document.addEventListener("visibilitychange", function () {
    visibilityPaused = document.hidden;
    updatePauseState();
  });

  if ("ResizeObserver" in window) {
    var ro = new ResizeObserver(scheduleRebuild);
    ro.observe(viewport);
  } else {
    window.addEventListener("resize", scheduleRebuild);
  }

  root.querySelectorAll(".ltf-masonry-source .ltf-masonry-tile__media.is-a").forEach(capMedia);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scheduleRebuild).catch(scheduleRebuild);
  } else {
    scheduleRebuild();
  }

  updatePauseState();
  root.rebuildLtfMasonryV2 = rebuildLayout;
})();
