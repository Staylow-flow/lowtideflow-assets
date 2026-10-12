(function () {
  var rootSel = "[data-ltf-masonry]";
  var root = document.querySelector(rootSel);
  if (!root || root.getAttribute("data-ltf-masonry-init") === "1") return;
  root.setAttribute("data-ltf-masonry-init", "1");

  var grid = root.querySelector(".ltf-masonry-grid.is-a");
  if (!grid) return;

  var MAX_HW = 1.35;
  var BALANCE_RATIO = 0.25;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var packTimer = null;

  function columnCount(containerWidth) {
    if (containerWidth >= 1500) return 5;
    if (containerWidth >= 992) return 4;
    if (containerWidth >= 600) return 3;
    if (containerWidth >= 360) return 2;
    return 1;
  }

  function readGapPx() {
    var g = getComputedStyle(root).getPropertyValue("--ltf-masonry-gap").trim();
    if (!g) return 16;
    if (g.indexOf("px") !== -1) return parseFloat(g) || 16;
    var probe = document.createElement("div");
    probe.style.width = g;
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    root.appendChild(probe);
    var px = probe.getBoundingClientRect().width;
    root.removeChild(probe);
    return px || 16;
  }

  function indexOfMin(arr) {
    var idx = 0;
    for (var i = 1; i < arr.length; i++) {
      if (arr[i] < arr[idx]) idx = i;
    }
    return idx;
  }

  function indexOfMax(arr) {
    var idx = 0;
    for (var i = 1; i < arr.length; i++) {
      if (arr[i] > arr[idx]) idx = i;
    }
    return idx;
  }

  function columnBottomsFromAssignments(assignments, heights, cols, gap) {
    var totals = [];
    var c;
    for (c = 0; c < cols; c++) totals[c] = 0;
    for (var i = 0; i < assignments.length; i++) {
      totals[assignments[i]] += heights[i] + gap;
    }
    for (c = 0; c < cols; c++) {
      if (totals[c] > 0) totals[c] -= gap;
    }
    return totals;
  }

  function balanceDelta(assignments, heights, cols, gap) {
    var bottoms = columnBottomsFromAssignments(assignments, heights, cols, gap);
    return Math.max.apply(null, bottoms) - Math.min.apply(null, bottoms);
  }

  function rebalanceAssignments(assignments, heights, cols, gap) {
    var avg =
      heights.reduce(function (a, b) {
        return a + b;
      }, 0) / (heights.length || 1);
    var target = avg * BALANCE_RATIO + gap;
    var maxIter = Math.max(24, assignments.length * 4);
    var iter;
    var i;

    for (iter = 0; iter < maxIter; iter++) {
      var current = balanceDelta(assignments, heights, cols, gap);
      if (current <= target) break;

      var bottoms = columnBottomsFromAssignments(assignments, heights, cols, gap);
      var maxC = indexOfMax(bottoms);
      var minC = indexOfMin(bottoms);
      if (maxC === minC) break;

      var best = null;
      var bestDelta = current;

      for (i = 0; i < assignments.length; i++) {
        if (assignments[i] !== maxC) continue;
        var trial = assignments.slice();
        trial[i] = minC;
        var d = balanceDelta(trial, heights, cols, gap);
        if (d < bestDelta) {
          bestDelta = d;
          best = trial;
        }
      }

      if (best) {
        assignments = best;
        continue;
      }

      var improved = false;
      for (i = 0; i < assignments.length; i++) {
        for (var j = i + 1; j < assignments.length; j++) {
          if (assignments[i] === assignments[j]) continue;
          var swapTrial = assignments.slice();
          var tmp = swapTrial[i];
          swapTrial[i] = swapTrial[j];
          swapTrial[j] = tmp;
          var sd = balanceDelta(swapTrial, heights, cols, gap);
          if (sd < current) {
            assignments = swapTrial;
            improved = true;
            break;
          }
        }
        if (improved) break;
      }
      if (!improved) break;
    }
    return assignments;
  }

  function packMasonry() {
    var tiles = Array.prototype.slice.call(
      grid.querySelectorAll(":scope > .ltf-masonry-tile.is-a")
    );
    if (!tiles.length) return;

    var gap = readGapPx();
    var width = grid.clientWidth;
    if (width < 1) return;

    var cols = columnCount(width);
    var colWidth = (width - gap * (cols - 1)) / cols;
    var heights = [];
    var assignments = [];
    var colHeights = [];
    var c;
    var i;

    for (c = 0; c < cols; c++) colHeights[c] = 0;

    tiles.forEach(function (tile) {
      tile.style.width = colWidth + "px";
      tile.style.position = "static";
      tile.style.left = "auto";
      tile.style.top = "auto";
      tile.style.margin = "0 0 " + gap + "px 0";
      tile.style.visibility = "hidden";
    });
    grid.classList.remove("is-ltf-packed");
    grid.style.height = "auto";

    tiles.forEach(function (tile) {
      heights.push(tile.offsetHeight);
    });

    for (i = 0; i < tiles.length; i++) {
      var minCol = indexOfMin(colHeights);
      assignments[i] = minCol;
      colHeights[minCol] += heights[i] + gap;
    }

    assignments = rebalanceAssignments(assignments, heights, cols, gap);

    grid.classList.add("is-ltf-packed");
    colHeights = [];
    for (c = 0; c < cols; c++) colHeights[c] = 0;

    for (i = 0; i < tiles.length; i++) {
      var tile = tiles[i];
      var col = assignments[i];
      tile.style.position = "absolute";
      tile.style.margin = "0";
      tile.style.visibility = "visible";
      tile.style.left = col * (colWidth + gap) + "px";
      tile.style.top = colHeights[col] + "px";
      tile.setAttribute("data-ltf-masonry-col", String(col));
      colHeights[col] += heights[i] + gap;
    }

    var maxCol = Math.max.apply(null, colHeights);
    grid.style.height = (maxCol > 0 ? maxCol - gap : 0) + "px";
    grid.setAttribute("data-ltf-masonry-cols", String(cols));
  }

  function schedulePack() {
    if (packTimer) window.clearTimeout(packTimer);
    packTimer = window.setTimeout(function () {
      packTimer = null;
      packMasonry();
    }, 50);
  }

  function capMedia(media) {
    if (!media) return;
    var img = media.querySelector("img.ltf-masonry-tile__img.is-a");
    if (!img) return;
    function apply() {
      if (!img.naturalWidth) return;
      var hw = img.naturalHeight / img.naturalWidth;
      if (hw > MAX_HW + 0.01) media.classList.add("is-cap");
      else media.classList.remove("is-cap");
      schedulePack();
    }
    if (img.complete) apply();
    else img.addEventListener("load", apply, { once: true });
  }

  root.querySelectorAll(".ltf-masonry-tile__media.is-a").forEach(capMedia);

  root.querySelectorAll("img.ltf-masonry-tile__img.is-a").forEach(function (img) {
    if (!img.complete) img.addEventListener("load", schedulePack, { once: true });
  });

  var tiles = root.querySelectorAll(".ltf-masonry-tile.is-a");
  if (reduced) {
    tiles.forEach(function (t) {
      t.classList.add("is-ltf-revealed");
    });
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
    tiles.forEach(function (t) {
      io.observe(t);
    });
  } else {
    tiles.forEach(function (t) {
      t.classList.add("is-ltf-revealed");
    });
  }

  if ("ResizeObserver" in window) {
    var ro = new ResizeObserver(schedulePack);
    ro.observe(grid);
    tiles.forEach(function (t) {
      ro.observe(t);
    });
  } else {
    window.addEventListener("resize", schedulePack);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(schedulePack).catch(function () {});
  }

  schedulePack();

  var videos = root.querySelectorAll("video.ltf-masonry-tile__video.is-a[data-ltf-video-lazy]");

  function loadVideo(v) {
    if (v.getAttribute("data-ltf-video-loaded") === "1") return;
    var src = v.getAttribute("data-src");
    if (!src) return;
    v.setAttribute("data-ltf-video-loaded", "1");
    v.src = src;
    v.load();
  }

  if (videos.length) {
    videos.forEach(function (v) {
      v.addEventListener("loadedmetadata", schedulePack);
    });

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
  }

  root.packLtfMasonry = packMasonry;
})();
