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

  var LOOP_HALF_DUR = 55;
  var LAYOUT_SAMPLES = 12;
  var CROSS_COL_MIN_SEP = 0.6;

  function columnCount(w) {
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
  var activePhaseDelays = null;

  function templateHeightPx(tpl, colW) {
    var img = tpl.querySelector("img.ltf-masonry-tile__img.is-a");
    if (img) {
      var iw = parseFloat(img.getAttribute("width") || "0");
      var ih = parseFloat(img.getAttribute("height") || "0");
      if (iw > 0 && ih > 0) {
        var ratio = (ih / iw) * HEIGHT_SHRINK;
        if (ratio > MAX_HW + 0.01) ratio = MAX_HW * HEIGHT_SHRINK;
        return colW * ratio;
      }
    }
    var v = tpl.querySelector("video.ltf-masonry-tile__video.is-a");
    if (v) {
      var vw = parseFloat(v.getAttribute("width") || "960");
      var vh = parseFloat(v.getAttribute("height") || "540");
      return colW * ((vh / vw) * HEIGHT_SHRINK);
    }
    return colW * 0.72;
  }

  function buildTrackTileList(order, rot, videoTemplate, colIdx, videoColIdx) {
    var list = rotateArray(order.slice(), rot);
    if (colIdx === videoColIdx && videoTemplate) {
      var copy = list.slice();
      var insertAt = Math.min(3, copy.length);
      copy.splice(insertAt, 0, videoTemplate);
      return copy;
    }
    return list;
  }

  function trackModelFromList(list, colW, gap) {
    var tiles = [];
    var y = 0;
    var maxH = 0;
    var i;
    for (i = 0; i < list.length; i++) {
      var h = templateHeightPx(list[i], colW);
      tiles.push({
        key: seedFromTemplate(list[i]),
        top: y,
        bottom: y + h,
        h: h,
      });
      maxH = Math.max(maxH, h);
      y += h + gap;
    }
    var total = y > 0 ? y - gap : 0;
    return { tiles: tiles, total: total, maxH: maxH };
  }

  function columnPadTop(colIdx, cols, vh) {
    var staggerMul = colIdx === 0 || colIdx === cols - 1 ? 1.08 : 1;
    return staggerPattern[colIdx % staggerPattern.length] * vh * staggerMul;
  }

  function scrollOffsetPx(colIdx, pEff, singleH) {
    var up = colIdx % 2 === 0;
    return up ? pEff * singleH : (1 - pEff) * singleH;
  }

  function visibleSimulated(colIdx, cols, model, padTop, vh, pEff) {
    var singleH = model.total;
    if (singleH < 1) return [];
    var scroll = scrollOffsetPx(colIdx, pEff, singleH);
    var bandTop = padTop;
    var bandBottom = vh;
    var out = [];
    var wrapK;
    for (wrapK = -1; wrapK <= 1; wrapK++) {
      var wrapShift = wrapK * singleH;
      model.tiles.forEach(function (t) {
        var top = padTop + t.top - scroll + wrapShift;
        var bottom = padTop + t.bottom - scroll + wrapShift;
        var overlap = Math.min(bottom, bandBottom) - Math.max(top, bandTop);
        if (overlap < 8) return;
        out.push({
          col: colIdx,
          key: t.key,
          top: top,
          bottom: bottom,
          centerY: (top + bottom) / 2,
        });
      });
    }
    return out;
  }

  function conflictScore(visibleItems, vh) {
    var score = 0;
    var byCol = {};
    visibleItems.forEach(function (it) {
      if (!byCol[it.col]) byCol[it.col] = {};
      byCol[it.col][it.key] = (byCol[it.col][it.key] || 0) + 1;
    });
    Object.keys(byCol).forEach(function (ck) {
      Object.keys(byCol[ck]).forEach(function (k) {
        if (byCol[ck][k] > 1) score += 10000;
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
          if (bandOverlap >= 24) score += 8000;
          continue;
        }
        if (Math.abs(a.centerY - b.centerY) + 1 < vh * CROSS_COL_MIN_SEP && bandOverlap >= 24) {
          score += 800;
        }
      }
    }
    return score;
  }

  function coverageMinSimulated(models, pads, vh, cols, rots, delays, orders, videoTemplate, videoColIdx, colW, gap) {
    var minRatio = 1;
    var step;
    for (step = 0; step < LAYOUT_SAMPLES; step++) {
      var p = (step + 0.5) / LAYOUT_SAMPLES;
      var c;
      for (c = 0; c < cols; c++) {
        var delayFrac = (delays[c] || 0) / LOOP_HALF_DUR;
        var pEff = (p + delayFrac) % 1;
        var model;
        if (models && models.meta) {
          model = modelForColumnPlan(
            orders[c],
            rots[c],
            c,
            models.meta,
            videoTemplate,
            videoColIdx,
            colW,
            gap
          );
        } else {
          var list = buildTrackTileList(orders[c], rots[c], videoTemplate, c, videoColIdx);
          model = trackModelFromList(list, colW, gap);
        }
        var vis = visibleSimulated(c, cols, model, pads[c], vh, pEff);
        var bandTop = pads[c];
        var bandH = Math.max(1, vh - bandTop);
        var intervals = vis
          .map(function (it) {
            return [Math.max(it.top, bandTop), Math.min(it.bottom, vh)];
          })
          .filter(function (iv) {
            return iv[1] > iv[0];
          })
          .sort(function (a, b) {
            return a[0] - b[0];
          });
        var covered = 0;
        var merged = [];
        intervals.forEach(function (iv) {
          if (!merged.length || iv[0] > merged[merged.length - 1][1]) merged.push(iv.slice());
          else merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], iv[1]);
        });
        merged.forEach(function (iv) {
          covered += iv[1] - iv[0];
        });
        var ratio = covered / bandH;
        if (ratio < minRatio) minRatio = ratio;
      }
    }
    return minRatio;
  }

  function buildHeightMapFromModels(models, cols, colW, gap) {
    var map = {};
    var sharedSingleH = 0;
    var c;
    for (c = 0; c < cols; c++) {
      if (!models[c]) continue;
      sharedSingleH = Math.max(sharedSingleH, models[c].total);
      models[c].tiles.forEach(function (t) {
        if (t.key.indexOf("video:") !== 0) map[t.key] = t.h;
      });
    }
    return { heights: map, sharedSingleH: sharedSingleH, colW: colW, gap: gap };
  }

  function modelForColumnPlan(order, rot, colIdx, meta, videoTemplate, videoColIdx, colW, gap) {
    if (!meta) {
      var list0 = buildTrackTileList(order, rot, videoTemplate, colIdx, videoColIdx);
      return trackModelFromList(list0, colW, gap);
    }
    var list = buildTrackTileList(order, rot, videoTemplate, colIdx, videoColIdx);
    var tiles = [];
    var y = 0;
    var i;
    for (i = 0; i < list.length; i++) {
      var key = seedFromTemplate(list[i]);
      var h = meta.heights[key] || templateHeightPx(list[i], meta.colW || colW);
      tiles.push({ key: key, top: y, bottom: y + h, h: h });
      y += h + (meta.gap || gap);
    }
    return { tiles: tiles, total: meta.sharedSingleH || y, maxH: 0 };
  }

  function evaluatePlanWithModels(
    cols,
    vh,
    orders,
    rots,
    delays,
    colModels,
    videoTemplate,
    videoColIdx,
    colW,
    gap
  ) {
    var score = 0;
    var pads = [];
    var c;
    for (c = 0; c < cols; c++) pads[c] = columnPadTop(c, cols, vh);
    for (var step = 0; step < LAYOUT_SAMPLES; step++) {
      var p = (step + 0.5) / LAYOUT_SAMPLES;
      var visible = [];
      for (c = 0; c < cols; c++) {
        var delayFrac = (delays[c] || 0) / LOOP_HALF_DUR;
        var pEff = (p + delayFrac) % 1;
        var model;
        if (colModels && colModels.meta) {
          model = modelForColumnPlan(
            orders[c],
            rots[c],
            c,
            colModels.meta,
            videoTemplate,
            videoColIdx,
            colW,
            gap
          );
        } else if (colModels && colModels[c]) {
          model = colModels[c];
        } else {
          var list = buildTrackTileList(orders[c], rots[c], videoTemplate, c, videoColIdx);
          model = trackModelFromList(list, colW, gap);
        }
        visible = visible.concat(visibleSimulated(c, cols, model, pads[c], vh, pEff));
      }
      score += conflictScore(visible, vh);
    }
    var cov = coverageMinSimulated(
      colModels,
      pads,
      vh,
      cols,
      rots,
      delays,
      orders,
      videoTemplate,
      videoColIdx,
      colW,
      gap
    );
    if (cov < 0.85) score += Math.round((0.85 - cov) * 12000);
    if (colModels && colModels.meta) {
      var cov0 = coverageMinAtStep(
        0,
        colModels,
        pads,
        vh,
        cols,
        rots,
        delays,
        orders,
        videoTemplate,
        videoColIdx,
        colW,
        gap
      );
      if (cov0 < 0.85) score += Math.round((0.85 - cov0) * 15000);
    }
    return score;
  }

  function coverageMinAtStep(step, colModels, pads, vh, cols, rots, delays, orders, videoTemplate, videoColIdx, colW, gap) {
    var p = (step + 0.5) / LAYOUT_SAMPLES;
    var minRatio = 1;
    var c;
    for (c = 0; c < cols; c++) {
      var delayFrac = (delays[c] || 0) / LOOP_HALF_DUR;
      var pEff = (p + delayFrac) % 1;
      var model;
      if (colModels && colModels.meta) {
        model = modelForColumnPlan(
          orders[c],
          rots[c],
          c,
          colModels.meta,
          videoTemplate,
          videoColIdx,
          colW,
          gap
        );
      } else {
        var list = buildTrackTileList(orders[c], rots[c], videoTemplate, c, videoColIdx);
        model = trackModelFromList(list, colW, gap);
      }
      var vis = visibleSimulated(c, cols, model, pads[c], vh, pEff);
      var bandTop = pads[c];
      var bandH = Math.max(1, vh - bandTop);
      var intervals = vis
        .map(function (it) {
          return [Math.max(it.top, bandTop), Math.min(it.bottom, vh)];
        })
        .filter(function (iv) {
          return iv[1] > iv[0];
        });
      var covered = 0;
      intervals.forEach(function (iv) {
        covered += iv[1] - iv[0];
      });
      var ratio = covered / bandH;
      if (ratio < minRatio) minRatio = ratio;
    }
    return minRatio;
  }

  function evaluatePlan(cols, vh, orders, rots, delays, videoTemplate, videoColIdx, colW, gap) {
    return evaluatePlanWithModels(
      cols,
      vh,
      orders,
      rots,
      delays,
      null,
      videoTemplate,
      videoColIdx,
      colW,
      gap
    );
  }

  function optimizeRotsAndDelays(
    cols,
    vh,
    orders,
    rots,
    delays,
    videoTemplate,
    videoColIdx,
    colW,
    gap,
    colModels
  ) {
    var c;
    var r;
    var dStep;
    for (var pass = 0; pass < 3; pass++) {
      for (c = 0; c < cols; c++) {
        var bestR = rots[c];
        var bestScore = evaluatePlanWithModels(
          cols,
          vh,
          orders,
          rots,
          delays,
          colModels,
          videoTemplate,
          videoColIdx,
          colW,
          gap
        );
        for (r = 0; r < orders[c].length; r++) {
          rots[c] = r;
          var sc = evaluatePlanWithModels(
            cols,
            vh,
            orders,
            rots,
            delays,
            colModels,
            videoTemplate,
            videoColIdx,
            colW,
            gap
          );
          if (sc < bestScore) {
            bestScore = sc;
            bestR = r;
          }
        }
        rots[c] = bestR;
      }
      for (c = 0; c < cols; c++) {
        var bestD = delays[c];
        var bestScoreD = evaluatePlanWithModels(
          cols,
          vh,
          orders,
          rots,
          delays,
          colModels,
          videoTemplate,
          videoColIdx,
          colW,
          gap
        );
        var delaySteps = 24;
        for (dStep = 0; dStep < delaySteps; dStep++) {
          delays[c] = (dStep / delaySteps) * LOOP_HALF_DUR;
          var scD = evaluatePlanWithModels(
            cols,
            vh,
            orders,
            rots,
            delays,
            colModels,
            videoTemplate,
            videoColIdx,
            colW,
            gap
          );
          if (scD < bestScoreD) {
            bestScoreD = scD;
            bestD = delays[c];
          }
        }
        delays[c] = bestD;
      }
    }
    return evaluatePlanWithModels(
      cols,
      vh,
      orders,
      rots,
      delays,
      colModels,
      videoTemplate,
      videoColIdx,
      colW,
      gap
    );
  }

  function pickInitialOrders(allImages, cols) {
    var n = allImages.length;
    var step = Math.max(1, Math.ceil(n / cols));
    var orders = [];
    var c;
    for (c = 0; c < cols; c++) {
      orders[c] = rotateArray(allImages.slice(), (c * step) % n);
    }
    return orders;
  }

  function applyLayoutPlan(plan, cols) {
    var c;
    for (c = 0; c < cols; c++) {
      root.setAttribute("data-ltf-col-rot-" + c, String(plan.rots[c]));
      root.setAttribute("data-ltf-col-delay-" + c, plan.delays[c].toFixed(2));
    }
    activeColumnOrders = plan.orders;
    activePhaseDelays = plan.delays.slice();
  }

  function measureDomColumnModels(cols, videoTemplate, videoColIdx, colW, gap) {
    var models = [];
    var c;
    for (c = 0; c < cols; c++) {
      var col = columnsEl.querySelector('[data-ltf-masonry-col-idx="' + c + '"]');
      var track = col && col.querySelector(".ltf-masonry-column__track.is-a");
      if (!track) {
        models[c] = null;
        continue;
      }
      var singleH = parseFloat(track.getAttribute("data-ltf-loop-single-h") || "0");
      var tiles = [];
      var y = 0;
      Array.prototype.forEach.call(track.children, function (child) {
        if (child.getAttribute("data-ltf-loop-clone") === "1") return;
        var h = estimateChildHeight(child, colW, gap);
        if (h < 2) h = child.getBoundingClientRect().height || 0;
        tiles.push({
          key: seedFromTemplate(child),
          top: y,
          bottom: y + h,
          h: h,
        });
        y += h + gap;
      });
      if (singleH < 1) singleH = y > 0 ? y - gap : y;
      models[c] = { tiles: tiles, total: singleH, maxH: 0 };
    }
    return models;
  }

  function layoutSeed(w, cols, vh) {
    return (
      (Math.round(w) * 73856093) ^
      (cols * 19349663) ^
      (Math.round(vh) * 83492791)
    ) >>> 0;
  }

  function runOneLayoutAttempt(allImages, cols, w, n, attempt, videoTemplate, videoColIdx, ctx) {
    var seedBase = layoutSeed(w, cols, ctx.vh);
    var orders = [];
    var rots = [];
    var delays = [];
    var c;
    var independent = attempt % 3 === 2;
    var splitDeck = cols === 2 || attempt % 7 === 6;
    if (splitDeck) {
      var sorted = allImages.slice().sort(function (a, b) {
        return seedFromTemplate(a).localeCompare(seedFromTemplate(b));
      });
      var half = Math.ceil(sorted.length / 2);
      var firstHalf = sorted.slice(0, half);
      var secondHalf = sorted.slice(half);
      for (c = 0; c < cols; c++) {
        orders[c] = shuffleArray(
          cols === 2 ? (c === 0 ? firstHalf : secondHalf) : c % 2 === 0 ? firstHalf : secondHalf,
          (seedBase + attempt * 59 + c * 127) >>> 0
        );
      }
    } else if (independent) {
      for (c = 0; c < cols; c++) {
        orders[c] = shuffleArray(allImages, (seedBase + attempt * 41 + c * 113) >>> 0);
      }
    } else {
      var base = shuffleArray(allImages, (seedBase + cols * 19 + attempt * 37) >>> 0);
      var strideStart = Math.max(1, Math.floor(n / cols));
      var stride;
      for (stride = strideStart; stride <= strideStart + 1; stride++) {
        for (c = 0; c < cols; c++) {
          orders[c] = rotateArray(base.slice(), (c * stride + attempt) % n);
        }
        break;
      }
    }
    for (c = 0; c < cols; c++) {
      if (!orders[c]) orders[c] = allImages.slice();
      rots[c] = (c * 2 + attempt) % n;
      delays[c] = ((c / cols) * LOOP_HALF_DUR * 0.35 + attempt * 0.7) % LOOP_HALF_DUR;
    }
    var sc = optimizeRotsAndDelays(
      cols,
      ctx.vh,
      orders,
      rots,
      delays,
      videoTemplate,
      videoColIdx,
      ctx.colW,
      ctx.gap,
      ctx.colModels
    );
    if (sc < ctx.bestScore) {
      ctx.bestScore = sc;
      ctx.best = {
        orders: orders.map(function (o) {
          return o.slice();
        }),
        rots: rots.slice(),
        delays: delays.slice(),
        score: sc,
      };
    }
    return ctx.bestScore === 0;
  }

  function finalizeLayoutPlan(best, cols, allImages) {
    var c;
    if (!best) {
      best = { orders: [], rots: [], delays: [] };
      for (c = 0; c < cols; c++) {
        best.orders[c] = allImages.slice();
        best.rots[c] = 0;
        best.delays[c] = 0;
      }
    }
    for (c = 0; c < cols; c++) {
      root.setAttribute("data-ltf-col-rot-" + c, String(best.rots[c]));
      root.setAttribute("data-ltf-col-delay-" + c, best.delays[c].toFixed(2));
    }
    activeColumnOrders = best.orders;
    activePhaseDelays = best.delays;
    best.score = best.score || 0;
    return best;
  }

  function solveDeterministicLayout(allImages, cols, w, videoTemplate, videoColIdx, colModels) {
    var n = allImages.length;
    var gap = readGapPx();
    var vh = viewport.clientHeight || 600;
    var colW = cols > 0 ? (w - gap * (cols - 1)) / cols : w;
    var ctx = {
      vh: vh,
      colW: colW,
      gap: gap,
      colModels: colModels,
      best: null,
      bestScore: 1e12,
    };
    var maxAttempts = colModels ? 200 : 8;
    var attempt;
    for (attempt = 0; attempt < maxAttempts; attempt++) {
      if (runOneLayoutAttempt(allImages, cols, w, n, attempt, videoTemplate, videoColIdx, ctx)) break;
    }
    return finalizeLayoutPlan(ctx.best, cols, allImages);
  }

  function solveDeterministicLayoutAsync(allImages, cols, w, videoTemplate, videoColIdx, colModels, done) {
    var n = allImages.length;
    var gap = readGapPx();
    var vh = viewport.clientHeight || 600;
    var colW = cols > 0 ? (w - gap * (cols - 1)) / cols : w;
    var ctx = {
      vh: vh,
      colW: colW,
      gap: gap,
      colModels: colModels,
      best: null,
      bestScore: 1e12,
    };
    var maxAttempts = colModels ? 200 : 8;
    var attempt = 0;

    function slice() {
      var budget = 10;
      var t0 = Date.now();
      while (attempt < maxAttempts && Date.now() - t0 < budget) {
        if (runOneLayoutAttempt(allImages, cols, w, n, attempt, videoTemplate, videoColIdx, ctx)) {
          attempt = maxAttempts;
          break;
        }
        attempt += 1;
      }
      if (attempt >= maxAttempts || ctx.bestScore === 0) {
        done(finalizeLayoutPlan(ctx.best, cols, allImages));
      } else {
        window.setTimeout(slice, 0);
      }
    }
    window.setTimeout(slice, 0);
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

  function finalizeTrackLoop(track, gap, colW, targetSingle) {
    if (track.getAttribute("data-ltf-loop-ready") === "1") return;

    var vh = viewport.clientHeight || 600;
    var metrics = trackSingleCopyHeight(track, gap, colW);
    var minSingle =
      targetSingle != null && targetSingle > 0
        ? targetSingle
        : vh * 1.48 + metrics.maxTile + gap * 10;

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

  function buildColumnsFromTiles(tiles, cols, forcedPlan) {
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
    var columnOrders;
    if (forcedPlan && forcedPlan.orders) {
      applyLayoutPlan(forcedPlan, cols);
      columnOrders = forcedPlan.orders;
    } else {
      columnOrders = pickInitialOrders(allImages, cols);
      var initDelays = [];
      var ic;
      for (ic = 0; ic < cols; ic++) {
        root.setAttribute("data-ltf-col-rot-" + ic, "0");
        initDelays[ic] =
          ic % 2 === 1
            ? LOOP_HALF_DUR * 0.38
            : ((ic / cols) * LOOP_HALF_DUR * 0.35) % LOOP_HALF_DUR;
        root.setAttribute("data-ltf-col-delay-" + ic, initDelays[ic].toFixed(2));
      }
      activeColumnOrders = columnOrders;
      activePhaseDelays = initDelays;
    }

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
      var delay = 0;
      if (activePhaseDelays && activePhaseDelays[i] != null) delay = activePhaseDelays[i];
      else {
        delay = parseFloat(root.getAttribute("data-ltf-col-delay-" + i) || "0") || 0;
      }
      track.style.setProperty("--ltf-loop-dur", LOOP_HALF_DUR.toFixed(2) + "s");
      track.style.setProperty("--ltf-loop-delay", delay.toFixed(2) + "s");
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
    var vh = viewport.clientHeight || 600;
    var tracks = root.querySelectorAll(".ltf-masonry-column__track.is-a");
    var targetSingle = 0;
    Array.prototype.forEach.call(tracks, function (track) {
      var metrics = trackSingleCopyHeight(track, gap, colW);
      targetSingle = Math.max(
        targetSingle,
        Math.max(metrics.total, vh * 1.48 + metrics.maxTile + gap * 10)
      );
    });
    Array.prototype.forEach.call(tracks, function (track) {
      finalizeTrackLoop(track, gap, colW, targetSingle);
    });
    applyLoopTiming();
    wireVideos();
  }

  function auditScoreFromAudit(a) {
    return a.sameCol * 10000 + a.adjacent * 500 + a.nonAdjClose * 50;
  }

  function nudgePhaseDelaysAsync(done) {
    var tracks = columnsEl.querySelectorAll(".ltf-masonry-column__track.is-a");
    var n = tracks.length;
    if (!n || reduced) {
      done();
      return;
    }
    var delays = [];
    var c;
    for (c = 0; c < n; c++) {
      delays[c] =
        parseFloat(getComputedStyle(tracks[c]).getPropertyValue("--ltf-loop-delay")) || 0;
    }
    var bestScore = auditScoreFromAudit(auditVisibleDuplicateIssues(LAYOUT_SAMPLES));
    var pass = 0;
    var col = 0;
    var step = 0;
    var delaySteps = 8;

    function applyStep() {
      if (pass >= 4) {
        done();
        return;
      }
      if (col >= n) {
        pass += 1;
        col = 0;
        window.setTimeout(applyStep, 0);
        return;
      }
      var track = tracks[col];
      var tryDelay = (step / delaySteps) * LOOP_HALF_DUR;
      track.style.setProperty("--ltf-loop-delay", tryDelay.toFixed(2) + "s");
      track.style.animation = "none";
      void track.offsetHeight;
      track.style.animation = "";
      var sc = auditScoreFromAudit(auditVisibleDuplicateIssues(LAYOUT_SAMPLES));
      if (sc < bestScore) {
        bestScore = sc;
        delays[col] = tryDelay;
      }
      step += 1;
      if (step >= delaySteps) {
        tracks[col].style.setProperty("--ltf-loop-delay", delays[col].toFixed(2) + "s");
        col += 1;
        step = 0;
      }
      window.setTimeout(applyStep, 0);
    }
    window.setTimeout(applyStep, 0);
  }

  function nudgePhaseDelaysDom(maxPasses) {
    var tracks = columnsEl.querySelectorAll(".ltf-masonry-column__track.is-a");
    var n = tracks.length;
    if (!n || reduced) return;
    var delays = [];
    var c;
    for (c = 0; c < n; c++) {
      delays[c] =
        parseFloat(getComputedStyle(tracks[c]).getPropertyValue("--ltf-loop-delay")) || 0;
    }
    var bestAudit = auditVisibleDuplicateIssues(LAYOUT_SAMPLES);
    var bestScore = auditScoreFromAudit(bestAudit);
    var pass;
    var delaySteps = Math.max(6, Math.floor(LAYOUT_SAMPLES / 2));
    for (pass = 0; pass < (maxPasses || 3); pass++) {
      for (c = 0; c < n; c++) {
        var track = tracks[c];
        var k;
        for (k = 0; k < delaySteps; k++) {
          var tryDelay = (k / delaySteps) * LOOP_HALF_DUR;
          track.style.setProperty("--ltf-loop-delay", tryDelay.toFixed(2) + "s");
          track.style.animation = "none";
          void track.offsetHeight;
          track.style.animation = "";
          var a = auditVisibleDuplicateIssues(LAYOUT_SAMPLES);
          var sc = auditScoreFromAudit(a);
          if (sc < bestScore) {
            bestScore = sc;
            bestAudit = a;
            delays[c] = tryDelay;
          }
        }
        track.style.setProperty("--ltf-loop-delay", delays[c].toFixed(2) + "s");
        track.style.animation = "none";
        void track.offsetHeight;
        track.style.animation = "";
      }
    }
    if (activePhaseDelays) {
      for (c = 0; c < n; c++) activePhaseDelays[c] = delays[c];
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

  function finalizeLayoutSettled(tiles, cols) {
    root.setAttribute("data-ltf-masonry-layout-settled", "0");
    root.setAttribute("data-ltf-masonry-refine-pending", "1");
    root.querySelectorAll(".ltf-masonry-tile__media.is-a").forEach(capMedia);
    finalizeAllTracks();

    function markSettled() {
      root.removeAttribute("data-ltf-masonry-refine-pending");
      root.setAttribute("data-ltf-masonry-layout-settled", "1");
    }

    if (reduced || !tiles || !cols) {
      markSettled();
      return;
    }

    var parts = splitSourceTiles(tiles);
    var w = viewport.clientWidth;
    var gap = readGapPx();
    var colW = cols > 0 ? (w - gap * (cols - 1)) / cols : w;
    var domModels = measureDomColumnModels(cols, parts.video, 0, colW, gap);
    var modelWrap = domModels.slice();
    modelWrap.meta = buildHeightMapFromModels(domModels, cols, colW, gap);
    solveDeterministicLayoutAsync(parts.images, cols, w, parts.video, 0, modelWrap, function (plan) {
      if (!plan || !plan.orders) {
        markSettled();
        return;
      }

      buildColumnsFromTiles(tiles, cols, plan);
      promoteNearViewportImages();
      whenEagerImagesReady(function () {
        root.querySelectorAll(".ltf-masonry-tile__media.is-a").forEach(capMedia);
        finalizeAllTracks();
        nudgePhaseDelaysAsync(function () {
          markSettled();
        });
      });
    });
  }

  function rebuildLayout() {
    if (!sectionNear && !reduced) return;
    if (root.getAttribute("data-ltf-masonry-refine-pending") === "1") return;
    var w = viewport.clientWidth;
    var cols = columnCount(w);
    var tiles = collectSourceTiles();

    if (!source || !source.querySelector(".ltf-masonry-tile.is-a")) return;

    buildColumnsFromTiles(tiles, cols);
    promoteNearViewportImages();
    whenEagerImagesReady(function () {
      finalizeLayoutSettled(tiles, cols);
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
    var w = viewport.clientWidth;
    var needCols = columnCount(w);
    var haveCols = parseInt(root.getAttribute("data-ltf-masonry-cols") || "0", 10);
    if (
      layoutBuilt &&
      root.getAttribute("data-ltf-masonry-layout-settled") === "1" &&
      root.getAttribute("data-ltf-masonry-refine-pending") !== "1" &&
      needCols === haveCols
    ) {
      promoteNearViewportImages();
      return;
    }
    if (needCols !== haveCols) {
      root.removeAttribute("data-ltf-masonry-refine-pending");
      root.setAttribute("data-ltf-masonry-layout-settled", "0");
    }
    rebuildLayout();
  };
  root.finalizeLtfMasonryV2 = finalizeAllTracks;
  root.promoteLtfMasonryImages = promoteNearViewportImages;

  if (sectionNear || reduced) rebuildLayout();
})();
