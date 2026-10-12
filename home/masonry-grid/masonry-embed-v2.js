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
  var visibilityPaused = false;
  var ioPaused = false;
  var sectionNear = false;
  var layoutBuilt = false;
  var imagePromoteIo = null;

  function columnCount(w) {
    if (w >= 1600) return 5;
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

  function tileKey(template) {
    var img = template.querySelector("img.ltf-masonry-tile__img.is-a");
    if (img) {
      return img.getAttribute("src") || img.currentSrc || "img-unknown";
    }
    var v = template.querySelector("video.ltf-masonry-tile__video.is-a");
    if (v) {
      return "video:" + (v.getAttribute("data-src") || v.getAttribute("poster") || "video");
    }
    return "tile-" + (template.getAttribute("data-ltf-tile-key") || "x");
  }

  function splitSourceTiles(tiles) {
    var video = null;
    var images = [];
    tiles.forEach(function (t) {
      if (t.hasAttribute("data-ltf-masonry-video-tile") || t.querySelector("video")) {
        if (!video) video = t;
      } else {
        images.push(t);
      }
    });
    return { video: video, images: images };
  }

  function shuffleArray(arr, salt) {
    var copy = arr.slice();
    var n = copy.length;
    var seed = ((salt + 1) * 1103515245) >>> 0;
    var i;
    for (i = n - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      var j = seed % (i + 1);
      var t = copy[i];
      copy[i] = copy[j];
      copy[j] = t;
    }
    return copy;
  }

  function rotateArray(arr, offset) {
    if (!arr.length) return arr;
    var n = ((offset % arr.length) + arr.length) % arr.length;
    return arr.slice(n).concat(arr.slice(0, n));
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

  function setImageLoading(img, eager) {
    if (!img) return;
    img.loading = eager ? "eager" : "lazy";
    img.decoding = "async";
    if (eager) img.setAttribute("data-ltf-eager", "1");
    else img.removeAttribute("data-ltf-eager");
  }

  function prepareMediaInNode(node, eager) {
    var img = node.querySelector("img.ltf-masonry-tile__img.is-a");
    setImageLoading(img, !!eager);
    var v = node.querySelector("video.ltf-masonry-tile__video.is-a");
    if (v) v.preload = "none";
  }

  function cloneTile(node, eager) {
    var clone = node.cloneNode(true);
    clone.classList.add("is-ltf-clone");
    clone.setAttribute("data-ltf-tile-key", tileKey(node));
    prepareMediaInNode(clone, eager);
    return clone;
  }

  function appendSpacer(track, heightPx) {
    var s = document.createElement("div");
    s.className = "ltf-masonry-spacer is-a";
    s.setAttribute("data-ltf-masonry-spacer", "1");
    s.setAttribute("aria-hidden", "true");
    s.style.height = Math.max(24, Math.round(heightPx)) + "px";
    track.appendChild(s);
    return s;
  }

  function estimateChildHeight(child, colW, gap) {
    if (child.getAttribute("data-ltf-masonry-spacer") === "1") {
      return parseFloat(child.style.height) || 0;
    }
    var h = child.getBoundingClientRect().height || child.offsetHeight;
    if (h >= 2) return h;
    var img = child.querySelector("img.ltf-masonry-tile__img.is-a");
    if (img && img.naturalWidth > 0) {
      var hw = (img.naturalHeight / img.naturalWidth) * HEIGHT_SHRINK;
      if (hw > MAX_HW + 0.01) hw = MAX_HW * HEIGHT_SHRINK;
      return colW * hw;
    }
    if (img) {
      var iw = parseFloat(img.getAttribute("width") || "0");
      var ih = parseFloat(img.getAttribute("height") || "0");
      if (iw > 0 && ih > 0) {
        var ratio = (ih / iw) * HEIGHT_SHRINK;
        if (ratio > MAX_HW + 0.01) ratio = MAX_HW * HEIGHT_SHRINK;
        return colW * ratio;
      }
    }
    var v = child.querySelector("video.ltf-masonry-tile__video.is-a");
    if (v) {
      var vw = parseFloat(v.getAttribute("width") || "960");
      var vh = parseFloat(v.getAttribute("height") || "540");
      return colW * ((vh / vw) * HEIGHT_SHRINK);
    }
    return 0;
  }

  function trackSingleCopyHeight(track, gap, colW) {
    var sum = 0;
    var max = 0;
    Array.prototype.forEach.call(track.children, function (child) {
      if (child.getAttribute("data-ltf-loop-clone") === "1") return;
      var h = estimateChildHeight(child, colW, gap);
      if (h < 2) return;
      sum += h + gap;
      max = Math.max(max, h);
    });
    return { total: sum > 0 ? sum - gap : 0, maxTile: max };
  }

  function collectSourceTiles() {
    if (!source) return [];
    return Array.prototype.slice.call(
      source.querySelectorAll(":scope > .ltf-masonry-tile.is-a")
    );
  }

  function applyScrollDirection(track, colIdx) {
    track.classList.remove("is-ltf-scroll-up", "is-ltf-scroll-down");
    if (reduced) return;
    track.classList.add(colIdx % 2 === 0 ? "is-ltf-scroll-up" : "is-ltf-scroll-down");
  }

  var activeColumnOrders = null;

  function columnOrderKeys(order) {
    return order.map(seedFromTemplate);
  }

  function scoreColumnOrders(orders, rots, cols, n, vhSlots) {
    var conflicts = 0;
    var step;
    vhSlots = vhSlots || Math.max(4, Math.min(n, Math.ceil(n * 0.48)));
    for (step = 0; step < 8; step++) {
      var base = (step + 0.5) / 8;
      var keysByCol = [];
      var c;
      for (c = 0; c < cols; c++) {
        var rot = rots[c] || 0;
        var keys = columnOrderKeys(orders[c]);
        var phase = (base + (c / Math.max(1, cols)) * 0.42 + c * 0.02 + rot / n) % 1;
        var start = Math.floor(phase * n) % n;
        var visKeys = [];
        var j;
        for (j = 0; j < vhSlots; j++) visKeys.push(keys[(start + j) % n]);
        keysByCol[c] = visKeys;
        var counts = {};
        visKeys.forEach(function (k) {
          counts[k] = (counts[k] || 0) + 1;
        });
        Object.keys(counts).forEach(function (k) {
          if (counts[k] > 1) conflicts += 100;
        });
      }
      for (c = 0; c < cols - 1; c++) {
        var setA = {};
        var setB = {};
        keysByCol[c].forEach(function (k) {
          setA[k] = 1;
        });
        keysByCol[c + 1].forEach(function (k) {
          setB[k] = 1;
        });
        Object.keys(setA).forEach(function (k) {
          if (setB[k]) conflicts += 8;
        });
      }
      for (c = 0; c < cols; c++) {
        for (var c2 = c + 2; c2 < cols; c2++) {
          var setX = {};
          var setY = {};
          keysByCol[c].forEach(function (k) {
            setX[k] = 1;
          });
          keysByCol[c2].forEach(function (k) {
            setY[k] = 1;
          });
          Object.keys(setX).forEach(function (k) {
            if (setY[k]) conflicts += c2 === cols - 1 && c === 0 ? 12 : 4;
          });
        }
      }
    }
    return conflicts;
  }

  function ordersFromBaseShift(base, cols, n, shiftMul) {
    var orders = [];
    var step = Math.max(1, Math.round(n / cols));
    var c;
    for (c = 0; c < cols; c++) {
      orders[c] = rotateArray(base.slice(), (c * step + shiftMul) % n);
    }
    return orders;
  }

  function pickLayoutPlan(allImages, cols, w, shuffleAttempt) {
    shuffleAttempt = shuffleAttempt || 0;
    var n = allImages.length;
    var maxAttempts = shuffleAttempt === 0 ? 120 : 40;
    var bestOrders = [];
    var bestRots = [];
    var c;
    var base0 = shuffleArray(allImages, (w + cols * 17) >>> 0);
    bestOrders = ordersFromBaseShift(base0, cols, n, 0);
    for (c = 0; c < cols; c++) bestRots[c] = 0;
    var bestScore = scoreColumnOrders(bestOrders, bestRots, cols, n);
    var attempt;
    for (attempt = 0; attempt < maxAttempts; attempt++) {
      var useIndependent = attempt % 5 === 4;
      var tryOrders = [];
      var tryRots = [];
      if (useIndependent) {
        for (c = 0; c < cols; c++) {
          tryOrders[c] = shuffleArray(allImages, (w + attempt * 31 + c * 97) >>> 0);
        }
      } else {
        var base = shuffleArray(allImages, (w + attempt * 31) >>> 0);
        tryOrders = ordersFromBaseShift(base, cols, n, attempt % n);
      }
      for (c = 0; c < cols; c++) {
        var bestR = 0;
        var bestLocal = 1e9;
        var r;
        for (r = 0; r < n; r++) {
          tryRots[c] = r;
          var sc = scoreColumnOrders(tryOrders, tryRots, cols, n);
          if (sc < bestLocal) {
            bestLocal = sc;
            bestR = r;
          }
        }
        tryRots[c] = bestR;
      }
      var score = scoreColumnOrders(tryOrders, tryRots, cols, n);
      if (score < bestScore) {
        bestScore = score;
        for (c = 0; c < cols; c++) {
          bestOrders[c] = tryOrders[c];
          bestRots[c] = tryRots[c];
        }
      }
      if (bestScore === 0) break;
    }
    for (c = 0; c < cols; c++) {
      root.setAttribute("data-ltf-col-rot-" + c, String(bestRots[c]));
    }
    activeColumnOrders = bestOrders;
    return bestOrders;
  }

  function gcd(a, b) {
    while (b) {
      var t = b;
      b = a % b;
      a = t;
    }
    return a;
  }

  function buildColumnTrack(
    colIdx,
    cols,
    allImages,
    columnOrders,
    videoTemplate,
    videoColIdx,
    gap,
    colW
  ) {
    var track = document.createElement("div");
    track.className = "ltf-masonry-column__track is-a";

    var rot = parseInt(root.getAttribute("data-ltf-col-rot-" + colIdx) || "0", 10);
    var list = rotateArray(
      (columnOrders[colIdx] || allImages).slice(),
      rot % Math.max(1, allImages.length)
    );
    var k;

    for (k = 0; k < list.length; k++) {
      var node = cloneTile(list[k], false);
      track.appendChild(node);
      capMedia(node.querySelector(".ltf-masonry-tile__media.is-a"));
    }

    if (colIdx === videoColIdx && videoTemplate) {
      var vNode = cloneTile(videoTemplate, false);
      var insertAt = Math.min(3, track.children.length);
      if (insertAt > 0 && insertAt < track.children.length) {
        track.insertBefore(vNode, track.children[insertAt]);
      } else {
        track.appendChild(vNode);
      }
    }

    track.setAttribute("data-ltf-loop-ready", "0");
    return track;
  }

  function finalizeTrackLoop(track, gap, colW) {
    if (track.getAttribute("data-ltf-loop-ready") === "1") return;

    var vh = viewport.clientHeight || 600;
    var metrics = trackSingleCopyHeight(track, gap, colW);
    var minSingle = vh * 1.15 + metrics.maxTile + gap * 5;

    while (metrics.total < minSingle) {
      appendSpacer(track, Math.min(240, minSingle - metrics.total));
      metrics = trackSingleCopyHeight(track, gap, colW);
      if (track.querySelectorAll("[data-ltf-masonry-spacer]").length > 8) break;
    }

    metrics = trackSingleCopyHeight(track, gap, colW);
    if (metrics.total < vh) {
      track.setAttribute("data-ltf-loop-warning", "short");
      return;
    }

    if (reduced) {
      track.setAttribute("data-ltf-loop-single-h", String(Math.round(metrics.total)));
      track.setAttribute("data-ltf-loop-ready", "1");
      return;
    }

    if (track.getAttribute("data-ltf-loop-cloned") === "1") return;

    appendSpacer(track, Math.max(56, Math.round(vh * 0.14)));

    var singles = Array.prototype.filter.call(track.children, function (child) {
      return child.getAttribute("data-ltf-loop-clone") !== "1";
    });

    singles.forEach(function (child) {
      var dup = child.cloneNode(true);
      dup.classList.add("is-ltf-clone");
      dup.setAttribute("data-ltf-loop-clone", "1");
      prepareMediaInNode(dup, false);
      track.appendChild(dup);
    });

    track.setAttribute("data-ltf-loop-cloned", "1");
    track.setAttribute("data-ltf-loop-single-h", String(Math.round(metrics.total)));

    var colEl = track.closest(".ltf-masonry-column.is-a");
    var colIdx = colEl
      ? parseInt(colEl.getAttribute("data-ltf-masonry-col-idx") || "0", 10)
      : 0;
    applyScrollDirection(track, colIdx);
    track.style.animation = "none";
    void track.offsetHeight;
    track.style.animation = "";
    track.setAttribute("data-ltf-loop-ready", "1");
  }

  function seedFromTemplate(tpl) {
    var src = tileKey(tpl);
    var m = src.match(/seed\/([^/?#]+)/);
    return m ? "seed:" + m[1] : src;
  }

  function buildColumnsFromTiles(tiles, cols, shuffleAttempt) {
    shuffleAttempt = shuffleAttempt || 0;
    columnsEl.innerHTML = "";
    if (imagePromoteIo) {
      imagePromoteIo.disconnect();
      imagePromoteIo = null;
    }

    var parts = splitSourceTiles(tiles);
    var allImages = parts.images;
    var videoTemplate = parts.video;
    var videoColIdx = 0;
    var gap = readGapPx();
    var w = viewport.clientWidth;
    var colW = cols > 0 ? (w - gap * (cols - 1)) / cols : w;
    var i;
    var attempt;
    var columnOrders = pickLayoutPlan(allImages, cols, w + shuffleAttempt * 31, shuffleAttempt);

    root.style.setProperty("--ltf-col-w", colW + "px");
    root.setAttribute("data-ltf-masonry-cols", String(cols));

    for (i = 0; i < cols; i++) {
        var col = document.createElement("div");
        col.className = "ltf-masonry-column is-a";
        col.setAttribute("data-ltf-masonry-col-idx", String(i));
        var vh = viewport.clientHeight || 600;
        var staggerMul = i === 0 || i === cols - 1 ? 1.35 : 1;
        col.style.setProperty(
          "--ltf-col-stagger",
          (staggerPattern[i % staggerPattern.length] * vh * staggerMul).toFixed(1) + "px"
        );

        var track = buildColumnTrack(
          i,
          cols,
          allImages,
          columnOrders,
          videoTemplate,
          videoColIdx,
          gap,
          colW
        );
        col.appendChild(track);
      columnsEl.appendChild(col);
    }

    layoutBuilt = true;
    wireImageLazyPromotion();
    promoteNearViewportImages();
  }

  function applyLoopTiming() {
    var tracks = columnsEl.querySelectorAll(".ltf-masonry-column__track.is-a");
    tracks.forEach(function (track, i) {
      var singleH = parseFloat(track.getAttribute("data-ltf-loop-single-h") || "0");
      var halfH = singleH > 0 ? singleH : track.offsetHeight / 2;
      if (track.offsetHeight > 0 && track.getAttribute("data-ltf-loop-cloned") === "1") {
        halfH = track.offsetHeight / 2;
      }
      var pxPerSec = halfH / (48 + (i * 5) % 18);
      var dur = Math.min(70, Math.max(40, halfH / pxPerSec));
      var cols = parseInt(root.getAttribute("data-ltf-masonry-cols") || "4", 10);
      var phaseDelay = 0;
      if (cols === 2) {
        phaseDelay = i === 1 ? dur * 0.5 : 0;
      } else if (cols > 0) {
        phaseDelay = (i / cols) * dur * 0.48 + i * 1.35;
        if (cols === 4 && i === 3) phaseDelay += dur * 0.26;
        if (cols === 4 && i === 0) phaseDelay += dur * 0.05;
      }
      track.style.setProperty("--ltf-loop-dur", dur.toFixed(2) + "s");
      track.style.setProperty("--ltf-loop-delay", phaseDelay.toFixed(2) + "s");
    });
  }

  function updatePauseState() {
    var paused = visibilityPaused || ioPaused;
    root.setAttribute("data-ltf-masonry-paused", paused ? "1" : "0");
  }

  function promoteNearViewportImages() {
    if (!viewport) return;
    var vRect = viewport.getBoundingClientRect();
    var margin = vRect.height || 600;
    root.querySelectorAll(".ltf-masonry-column img.ltf-masonry-tile__img.is-a").forEach(function (img) {
      if (img.getAttribute("data-ltf-eager") === "1") return;
      var r = img.getBoundingClientRect();
      if (r.bottom >= vRect.top - margin && r.top <= vRect.bottom + margin) {
        setImageLoading(img, true);
      }
    });
  }

  function wireImageLazyPromotion() {
    if (!("IntersectionObserver" in window) || !viewport) return;
    if (imagePromoteIo) imagePromoteIo.disconnect();
    imagePromoteIo = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var img = e.target;
          if (img.getAttribute("data-ltf-eager") !== "1") setImageLoading(img, true);
        });
      },
      { root: viewport, rootMargin: "100% 0px 100% 0px", threshold: 0 }
    );
    root.querySelectorAll(".ltf-masonry-column img.ltf-masonry-tile__img.is-a").forEach(function (img) {
      imagePromoteIo.observe(img);
    });
  }

  function whenEagerImagesReady(cb) {
    var imgs = root.querySelectorAll(
      '.ltf-masonry-column img.ltf-masonry-tile__img.is-a[data-ltf-eager="1"]'
    );
    if (!imgs.length) {
      cb();
      return;
    }
    var pending = 0;
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      cb();
    }
    Array.prototype.forEach.call(imgs, function (img) {
      if (img.complete && img.naturalWidth > 0) return;
      pending += 1;
      function onLoad() {
        pending -= 1;
        if (pending <= 0) finish();
      }
      img.addEventListener("load", onLoad, { once: true });
      img.addEventListener("error", onLoad, { once: true });
    });
    if (pending === 0) finish();
    else window.setTimeout(finish, 10000);
  }

  function finalizeAllTracks() {
    var gap = readGapPx();
    var w = viewport.clientWidth;
    var cols = parseInt(root.getAttribute("data-ltf-masonry-cols") || "4", 10);
    var colW = cols > 0 ? (w - gap * (cols - 1)) / cols : w;
    root.querySelectorAll(".ltf-masonry-column__track.is-a").forEach(function (track) {
      finalizeTrackLoop(track, gap, colW);
    });
    applyLoopTiming();
    wireVideos();
  }

  function auditScore(a) {
    return a.sameCol * 10000 + a.adjacent * 500 + a.nonAdjClose * 5;
  }

  function restartTrackAnimation(track) {
    track.style.animation = "none";
    void track.offsetHeight;
    track.style.animation = "";
  }

  function nudgePhaseDelays(maxPasses) {
    var tracks = columnsEl.querySelectorAll(".ltf-masonry-column__track.is-a");
    var n = tracks.length;
    if (!n || reduced) return auditVisibleDuplicateIssues(8);
    var delays = [];
    var c;
    for (c = 0; c < n; c++) {
      delays[c] =
        parseFloat(getComputedStyle(tracks[c]).getPropertyValue("--ltf-loop-delay")) || 0;
    }
    var bestAudit = auditVisibleDuplicateIssues(8);
    var bestScore = auditScore(bestAudit);
    var pass;
    for (pass = 0; pass < (maxPasses || 4); pass++) {
      for (c = 0; c < n; c++) {
        var track = tracks[c];
        var dur =
          parseFloat(getComputedStyle(track).getPropertyValue("--ltf-loop-dur")) || 55;
        var k;
        for (k = -3; k <= 3; k++) {
          if (k === 0) continue;
          var tryDelay = Math.max(0, delays[c] + k * dur * 0.085);
          track.style.setProperty("--ltf-loop-delay", tryDelay.toFixed(2) + "s");
          restartTrackAnimation(track);
          var a = auditVisibleDuplicateIssues(8);
          var sc = auditScore(a);
          if (sc < bestScore) {
            bestScore = sc;
            bestAudit = a;
            delays[c] = tryDelay;
          }
        }
        track.style.setProperty("--ltf-loop-delay", delays[c].toFixed(2) + "s");
        restartTrackAnimation(track);
      }
    }
    return bestAudit;
  }

  function auditVisibleDuplicateIssues(sampleSteps) {
    var viewportEl = viewport;
    if (!viewportEl) return { sameCol: 0, adjacent: 0 };
    var vRect = viewportEl.getBoundingClientRect();
    var tracks = root.querySelectorAll(".ltf-masonry-column__track.is-a");
    var sameCol = 0;
    var adjacent = 0;
    var nonAdjClose = 0;
    var vh = vRect.height || 600;
    var step;
    var wasPaused = root.getAttribute("data-ltf-masonry-paused");
    root.setAttribute("data-ltf-masonry-paused", "1");

    function keyForTile(tile) {
      var img = tile.querySelector("img.ltf-masonry-tile__img.is-a");
      if (img) return seedFromTemplate(tile);
      var v = tile.querySelector("video.ltf-masonry-tile__video.is-a");
      if (v) return "video:" + (v.getAttribute("data-src") || v.getAttribute("poster") || "v");
      return seedFromTemplate(tile);
    }

    for (step = 0; step < sampleSteps; step++) {
      var progress = (step + 0.5) / sampleSteps;
      Array.prototype.forEach.call(tracks, function (track) {
        track.getAnimations().forEach(function (anim) {
          try {
            anim.pause();
            var timing = anim.effect.getTiming();
            var dur = timing.duration;
            var delay =
              typeof timing.delay === "number"
                ? timing.delay
                : parseFloat(getComputedStyle(track).animationDelay) || 0;
            anim.currentTime = (delay + progress * dur) % dur;
          } catch (e) {}
        });
      });

      var cols = root.querySelectorAll(".ltf-masonry-column.is-a");
      var visibleByCol = [];
      Array.prototype.forEach.call(cols, function (col, ci) {
        var keys = [];
        col.querySelectorAll(".ltf-masonry-tile.is-a").forEach(function (tile) {
          var r = tile.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) return;
          var overlap = Math.min(r.bottom, vRect.bottom) - Math.max(r.top, vRect.top);
          if (overlap < 8) return;
          keys.push(keyForTile(tile));
        });
        visibleByCol[ci] = keys;
        var counts = {};
        keys.forEach(function (k) {
          counts[k] = (counts[k] || 0) + 1;
        });
        Object.keys(counts).forEach(function (k) {
          if (counts[k] > 1) sameCol += 1;
        });
      });

      var visibleItems = [];
      Array.prototype.forEach.call(cols, function (col, ci) {
        col.querySelectorAll(".ltf-masonry-tile.is-a").forEach(function (tile) {
          var r = tile.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) return;
          var overlap = Math.min(r.bottom, vRect.bottom) - Math.max(r.top, vRect.top);
          if (overlap < 8) return;
          visibleItems.push({
            col: ci,
            key: keyForTile(tile),
            top: r.top,
            bottom: r.bottom,
            centerY: (r.top + r.bottom) / 2,
          });
        });
      });

      var ii;
      for (ii = 0; ii < visibleItems.length; ii++) {
        var jj;
        for (jj = ii + 1; jj < visibleItems.length; jj++) {
          var a = visibleItems[ii];
          var b = visibleItems[jj];
          if (a.key !== b.key) continue;
          if (a.col === b.col) continue;
          var bandOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (Math.abs(a.col - b.col) === 1) {
            if (bandOverlap >= 24) adjacent += 1;
            continue;
          }
          if (Math.abs(a.centerY - b.centerY) + 1 < vh * 0.6 && bandOverlap >= 24) nonAdjClose += 1;
        }
      }
    }

    root.setAttribute("data-ltf-masonry-paused", wasPaused || "0");
    return { sameCol: sameCol, adjacent: adjacent, nonAdjClose: nonAdjClose };
  }

  function finalizeWithDuplicateRetry(tiles, cols, attempt) {
    root.setAttribute("data-ltf-masonry-layout-settled", "0");
    root.querySelectorAll(".ltf-masonry-tile__media.is-a").forEach(capMedia);
    finalizeAllTracks();
    if (reduced) {
      root.setAttribute("data-ltf-masonry-layout-settled", "1");
      return;
    }
    var audit = auditVisibleDuplicateIssues(8);
    if ((audit.sameCol > 0 || audit.adjacent > 0 || audit.nonAdjClose > 0) && attempt < 48) {
      buildColumnsFromTiles(tiles, cols, attempt + 1);
      promoteNearViewportImages();
      whenEagerImagesReady(function () {
        finalizeWithDuplicateRetry(tiles, cols, attempt + 1);
      });
      return;
    }
    if (audit.adjacent > 0 || audit.nonAdjClose > 0) {
      nudgePhaseDelays(4);
      audit = auditVisibleDuplicateIssues(8);
    }
    root.setAttribute("data-ltf-masonry-layout-settled", "1");
  }

  function rebuildLayout() {
    if (!sectionNear && !reduced) return;
    var w = viewport.clientWidth;
    var cols = columnCount(w);
    var tiles = collectSourceTiles();

    if (!source || !source.querySelector(".ltf-masonry-tile.is-a")) return;

    buildColumnsFromTiles(tiles, cols, 0);
    promoteNearViewportImages();
    whenEagerImagesReady(function () {
      finalizeWithDuplicateRetry(tiles, cols, 0);
    });
  }

  function scheduleRebuild() {
    if (packTimer) window.clearTimeout(packTimer);
    packTimer = window.setTimeout(function () {
      packTimer = null;
      rebuildLayout();
    }, 80);
  }
  var packTimer = null;

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
      if (v.getAttribute("data-ltf-video-io") === "1") return;
      v.setAttribute("data-ltf-video-io", "1");
      if (!("IntersectionObserver" in window)) return;
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
        { root: viewport, threshold: 0.12 }
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
          if (e.isIntersecting) {
            sectionNear = true;
            root.setAttribute("data-ltf-masonry-near", "1");
            if (!layoutBuilt) rebuildLayout();
            else promoteNearViewportImages();
          }
        });
      },
      { root: null, rootMargin: "120px 0px 120px 0px", threshold: 0.01 }
    );
    sectionIo.observe(root);
  } else {
    sectionNear = true;
    root.setAttribute("data-ltf-masonry-near", "1");
  }

  document.addEventListener("visibilitychange", function () {
    visibilityPaused = document.hidden;
    updatePauseState();
  });

  if ("ResizeObserver" in window) {
    var ro = new ResizeObserver(function () {
      if (layoutBuilt) scheduleRebuild();
    });
    ro.observe(viewport);
  } else {
    window.addEventListener("resize", function () {
      if (layoutBuilt) scheduleRebuild();
    });
  }

  updatePauseState();
  root.rebuildLtfMasonryV2 = function () {
    sectionNear = true;
    root.setAttribute("data-ltf-masonry-near", "1");
    rebuildLayout();
  };
  root.finalizeLtfMasonryV2 = finalizeAllTracks;
  root.promoteLtfMasonryImages = promoteNearViewportImages;

  if (sectionNear || reduced) rebuildLayout();
})();
