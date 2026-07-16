// <particle-waves> — Three.js particle wave field, sized to its host element.
// White dot sprites on transparent background, sine-wave motion, pointer parallax.
(function () {
  if (customElements.get('particle-waves')) return;

  const THREE_URL = 'https://unpkg.com/three@0.160.0/build/three.module.js';
  let threePromise = null;
  const loadThree = () => {
    if (!threePromise) threePromise = import(THREE_URL);
    return threePromise;
  };

  class ParticleWaves extends HTMLElement {
    connectedCallback() {
      if (this._started) return;
      this._started = true;
      this.style.display = 'block';
      this.style.overflow = 'hidden';
      this._mouse = { x: 0, y: 0 };
      this._count = 0;
      loadThree().then((THREE) => {
        if (!this.isConnected) return;
        this._init(THREE);
      });
    }

    disconnectedCallback() {
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this._ro) this._ro.disconnect();
      if (this._onMove) document.removeEventListener('pointermove', this._onMove);
      if (this._renderer) this._renderer.dispose();
      this._started = false;
    }

    _num(attr, fallback) {
      const v = parseFloat(this.getAttribute(attr));
      return isNaN(v) ? fallback : v;
    }

    _init(THREE) {
      const density = this._num('density', 40);
      const separation = this._num('separation', 100);
      const amplitude = this._num('amplitude', 50);
      const speed = this._num('speed', 0.08);
      const scale = this._num('scale', 1);
      const color = this.getAttribute('color') || '#ffffff';
      const opacity = this._num('opacity', 0.55);

      const w = this.clientWidth || 800;
      const h = this.clientHeight || 600;

      const camera = new THREE.PerspectiveCamera(50, w / h, 1, 10000);
      camera.position.set(0, 460, 1200);
      this._camera = camera;

      const scene = new THREE.Scene();
      this._scene = scene;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h);
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.style.display = 'block';
      this._renderer = renderer;
      this.appendChild(renderer.domElement);

      // dot sprite texture
      const canvas = document.createElement('canvas');
      canvas.width = 32; canvas.height = 32;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(16, 16, 12, 0, Math.PI * 2, true);
      ctx.fill();
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity });

      this._particles = [];
      for (let ix = 0; ix < density; ix++) {
        for (let iy = 0; iy < density; iy++) {
          const p = new THREE.Sprite(material);
          p.position.x = ix * separation - (density * separation) / 2;
          p.position.z = iy * separation - (density * separation) / 2;
          p.position.y = -400;
          p.scale.setScalar(10 * scale);
          this._particles.push(p);
          scene.add(p);
        }
      }

      this._onMove = (e) => {
        const r = this.getBoundingClientRect();
        this._mouse.x = (e.clientX - (r.left + r.width / 2)) * 0.6;
        this._mouse.y = (e.clientY - (r.top + r.height / 2)) * 0.4;
      };
      document.addEventListener('pointermove', this._onMove, { passive: true });

      this._ro = new ResizeObserver(() => {
        const nw = this.clientWidth, nh = this.clientHeight;
        if (!nw || !nh) return;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
      });
      this._ro.observe(this);

      const animate = () => {
        this._raf = requestAnimationFrame(animate);
        camera.position.x += (this._mouse.x * 0.3 - camera.position.x) * 0.02;
        camera.position.y += (460 - this._mouse.y * 0.3 - camera.position.y) * 0.02;
        camera.lookAt(scene.position);

        let i = 0;
        for (let ix = 0; ix < density; ix++) {
          for (let iy = 0; iy < density; iy++) {
            const p = this._particles[i++];
            p.position.y = -400 +
              Math.sin((ix + this._count) * 0.3) * amplitude +
              Math.sin((iy + this._count) * 0.5) * amplitude;
            const s = (Math.sin((ix + this._count) * 0.3) + 1) * 2 +
                      (Math.sin((iy + this._count) * 0.5) + 1) * 2;
            p.scale.setScalar(s * 2 * scale);
          }
        }
        renderer.render(scene, camera);
        this._count += speed;
      };
      animate();
    }
  }

  customElements.define('particle-waves', ParticleWaves);
})();
