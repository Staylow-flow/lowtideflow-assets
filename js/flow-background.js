/**
 * Lowtideflow — Flow Background
 * Mouse-reactive canvas gradient field inspired by the brand hero palette.
 * Auto-inits on [data-ltf-flow-bg] or .ltf-flow-bg elements.
 */
(function () {
  "use strict";

  var PALETTE = [
    { r: 107, g: 45, b: 158, a: 0.55 },  // purple
    { r: 140, g: 60, b: 190, a: 0.45 },
    { r: 45, g: 180, b: 190, a: 0.5 },   // teal
    { r: 60, g: 220, b: 210, a: 0.4 },
    { r: 30, g: 80, b: 60, a: 0.45 },    // forest green
    { r: 50, g: 120, b: 80, a: 0.35 },
  ];

  var BG = { r: 7, g: 7, b: 13 };

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  function Blob(w, h, index, total) {
    this.x = rand(0.1, 0.9) * w;
    this.y = rand(0.1, 0.9) * h;
    this.baseRadius = rand(0.18, 0.38) * Math.min(w, h);
    this.radius = this.baseRadius;
    this.color = pick(PALETTE);
    this.phase = rand(0, Math.PI * 2);
    this.speed = rand(0.0004, 0.0012);
    this.orbit = rand(20, 80);
    this.blockPhase = rand(0, Math.PI * 2);
    this.blockSpeed = rand(0.0008, 0.002);
    this.aspect = rand(0.7, 1.4);
    this.rotation = rand(0, Math.PI * 2);
    this.rotSpeed = rand(-0.0006, 0.0006);
    this.depth = 0.4 + (index / total) * 0.6;
    this.vx = 0;
    this.vy = 0;
  }

  Blob.prototype.update = function (t, w, h, pointer, dt) {
    var nx = Math.sin(t * this.speed + this.phase) * this.orbit;
    var ny = Math.cos(t * this.speed * 1.3 + this.phase * 1.7) * this.orbit * 0.8;

    var targetX = this.x + nx;
    var targetY = this.y + ny;

    if (pointer.active) {
      var dx = pointer.x - targetX;
      var dy = pointer.y - targetY;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var influence = clamp(1 - dist / (Math.min(w, h) * 0.55), 0, 1);
      var force = influence * 0.08 * this.depth;

      targetX -= (dx / dist) * force * Math.min(w, h) * 0.15;
      targetY -= (dy / dist) * force * Math.min(w, h) * 0.15;

      this.radius = lerp(this.baseRadius, this.baseRadius * 1.25, influence * 0.6);
    } else {
      this.radius = lerp(this.radius, this.baseRadius, 0.04);
    }

    this.vx = lerp(this.vx, (targetX - this.x) * 0.06, 0.12);
    this.vy = lerp(this.vy, (targetY - this.y) * 0.06, 0.12);
    this.x += this.vx;
    this.y += this.vy;

    this.x = clamp(this.x, -this.baseRadius, w + this.baseRadius);
    this.y = clamp(this.y, -this.baseRadius, h + this.baseRadius);

    this.blockAmount = (Math.sin(t * this.blockSpeed + this.blockPhase) + 1) * 0.5;
    this.rotation += this.rotSpeed * dt;
    this.aspect = 0.75 + Math.sin(t * 0.0007 + this.phase) * 0.35;
  };

  Blob.prototype.draw = function (ctx) {
    var c = this.color;
    var block = this.blockAmount;
    var w = this.radius * 2 * this.aspect;
    var h = this.radius * 2 / this.aspect;
    var corner = lerp(this.radius, this.radius * 0.22, block);

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    var grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) * 0.65);
    grad.addColorStop(0, "rgba(" + c.r + "," + c.g + "," + c.b + "," + c.a + ")");
    grad.addColorStop(0.45, "rgba(" + c.r + "," + c.g + "," + c.b + "," + (c.a * 0.35) + ")");
    grad.addColorStop(1, "rgba(" + c.r + "," + c.g + "," + c.b + ",0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(-w * 0.5, -h * 0.5, w, h, corner);
    } else {
      ctx.ellipse(0, 0, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  };

  function FlowBackground(container) {
    this.container = container;
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d", { alpha: false });
    this.blobs = [];
    this.pointer = { x: 0, y: 0, active: false };
    this.running = false;
    this.raf = 0;
    this.time = 0;
    this.last = 0;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.isMobile = window.matchMedia("(max-width: 767px)").matches;

    container.appendChild(this.canvas);
    this.bind();
    this.resize();
    this._frame = this.frame.bind(this);
    if (!this.reducedMotion) this.start();
  }

  FlowBackground.prototype.blobCount = function () {
    if (this.isMobile) return 5;
    if (window.innerWidth < 1200) return 7;
    return 9;
  };

  FlowBackground.prototype.resize = function () {
    var rect = this.container.getBoundingClientRect();
    var parent = this.container.parentElement;
    if ((rect.width < 2 || rect.height < 2) && parent) {
      rect = parent.getBoundingClientRect();
    }
    var dpr = Math.min(window.devicePixelRatio || 1, this.isMobile ? 1.5 : 2);

    this.w = Math.max(rect.width, 1);
    this.h = Math.max(rect.height, 1);
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var count = this.blobCount();
    if (this.blobs.length !== count) {
      this.blobs = [];
      for (var i = 0; i < count; i++) {
        this.blobs.push(new Blob(this.w, this.h, i, count));
      }
    }
  };

  FlowBackground.prototype.bind = function () {
    var self = this;

    this._onResize = function () {
      self.isMobile = window.matchMedia("(max-width: 767px)").matches;
      self.resize();
    };

    this._onMove = function (e) {
      var rect = self.container.getBoundingClientRect();
      self.pointer.x = e.clientX - rect.left;
      self.pointer.y = e.clientY - rect.top;
      self.pointer.active = true;
    };

    this._onLeave = function () {
      self.pointer.active = false;
    };

    this._onTouch = function (e) {
      if (!e.touches[0]) return;
      var rect = self.container.getBoundingClientRect();
      self.pointer.x = e.touches[0].clientX - rect.left;
      self.pointer.y = e.touches[0].clientY - rect.top;
      self.pointer.active = true;
    };

    window.addEventListener("resize", this._onResize);
    window.addEventListener("pointermove", this._onMove, { passive: true });
    window.addEventListener("pointerleave", this._onLeave);
    window.addEventListener("touchstart", this._onTouch, { passive: true });
    window.addEventListener("touchmove", this._onTouch, { passive: true });
    window.addEventListener("touchend", this._onLeave);
  };

  FlowBackground.prototype.drawBackground = function () {
    this.ctx.fillStyle = "rgb(" + BG.r + "," + BG.g + "," + BG.b + ")";
    this.ctx.fillRect(0, 0, this.w, this.h);
  };

  FlowBackground.prototype.frame = function (now) {
    if (!this.running) return;

    var dt = this.last ? now - this.last : 16;
    this.last = now;
    this.time += dt;

    this.drawBackground();

    this.ctx.globalCompositeOperation = "screen";
    for (var i = 0; i < this.blobs.length; i++) {
      this.blobs[i].update(this.time, this.w, this.h, this.pointer, dt);
      this.blobs[i].draw(this.ctx);
    }
    this.ctx.globalCompositeOperation = "source-over";

    this.raf = requestAnimationFrame(this._frame);
  };

  FlowBackground.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this.last = 0;
    this.raf = requestAnimationFrame(this._frame);
  };

  FlowBackground.prototype.destroy = function () {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("pointermove", this._onMove);
    window.removeEventListener("pointerleave", this._onLeave);
    window.removeEventListener("touchstart", this._onTouch);
    window.removeEventListener("touchmove", this._onTouch);
    window.removeEventListener("touchend", this._onLeave);
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  };

  function init() {
    var nodes = document.querySelectorAll("[data-ltf-flow-bg], .ltf-flow-bg");
    if (!nodes.length) {
      var hero = document.querySelector(".ltf-dev-hero");
      if (hero && !hero.querySelector(".ltf-flow-bg")) {
        var fallback = document.createElement("div");
        fallback.className = "ltf-flow-bg";
        fallback.setAttribute("data-ltf-flow-bg", "");
        fallback.setAttribute("aria-hidden", "true");
        hero.insertBefore(fallback, hero.firstChild);
        nodes = document.querySelectorAll(".ltf-flow-bg");
      }
    }
    for (var i = 0; i < nodes.length; i++) {
      if (!nodes[i].__ltfFlow) {
        nodes[i].__ltfFlow = new FlowBackground(nodes[i]);
      }
    }
  }

  function boot() {
    init();
    window.setTimeout(init, 250);
    window.setTimeout(init, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  window.addEventListener("load", boot);

  window.LtfFlowBackground = { init: init, FlowBackground: FlowBackground };
})();
