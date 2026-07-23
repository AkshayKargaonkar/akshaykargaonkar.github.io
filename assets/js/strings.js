// ============================================================
//  Strings — self-contained cloth/text physics for a container
//  Adapted from Liam Egan's CodePen "Strings" (MIT).
//  No external imports. Scoped to #strings-canvas-wrap.
//  Runs only while the About section is on screen.
//
//  RESPONSIVE CONTRACT
//  -------------------
//  This file contains no hardcoded layout pixel values for the string
//  origin or width. computeConfig() measures the rendered
//  .strings-overlay-back element (the back half of the umbrella art) and
//  derives:
//      topInset -> the y where the strings hang from (the umbrella rim)
//      awidth   -> how wide the curtain of strings is
//      centerX  -> the horizontal centre of the umbrella
//
//  All the sizing lives in CSS on .strings-figure:
//      --umbrella-w      the single source of scale
//      --umbrella-ratio  the art's height / width
//      --rim-fraction    how far down the art the rim sits (0-1)
//
//  Change the umbrella size in CSS and the strings follow automatically
//  at every breakpoint. Nothing in this file needs editing to rescale.
//
//  --rim-fraction is 0.345 because the source PNGs are 2048x2048 and the
//  canopy content ends at y=706 (706 / 2048 = 0.345).
// ============================================================
(function () {
  'use strict';

  const wrap = document.getElementById('strings-canvas-wrap');
  if (!wrap) return;

  // .strings-figure — the positioning context shared by the canvas wrap
  // and both umbrella overlays. Every measurement is relative to it.
  const figure = wrap.parentElement;
  if (!figure) return;

  // Respect the OS "reduce motion" setting — skip the simulation entirely.
  // The umbrella art still shows, it just doesn't have moving strings.
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  // ---- The text the hanging strings are made of ----------------
  // lowercase, code/skills vibe
  const RIBBON =
    'akshay.build();  mechatronics  robotics  iot  ' +
    'cad  solidworks  ansys  python  c++  arduino  ' +
    'esp32  raspberry-pi  3d-print  pcb  sensors  ' +
    'automation  control-systems  simulation  design  ' +
    'fusion360  matlab  git  linux  firmware  ' +
    'if(idea){ prototype(); iterate(); ship(); }  ' +
    'while(curious){ learn(); create(); }  ' +
    'osaka.jp  //always-building  ';

  // ---- helpers (inlined so there's no CodePen dependency) ------
  function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }
  function getPointID(row, col, gridH) { return col * gridH + row; }

  // read a numeric custom property off .strings-figure, with a fallback
  function cssNumber(name, fallback) {
    const raw = getComputedStyle(figure).getPropertyValue(name);
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  // ---- tiny 2D vector ------------------------------------------
  class Vec2 {
    constructor(x = 0, y = 0) { this.x = x; this.y = y; }
    reset(x = 0, y = 0) { this.x = x; this.y = y; }
    get array() { return [this.x, this.y]; }
    get lengthSquared() { return this.x * this.x + this.y * this.y; }
    get length() { return Math.hypot(this.x, this.y); }
    get angle() { return Math.atan2(this.y, this.x); }
    clone() { return new Vec2(this.x, this.y); }
    subtractNew(v) { return new Vec2(this.x - v.x, this.y - v.y); }
    add(v) { this.x += v.x; this.y += v.y; return this; }
  }

  class Particle {
    constructor({ x, y, pinned, id, char }) {
      this.pos = new Vec2(x, y);
      this.oldPos = new Vec2(x, y);
      this.acceleration = new Vec2();
      this.pinned = pinned;
      this.id = id;
      this.char = char;
      this.downConstraint = null;
    }
    update(delta, cfg) {
      if (this.pinned) { this.acceleration.reset(); return; }
      const vx = (this.pos.x - this.oldPos.x) * cfg.damping;
      const vy = (this.pos.y - this.oldPos.y) * cfg.damping;
      this.oldPos.reset(this.pos.x, this.pos.y);
      const dd = delta * delta;
      const g = cfg.gravity / dd;
      this.pos.x += vx + this.acceleration.x * dd;
      this.pos.y += vy + (this.acceleration.y + g) * dd;
      this.acceleration.reset();
    }
    applyForce(v) { this.acceleration.add(v); }
  }

  class Constraint {
    constructor({ p1, p2, length, compressFactor, stretchFactor, isSpacer }) {
      this.p1 = p1; this.p2 = p2; this.length = length;
      this.isSpacer = !!isSpacer;
      this.minLength = length * compressFactor;
      this.maxLength = length * stretchFactor;
    }
    solve() {
      const dx = this.p2.pos.x - this.p1.pos.x;
      const dy = this.p2.pos.y - this.p1.pos.y;
      const distance = Math.hypot(dx, dy);
      if (distance === 0) return;
      let target = this.length;
      if (distance < this.minLength) target = this.minLength;
      else if (distance > this.maxLength) target = this.maxLength;
      else return;
      const percent = (target - distance) / distance / 2;
      const ox = dx * percent, oy = dy * percent;
      if (!this.p1.pinned) { this.p1.pos.x -= ox; this.p1.pos.y -= oy; }
      if (!this.p2.pinned) { this.p2.pos.x += ox; this.p2.pos.y += oy; }
    }
  }

  // ---- state that persists across start/stop -------------------
  let c, ctx, rafID = null, running = false, built = false;
  let particles = [], constraints = [];
  let charCanvases = {};
  let cfg, lastDelta = 0;
  const mouse = { x: -1e9, y: -1e9, active: false, grabbed: null };

  /**
   * Measure where the umbrella's bottom rim actually is right now, and how
   * wide the umbrella actually is, in CSS pixels relative to the top-left
   * of .strings-figure.
   *
   * This is the entire responsive mechanism. CSS decides the umbrella size
   * via --umbrella-w; this function reads the result back. Because both
   * overlay images share identical geometry, measuring the back one also
   * tells us exactly where the front one is, so the strings stay registered
   * with both halves of the art at any width.
   */
  function measureUmbrella(fallbackW) {
    const fallback = {
      topInset: 120,
      awidth: fallbackW * 0.6,
      centerX: fallbackW / 2
    };

    const overlay = figure.querySelector('.strings-overlay-back');
    if (!overlay) return fallback;

    const oRect = overlay.getBoundingClientRect();
    const fRect = figure.getBoundingClientRect();

    // If the image hasn't laid out yet its box can be zero-sized. Use the
    // fallback for now; the load handler further down rebuilds once it's real.
    if (oRect.width < 2 || oRect.height < 2) return fallback;

    // how far down the art box the canopy rim sits (0 = top, 1 = bottom)
    const rimFraction = cssNumber('--rim-fraction', 0.345);

    // how much of the umbrella width the strings span. Slightly inside the
    // outer edge so they read as hanging from the canopy, not from thin air.
    const spanFraction = cssNumber('--string-span', 0.92);

    return {
      topInset: (oRect.top - fRect.top) + oRect.height * rimFraction,
      awidth: oRect.width * spanFraction,
      centerX: (oRect.left - fRect.left) + oRect.width / 2
    };
  }

  function computeConfig() {
    const rect = wrap.getBoundingClientRect();
    const W = Math.max(200, rect.width);
    const H = Math.max(200, rect.height);
    const bleed = 100;                 // extra canvas room on every side

    const um = measureUmbrella(W);
    const topInset = um.topInset;
    const awidth = um.awidth;
    const centerX = um.centerX;

    // whatever vertical room is left below the rim, minus a little breathing
    // space so the longest strings don't run into the section edge
    // How long the strings are at rest. This is an explicit input read from
    // CSS (--strings-drop), NOT "whatever space is left over". Deriving it
    // from the figure height was circular: the figure height came from the
    // drop, and the drop came from the figure height, so gravity always
    // stretched the strings past the box and they got clipped.
    //
    // The figure reserves --strings-drop plus --stretch-room below the rim,
    // so the fully extended strings always fit inside it.
    const restDrop = cssNumber('--strings-drop-px', 0)
      || Math.max(100, H - topInset - 20);
    const aheight = restDrop;

    // grid density follows physical size, so a small umbrella on a phone
    // doesn't carry the same particle count as a wide desktop one
    const gridW = Math.max(14, Math.min(80, Math.floor(awidth / 7)));
    const gridH = Math.max(6, Math.min(40, Math.floor(aheight / 3)));

    return {
      // logical section size
      sectionW: W, sectionH: H,
      // canvas is larger than the section on all sides
      canvasW: W + bleed * 2,
      canvasH: H + bleed * 2,
      bleed, topInset, centerX,
      awidth, aheight, gridW, gridH,
      gravity: 0.2, damping: 0.99, iterationsPerFrame: 3,
      compressFactor: 0.02, stretchFactor: 1.1,
      mouseSize: 4200, mouseStrength: 2.2,
      cellWidth: awidth / (gridW - 1),
      cellHeight: aheight / (gridH - 1)
    };
  }

  // Single place that converts grid space -> canvas space. Both the renderer
  // and the pointer hit-testing use these, so they can never disagree about
  // where a particle is on screen.
  function originX() { return cfg.bleed + cfg.centerX - cfg.awidth / 2; }
  function originY() { return cfg.bleed + cfg.topInset; }

  function buildGlyphs(fontSize, dpr) {
    charCanvases = {};
    dpr = dpr || 1;
    // pull colour + font from CSS vars so it matches .about-text exactly
    const styles = getComputedStyle(wrap);
    const color = styles.getPropertyValue('--strings-ink').trim() || 'hsl(0,0%,84%)';
    const family = styles.getPropertyValue('--strings-font').trim() || "'Poppins', sans-serif";
    const weight = styles.getPropertyValue('--strings-weight').trim() || '300';
    const box = Math.ceil(fontSize * 1.6 * dpr);   // device-pixel raster
    for (const ch of new Set(RIBBON)) {
      if (ch === ' ') continue;
      const off = document.createElement('canvas');
      off.width = off.height = box;
      const octx = off.getContext('2d');
      octx.font = `${weight} ${fontSize * dpr}px ${family}`;
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillStyle = color;
      octx.fillText(ch, box / 2, box / 2);
      charCanvases[ch] = off;
    }
  }

  function build() {
    cfg = computeConfig();
    wrap._stringsCfg = cfg;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    // backing store at device resolution...
    c.width = Math.round(cfg.canvasW * dpr);
    c.height = Math.round(cfg.canvasH * dpr);
    // CSS box at logical (bleed-inclusive) size, offset so the section area
    // stays centered while the canvas extends beyond it on every side
    c.style.width = cfg.canvasW + 'px';
    c.style.height = cfg.canvasH + 'px';
    c.style.left = -cfg.bleed + 'px';
    c.style.top = -cfg.bleed + 'px';
    // scale the drawing context so all existing CSS-pixel coords render crisply
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cfg.dpr = dpr;

    // glyph size follows cell size so the text stays legible but proportionate
    // when the umbrella shrinks on a phone
    const fontSize = Math.max(6, Math.min(9, cfg.cellHeight * 0.5));
    buildGlyphs(fontSize, dpr);

    particles = [];
    constraints = [];
    const { gridW, gridH, cellWidth, cellHeight, compressFactor, stretchFactor } = cfg;

    for (let i = 0; i < gridW; i++) {
      for (let j = 0; j < gridH; j++) {
        const id = getPointID(j, i, gridH);
        const pinned = j === 0;
        const idx = (i + j * gridW) % RIBBON.length;
        const char = RIBBON[idx] || ' ';
        particles.push(new Particle({ x: i * cellWidth, y: j * cellHeight, pinned, id, char }));
      }
    }
    for (let i = 0; i < gridW; i++) {
      for (let j = 0; j < gridH; j++) {
        const p = particles[getPointID(j, i, gridH)];
        if (j < gridH - 1) {
          const bottom = particles[getPointID(j + 1, i, gridH)];
          const cst = new Constraint({ p1: p, p2: bottom, length: cellHeight, compressFactor, stretchFactor });
          constraints.push(cst);
          p.downConstraint = cst;
        }
        if (i < gridW - 1) {
          const right = particles[getPointID(j, i + 1, gridH)];
          constraints.push(new Constraint({
            p1: p, p2: right, length: cellWidth,
            compressFactor: 0.6, stretchFactor: 4, isSpacer: true
          }));
        }
      }
    }
    const ctrlEl = document.getElementById('strings-controls');
    if (ctrlEl) {
      ctrlEl.querySelectorAll('input[data-phys]').forEach((s) => {
        cfg[s.dataset.phys] = parseFloat(s.value);
      });
    }
    built = true;
  }

  function drawCode() {
    const dpr = cfg.dpr;
    const offX = originX();
    const offY = originY();
    for (const p of particles) {
      if (!p.char || p.char === ' ') continue;
      const img = charCanvases[p.char];
      if (!img) continue;
      const w = img.width / dpr;       // logical size
      const halfW = w / 2;
      let cos = 1, sin = 0;
      const cst = p.downConstraint;
      if (cst) {
        const dx = cst.p2.pos.x - cst.p1.pos.x;
        const dy = cst.p2.pos.y - cst.p1.pos.y;
        const angle = Math.atan2(dy, dx) - Math.PI / 2;
        cos = Math.cos(angle); sin = Math.sin(angle);
      }
      const tx = (p.pos.x + offX) * dpr;
      const ty = (p.pos.y + offY) * dpr;
      ctx.setTransform(cos * dpr, sin * dpr, -sin * dpr, cos * dpr, tx, ty);
      ctx.drawImage(img, -halfW, -halfW, w, w);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function loop(delta) {
    rafID = requestAnimationFrame(loop);
    const dt = Math.max(1, delta - lastDelta);
    lastDelta = delta;

    ctx.clearRect(0, 0, cfg.canvasW, cfg.canvasH);

    // mouse forces
    if (mouse.active) {
      const gx = mouse.x - originX();
      const gy = mouse.y - originY();
      if (mouse.grabbed) {
        mouse.grabbed.pos.reset(gx, gy);
        mouse.grabbed.oldPos.reset(gx, gy);
      }
      for (const p of particles) {
        const diff = new Vec2(gx - p.pos.x, gy - p.pos.y);
        const ls = diff.lengthSquared;
        if (ls < cfg.mouseSize) {
          const a = diff.angle - Math.PI;
          const strength = smoothstep(cfg.mouseSize, -2000, ls) * cfg.mouseStrength / 300;
          p.applyForce(new Vec2(Math.cos(a) * strength, Math.sin(a) * strength));
        }
      }
    }

    for (const p of particles) p.update(dt, cfg);
    for (let k = 0; k < cfg.iterationsPerFrame; k++) {
      for (let j = 0; j < constraints.length; j++) constraints[j].solve();
    }
    drawCode();
  }

  // ---- pointer handling (scoped to the wrap, not the document) --
  function toLocal(e) {
    const r = c.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (cfg.canvasW / r.width),
      y: (e.clientY - r.top) * (cfg.canvasH / r.height)
    };
  }
  function onDown(e) {
    const { x, y } = toLocal(e);
    const gx = x - originX();
    const gy = y - originY();
    mouse.active = true; mouse.x = x; mouse.y = y;
    // grab radius follows cell size so grabbing feels the same on a phone
    // as it does on a wide desktop layout
    const grabR = Math.max(12, Math.min(28, cfg.cellHeight * 2));
    for (const p of particles) {
      if (Math.hypot(gx - p.pos.x, gy - p.pos.y) < grabR) {
        mouse.grabbed = p;
        p._wasPinned = p.pinned;
        p.pinned = true;
        break;
      }
    }
  }
  function onMove(e) {
    const { x, y } = toLocal(e);
    mouse.active = true; mouse.x = x; mouse.y = y;
  }
  function onUp() {
    if (mouse.grabbed) {
      mouse.grabbed.pinned = mouse.grabbed._wasPinned;
      mouse.grabbed = null;
    }
  }
  function onLeave() { mouse.active = false; mouse.grabbed && onUp(); }

  function bind() {
    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    c.addEventListener('pointerleave', onLeave);
  }
  function unbind() {
    c.removeEventListener('pointerdown', onDown);
    c.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    c.removeEventListener('pointerleave', onLeave);
  }

  // ---- lifecycle -----------------------------------------------
  function start() {
    if (running) return;
    if (!c) {
      c = document.createElement('canvas');
      c.style.position = 'absolute';
      c.style.display = 'block';
      c.style.touchAction = 'none';
      wrap.appendChild(c);
      ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
    build();
    bind();
    running = true;
    lastDelta = performance.now();
    rafID = requestAnimationFrame(loop);
  }
  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafID);
    rafID = null;
    unbind();
    mouse.active = false; mouse.grabbed = null;
  }

  // ---- rebuild triggers ----------------------------------------
  // Three things can change the umbrella's measured box. All of them need
  // to trigger a rebuild, otherwise the strings detach from the rim.

  // 1) Viewport width changes. Height-only changes are ignored because
  //    mobile browsers fire resize constantly as the URL bar shows/hides,
  //    and rebuilding on every one of those is wasteful and visibly janky.
  let resizeT;
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    if (!running) { built = false; return; }
    clearTimeout(resizeT);
    resizeT = setTimeout(build, 200);
  });

  // 2) The umbrella image finishing decode. Before it loads its box can
  //    measure zero, which would put the string origin in the wrong place.
  const overlayImg = figure.querySelector('.strings-overlay-back img');
  if (overlayImg && !overlayImg.complete) {
    overlayImg.addEventListener('load', () => { if (running) build(); }, { once: true });
  }

  // 3) Any layout change to the figure itself — breakpoint crossovers, the
  //    sidebar expanding, webfonts landing and shifting things around.
  if (typeof ResizeObserver !== 'undefined') {
    let roT, lastFigW = 0, lastFigH = 0;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      // ignore sub-pixel jitter, only react to real geometry changes
      if (Math.abs(r.width - lastFigW) < 2 && Math.abs(r.height - lastFigH) < 2) return;
      lastFigW = r.width;
      lastFigH = r.height;
      if (!running) return;
      clearTimeout(roT);
      roT = setTimeout(build, 150);
    });
    ro.observe(figure);
  }

  // Run only while the section is visible on screen.
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) start(); else stop();
    }
  }, { threshold: 0.15 });
  io.observe(wrap);


  // ---- live physics controls -----------------------------------
  const controls = document.getElementById('strings-controls');
  if (controls) {
    controls.querySelectorAll('input[data-phys]').forEach((slider) => {
      const key = slider.dataset.phys;
      const out = slider.parentElement.querySelector('.strings-ctrl-val');

      const fmt = (v) => {
        if (key === 'gravity') return v.toFixed(2);
        if (key === 'damping') return v.toFixed(3);
        if (key === 'mouseSize') return Math.round(v).toString();
        return v.toFixed(1);
      };

      slider.addEventListener('input', () => {
        const val = parseFloat(slider.value);
        if (out) out.textContent = fmt(val);
        // cfg is rebuilt on resize, so re-read the live one each time
        const liveCfg = wrap._stringsCfg;
        if (liveCfg) liveCfg[key] = val;
      });
    });
  }
})();