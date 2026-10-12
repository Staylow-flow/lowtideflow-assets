(function () {
  var root = document.querySelector("[data-ltf-masonry-v2]");
  if (!root || root.getAttribute("data-ltf-masonry-v2-init") === "1") return;
  root.setAttribute("data-ltf-masonry-v2-init", "1");

  var MAX_HW = 1.25;
  var HEIGHT_SHRINK = 0.9;
  var LOOP_DUR = 55;
  var STAGGER = [0, 0.12, 0.05, 0.18];
  var PHASE = [0, 6.5, 2.2, 9.8];
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var viewport = root.querySelector(".ltf-masonry-viewport.is-a");
  var columnsEl = root.querySelector(".ltf-masonry-columns.is-a");
  var source = root.querySelector(".ltf-masonry-source.is-a");
  if (!viewport || !columnsEl) return;

  var visibilityPaused = false;
  var ioPaused = false;
  var sectionNear = false;
  var layoutBuilt = false;
  var imagePromoteIo = null;
  var deckCache = null;

  function columnCount(w) {
    if (w >= 820) return 4;
    if (w >= 520) return 3;
    return 2;
  }

  function readGapPx() {
    var g = getComputedStyle(root).getPropertyValue("--ltf-masonry-gap").trim();
    var n = parseFloat(g);
    return n > 0 ? n : 14;
  }

  function seedNum(tpl) {
    var img = tpl.querySelector("img.ltf-masonry-tile__img.is-a");
    var src = img ? img.getAttribute("src") || "" : "";
    var m = src.match(/ltf-(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }

  function splitSourceTiles(tiles) {
    var video = null;
    var images = [];
    tiles.forEach(function (t) {
      if (t.hasAttribute("data-ltf-masonry-video-tile") || t.querySelector("video")) {
        if (!video) video = t;
      } else images.push(t);
    });
    images.sort(function (a, b) {
      return seedNum(a) - seedNum(b);
    });
    var A = [];
    var B = [];
    images.forEach(function (t) {
      if (seedNum(t) % 2 === 1) A.push(t);
      else B.push(t);
    });
    deckCache = { A: A, B: B, video: video };
    return deckCache;
  }

  function rotateArr(arr, off) {
    if (!arr.length) return arr;
    var n = arr.length;
    var o = ((off % n) + n) % n;
    return arr.slice(o).concat(arr.slice(0, o));
  }

  function columnDeck(colIdx, cols, deck) {
    var half = Math.floor(deck.A.length / 2);
    var up = colIdx % 2 === 0;
    if (cols === 2) return up ? deck.A.slice() : deck.B.slice();
    if (cols === 3) {
      if (colIdx === 0) return deck.A.slice();
      if (colIdx === 1) return deck.B.slice();
      return rotateArr(deck.A, half);
    }
    if (colIdx === 0) return deck.A.slice();
    if (colIdx === 1) return deck.B.slice();
    if (colIdx === 2) return rotateArr(deck.A, half);
    return rotateArr(deck.B, half);
  }

  function capMedia(media) {
    if (!media) return;
    var img = media.querySelector("img.ltf-masonry-tile__img.is-a");
    if (!img) return;
    function apply() {
      if (!img.naturalWidth) return;
      var hw = (img.naturalHeight / img.naturalWidth) * HEIGHT_SHRINK;
      media.classList.toggle("is-cap", hw > MAX_HW + 0.01);
    }
    if (img.complete) apply();
    else img.addEventListener("load", apply, { once: true });
  }

  function setImgLoad(img, eager) {
    if (!img) return;
    img.loading = eager ? "eager" : "lazy";
    img.decoding = "async";
    if (eager) img.setAttribute("data-ltf-eager", "1");
    else img.removeAttribute("data-ltf-eager");
  }

  function prepNode(node, eager) {
    setImgLoad(node.querySelector("img.ltf-masonry-tile__img.is-a"), eager);
    var v = node.querySelector("video.ltf-masonry-tile__video.is-a");
    if (v) v.preload = "none";
  }

  function cloneTile(node, eager) {
    var c = node.cloneNode(true);
    c.classList.add("is-ltf-clone");
    prepNode(c, eager);
    return c;
  }

  function estH(child, colW, gap) {
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
        var r = (ih / iw) * HEIGHT_SHRINK;
        if (r > MAX_HW + 0.01) r = MAX_HW * HEIGHT_SHRINK;
        return colW * r;
      }
    }
    var v = child.querySelector("video.ltf-masonry-tile__video.is-a");
    if (v) {
      var vw = parseFloat(v.getAttribute("width") || "960");
      var vh = parseFloat(v.getAttribute("height") || "540");
      return colW * ((vh / vw) * HEIGHT_SHRINK);
    }
    var h = child.getBoundingClientRect().height || child.offsetHeight;
    return h > 2 ? h : colW * 0.65;
  }

  function singleMetrics(track, gap, colW) {
    var sum = 0;
    var max = 0;
    Array.prototype.forEach.call(track.children, function (ch) {
      if (ch.getAttribute("data-ltf-loop-clone") === "1") return;
      var h = estH(ch, colW, gap);
      if (h < 2) return;
      sum += h + gap;
      if (h > max) max = h;
    });
    return { total: sum > 0 ? sum - gap : 0, max: max };
  }

  function singles(track) {
    return Array.prototype.filter.call(track.children, function (ch) {
      return ch.getAttribute("data-ltf-loop-clone") !== "1";
    });
  }

  function buildTrack(colIdx, cols, deck, gap, colW) {
    var track = document.createElement("div");
    track.className = "ltf-masonry-column__track is-a";
    var list = columnDeck(colIdx, cols, deck);
    var i;
    for (i = 0; i < list.length; i++) {
      var node = cloneTile(list[i], false);
      node.classList.remove("is-ltf-clone");
      track.appendChild(node);
      capMedia(node.querySelector(".ltf-masonry-tile__media.is-a"));
    }
    if (colIdx === 0 && deck.video) {
      var vn = cloneTile(deck.video, false);
      vn.classList.remove("is-ltf-clone");
      var at = Math.min(2, track.children.length);
      if (at < track.children.length) track.insertBefore(vn, track.children[at]);
      else track.appendChild(vn);
    }
    track.setAttribute("data-ltf-loop-ready", "0");
    return track;
  }

  function finalizeTrack(track, colIdx, gap, colW) {
    if (track.getAttribute("data-ltf-loop-ready") === "1") return;
    var vh = viewport.clientHeight || 600;
    var m = singleMetrics(track, gap, colW);
    var need = vh + m.max + gap * 4;
    if (reduced) {
      track.setAttribute("data-ltf-loop-single-h", String(Math.round(m.total)));
      track.setAttribute("data-ltf-loop-ready", "1");
      return;
    }
    if (track.getAttribute("data-ltf-loop-cloned") === "1") return;
    var guard = 0;
    while (m.total < need && guard < 2) {
      singles(track).forEach(function (ch) {
        var dup = ch.cloneNode(true);
        dup.classList.add("is-ltf-clone");
        prepNode(dup, false);
        track.appendChild(dup);
      });
      m = singleMetrics(track, gap, colW);
      guard += 1;
    }
    singles(track).forEach(function (ch) {
      var dup = ch.cloneNode(true);
      dup.classList.add("is-ltf-clone");
      dup.setAttribute("data-ltf-loop-clone", "1");
      prepNode(dup, false);
      track.appendChild(dup);
    });
    track.setAttribute("data-ltf-loop-cloned", "1");
    track.setAttribute("data-ltf-loop-single-h", String(Math.round(m.total)));
    track.classList.add(colIdx % 2 === 0 ? "is-ltf-scroll-up" : "is-ltf-scroll-down");
    track.style.setProperty("--ltf-loop-dur", LOOP_DUR + "s");
    var phaseSec = PHASE[colIdx % PHASE.length] || 0;
    track.style.setProperty("--ltf-loop-delay", -phaseSec + "s");
    track.setAttribute("data-ltf-loop-ready", "1");
  }

  function buildLayout(cols) {
    columnsEl.innerHTML = "";
    if (imagePromoteIo) {
      imagePromoteIo.disconnect();
      imagePromoteIo = null;
    }
    var tiles = source
      ? Array.prototype.slice.call(source.querySelectorAll(":scope > .ltf-masonry-tile.is-a"))
      : [];
    var deck = splitSourceTiles(tiles);
    var gap = readGapPx();
    var w = viewport.clientWidth;
    var colW = cols > 0 ? (w - gap * (cols - 1)) / cols : w;
    var vh = viewport.clientHeight || 600;
    var i;
    root.style.setProperty("--ltf-col-w", colW + "px");
    root.setAttribute("data-ltf-masonry-cols", String(cols));
    for (i = 0; i < cols; i++) {
      var col = document.createElement("div");
      col.className = "ltf-masonry-column is-a";
      col.setAttribute("data-ltf-masonry-col-idx", String(i));
      var sm = STAGGER[i % STAGGER.length] * vh * (i % 2 === 1 ? 0.55 : 1);
      col.style.setProperty("--ltf-col-stagger", sm.toFixed(1) + "px");
      var track = buildTrack(i, cols, deck, gap, colW);
      col.appendChild(track);
      columnsEl.appendChild(col);
    }
    layoutBuilt = true;
    wireImgPromote();
    promoteNear();
  }

  function finalizeAll() {
    var gap = readGapPx();
    var w = viewport.clientWidth;
    var cols = parseInt(root.getAttribute("data-ltf-masonry-cols") || "4", 10);
    var colW = cols > 0 ? (w - gap * (cols - 1)) / cols : w;
    root.querySelectorAll(".ltf-masonry-column__track.is-a").forEach(function (tr) {
      var col = tr.closest(".ltf-masonry-column.is-a");
      var ci = col ? parseInt(col.getAttribute("data-ltf-masonry-col-idx") || "0", 10) : 0;
      finalizeTrack(tr, ci, gap, colW);
    });
    wireVideos();
    root.setAttribute("data-ltf-masonry-layout-settled", "1");
  }

  function whenImgsReady(cb) {
    var imgs = root.querySelectorAll(
      '.ltf-masonry-column img.ltf-masonry-tile__img.is-a[data-ltf-eager="1"]'
    );
    if (!imgs.length) {
      cb();
      return;
    }
    var pending = 0;
    var done = false;
    function fin() {
      if (done) return;
      done = true;
      cb();
    }
    Array.prototype.forEach.call(imgs, function (img) {
      if (img.complete && img.naturalWidth > 0) return;
      pending += 1;
      function on() {
        pending -= 1;
        if (pending <= 0) fin();
      }
      img.addEventListener("load", on, { once: true });
      img.addEventListener("error", on, { once: true });
    });
    if (!pending) fin();
    else window.setTimeout(fin, 12000);
  }

  function rebuild() {
    if (!sectionNear && !reduced) return;
    var cols = columnCount(viewport.clientWidth);
    root.setAttribute("data-ltf-masonry-layout-settled", "0");
    buildLayout(cols);
    promoteNear();
    whenImgsReady(function () {
      root.querySelectorAll(".ltf-masonry-tile__media.is-a").forEach(capMedia);
      finalizeAll();
    });
  }

  var packTimer = null;
  function scheduleRebuild() {
    if (packTimer) window.clearTimeout(packTimer);
    packTimer = window.setTimeout(function () {
      packTimer = null;
      rebuild();
    }, 80);
  }

  function updatePause() {
    root.setAttribute("data-ltf-masonry-paused", visibilityPaused || ioPaused ? "1" : "0");
  }

  function promoteNear() {
    if (!viewport) return;
    var vR = viewport.getBoundingClientRect();
    var m = vR.height || 600;
    root.querySelectorAll(".ltf-masonry-column img.ltf-masonry-tile__img.is-a").forEach(function (img) {
      if (img.getAttribute("data-ltf-eager") === "1") return;
      var r = img.getBoundingClientRect();
      if (r.bottom >= vR.top - m && r.top <= vR.bottom + m) setImgLoad(img, true);
    });
  }

  function wireImgPromote() {
    if (!("IntersectionObserver" in window) || !viewport) return;
    if (imagePromoteIo) imagePromoteIo.disconnect();
    imagePromoteIo = new IntersectionObserver(
      function (ents) {
        ents.forEach(function (e) {
          if (e.isIntersecting) setImgLoad(e.target, true);
        });
      },
      { root: viewport, rootMargin: "100% 0px 100% 0px", threshold: 0 }
    );
    root.querySelectorAll(".ltf-masonry-column img.ltf-masonry-tile__img.is-a").forEach(function (img) {
      imagePromoteIo.observe(img);
    });
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
    root.querySelectorAll("video.ltf-masonry-tile__video.is-a[data-ltf-video-lazy]").forEach(function (v) {
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      if (v.getAttribute("data-ltf-video-io") === "1") return;
      v.setAttribute("data-ltf-video-io", "1");
      if (!("IntersectionObserver" in window)) return;
      var io = new IntersectionObserver(
        function (ents) {
          ents.forEach(function (e) {
            var el = e.target;
            if (e.isIntersecting && root.getAttribute("data-ltf-masonry-paused") !== "1") {
              loadVideo(el);
              el.play().catch(function () {});
            } else el.pause();
          });
        },
        { root: viewport, threshold: 0.12 }
      );
      io.observe(v);
    });
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      function (ents) {
        ents.forEach(function (e) {
          ioPaused = !e.isIntersecting;
          updatePause();
          if (e.isIntersecting) {
            sectionNear = true;
            root.setAttribute("data-ltf-masonry-near", "1");
            if (!layoutBuilt) rebuild();
            else promoteNear();
          }
        });
      },
      { root: null, rootMargin: "120px 0px 120px 0px", threshold: 0.01 }
    ).observe(root);
  } else {
    sectionNear = true;
    root.setAttribute("data-ltf-masonry-near", "1");
  }

  document.addEventListener("visibilitychange", function () {
    visibilityPaused = document.hidden;
    updatePause();
  });

  if ("ResizeObserver" in window) {
    new ResizeObserver(function () {
      if (layoutBuilt) scheduleRebuild();
    }).observe(viewport);
  } else {
    window.addEventListener("resize", function () {
      if (layoutBuilt) scheduleRebuild();
    });
  }

  updatePause();
  root.rebuildLtfMasonryV2 = function () {
    sectionNear = true;
    root.setAttribute("data-ltf-masonry-near", "1");
    rebuild();
  };
  root.finalizeLtfMasonryV2 = finalizeAll;
  root.promoteLtfMasonryImages = promoteNear;

  if (sectionNear || reduced) rebuild();
})();
