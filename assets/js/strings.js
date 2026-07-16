// ============================================================
//  Strings — self-contained cloth/text physics for a container
//  Adapted from Liam Egan's CodePen "Strings" (MIT).
//  No external imports. Scoped to #strings-canvas-wrap.
//  Runs only while the About section is on screen.
// ============================================================
(function () {
  'use strict';

  const wrap = document.getElementById('strings-canvas-wrap');
  if (!wrap) return;

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

  function computeConfig() {
    const rect = wrap.getBoundingClientRect();
    const W = Math.max(200, rect.width);
    const H = Math.max(200, rect.height);
    const bleed = 140;                 // extra canvas room on every side
    const topInset = 30;               // = box height; strings hang from box bottom
    const awidth = W * 0.8;            // strings span 80% of the section width
    const aheight = H - topInset - 20;
    const gridW = Math.max(40, Math.min(100, Math.floor(awidth / 1)));
    const gridH = Math.max(10, Math.min(30, Math.floor(aheight / 5)));
    return {
      // logical section size
      sectionW: W, sectionH: H,
      // canvas is larger than the section on all sides
      canvasW: W + bleed * 2,
      canvasH: H + bleed * 2,
      bleed, topInset,
      awidth, aheight, gridW, gridH,
      gravity: 0.2, damping: 0.99, iterationsPerFrame: 6,
      compressFactor: 0.02, stretchFactor: 1.1,
      mouseSize: 4200, mouseStrength: 2.2,
      cellWidth: awidth / (gridW - 1),
      cellHeight: aheight / (gridH - 1)
    };
  }

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
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
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

    const fontSize = Math.min(9, Math.max(9, cfg.cellHeight * 0.45));
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
    built = true;
  }

  function drawCode() {
    const dpr = cfg.dpr;
    const offX = cfg.bleed + (cfg.sectionW - cfg.awidth) / 2;
    const offY = cfg.bleed + cfg.topInset;
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
      const gx = mouse.x - (cfg.bleed + (cfg.sectionW - cfg.awidth) / 2);
      const gy = mouse.y - (cfg.bleed + cfg.topInset);
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
    const gx = x - (cfg.bleed + (cfg.sectionW - cfg.awidth) / 2);
    const gy = y - (cfg.bleed + cfg.topInset);
    mouse.active = true; mouse.x = x; mouse.y = y;
    for (const p of particles) {
      if (Math.hypot(gx - p.pos.x, gy - p.pos.y) < 18) {
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

  // rebuild on resize (debounced) if currently running
  let resizeT;
  window.addEventListener('resize', () => {
    if (!running) { built = false; return; }
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { build(); }, 200);
  });

  // Run only while the section is visible on screen.
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) start(); else stop();
    }
  }, { threshold: 0.15 });
  io.observe(wrap);
})();