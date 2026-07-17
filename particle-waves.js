// <particle-waves> — particle wave field, sized to its host element.
// Canvas-2D rewrite of the original three.js version: identical grid, wave
// motion, size pulsing, and pointer parallax, but drawn as 2D sprites with a
// manual perspective projection. No WebGL and no runtime CDN import — both
// proved fragile and slow in Chrome — and the loop pauses whenever the
// element is off-screen or the tab is hidden.
(function () {
  if (customElements.get('particle-waves')) return;

  class ParticleWaves extends HTMLElement {
    connectedCallback() {
      if (this._started) return;
      this._started = true;
      this.style.display = 'block';
      this.style.overflow = 'hidden';
      this._mouse = { x: 0, y: 0 };
      this._count = 0;
      this._visible = true;
      this._init();
    }

    disconnectedCallback() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
      if (this._ro) this._ro.disconnect();
      if (this._io) this._io.disconnect();
      if (this._onMove) document.removeEventListener('pointermove', this._onMove);
      if (this._onVis) document.removeEventListener('visibilitychange', this._onVis);
      this._started = false;
    }

    _num(attr, fallback) {
      const v = parseFloat(this.getAttribute(attr));
      return isNaN(v) ? fallback : v;
    }

    _init() {
      const density = this._num('density', 40);
      const separation = this._num('separation', 100);
      const amplitude = this._num('amplitude', 50);
      const speed = this._num('speed', 0.08);
      const scale = this._num('scale', 1);
      const color = this.getAttribute('color') || '#ffffff';
      const opacity = this._num('opacity', 0.55);

      const canvas = document.createElement('canvas');
      canvas.style.display = 'block';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      this.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Dot sprite, same as the original three.js CanvasTexture: a filled
      // circle of radius 12 on a 32×32 tile (the sprite quad maps the whole
      // tile, so the visible dot is 75% of the drawn size).
      const tile = document.createElement('canvas');
      tile.width = 32; tile.height = 32;
      const tctx = tile.getContext('2d');
      tctx.fillStyle = color;
      tctx.beginPath();
      tctx.arc(16, 16, 12, 0, Math.PI * 2, true);
      tctx.fill();

      let w = 0, h = 0;
      const resize = () => {
        const nw = this.clientWidth, nh = this.clientHeight;
        if (!nw || !nh) return;
        w = nw; h = nh;
        canvas.width = Math.round(nw * dpr);
        canvas.height = Math.round(nh * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      resize();

      this._onMove = (e) => {
        const r = this.getBoundingClientRect();
        this._mouse.x = (e.clientX - (r.left + r.width / 2)) * 0.6;
        this._mouse.y = (e.clientY - (r.top + r.height / 2)) * 0.4;
      };
      document.addEventListener('pointermove', this._onMove, { passive: true });

      // Camera matches the original: fov 50°, starts at (0, 460, 1200),
      // eased toward the pointer each frame, always looking at the origin.
      const cam = { x: 0, y: 460, z: 1200 };
      const half = density * separation / 2;
      const tanHalfFov = Math.tan(25 * Math.PI / 180);
      const rowSin = new Float64Array(density);
      const colSin = new Float64Array(density);

      const renderFrame = () => {
        if (!w || !h) return;
        cam.x += (this._mouse.x * 0.3 - cam.x) * 0.02;
        cam.y += (460 - this._mouse.y * 0.3 - cam.y) * 0.02;

        // lookAt(origin) basis
        let fx = -cam.x, fy = -cam.y, fz = -cam.z;
        const flen = Math.hypot(fx, fy, fz) || 1;
        fx /= flen; fy /= flen; fz /= flen;
        let rx = -fz, rz = fx;
        const rlen = Math.hypot(rx, rz) || 1;
        rx /= rlen; rz /= rlen;
        const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;

        const focal = (h / 2) / tanHalfFov;
        for (let i = 0; i < density; i++) {
          rowSin[i] = Math.sin((i + this._count) * 0.3);
          colSin[i] = Math.sin((i + this._count) * 0.5);
        }

        ctx.clearRect(0, 0, w, h);
        ctx.globalAlpha = opacity;
        for (let ix = 0; ix < density; ix++) {
          const px = ix * separation - half;
          const a = rowSin[ix];
          for (let iy = 0; iy < density; iy++) {
            const b = colSin[iy];
            const py = -400 + (a + b) * amplitude;
            const pz = iy * separation - half;
            const dx = px - cam.x, dy = py - cam.y, dz = pz - cam.z;
            const vz = dx * fx + dy * fy + dz * fz;
            if (vz < 1) continue;
            const k = focal / vz;
            const sx = w / 2 + (dx * rx + dz * rz) * k;
            const sy = h / 2 - (dx * ux + dy * uy + dz * uz) * k;
            const size = ((a + 1) * 2 + (b + 1) * 2) * 2 * scale * k;
            if (size < 0.4 || sx < -size || sx > w + size || sy < -size || sy > h + size) continue;
            ctx.drawImage(tile, sx - size / 2, sy - size / 2, size, size);
          }
        }
        this._count += speed;
      };

      const reducedMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      let running = false;
      const loop = () => {
        this._raf = requestAnimationFrame(loop);
        renderFrame();
      };
      const start = () => {
        if (running || reducedMotion) return;
        running = true;
        loop();
      };
      const stop = () => {
        running = false;
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = 0;
      };
      const sync = () => {
        if (this._visible && !document.hidden) start(); else stop();
      };

      this._ro = new ResizeObserver(() => { resize(); if (!running) renderFrame(); });
      this._ro.observe(this);
      this._io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { this._visible = e.isIntersecting; });
        sync();
      });
      this._io.observe(this);
      this._onVis = sync;
      document.addEventListener('visibilitychange', this._onVis);

      renderFrame();
      sync();
    }
  }

  customElements.define('particle-waves', ParticleWaves);
})();
