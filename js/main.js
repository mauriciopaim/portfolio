/* ————————————————————————————————————————————
   The press: three ink threads — cyan, magenta,
   yellow — drift out of register and come back
   into alignment around the cursor.
   ———————————————————————————————————————————— */

import * as THREE from '../vendor/three.module.min.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ——— scroll reveals ——— */
const revealEls = document.querySelectorAll('.reveal');
if (reducedMotion || !('IntersectionObserver' in window)) {
  revealEls.forEach((el) => el.classList.add('in'));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  revealEls.forEach((el) => io.observe(el));
}

/* ——— three.js hero ——— */
const canvas = document.getElementById('press');

if (!reducedMotion && canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (err) {
    canvas.remove();
  }

  if (renderer) {
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 10;

    const INKS = [
      { color: 0x00aeef, dir: -1 },   // cyan plate
      { color: 0xec008c, dir: 1 },    // magenta plate
      { color: 0xffd200, dir: 0.45 }, // yellow plate
    ];
    const SEGS = 150;

    let viewW = 20;
    let viewH = 10;

    function resize() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      viewH = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
      viewW = viewH * camera.aspect;
    }

    // Each ink is drawn twice: a wide soft glow and a bright core.
    // Ribbons are camera-facing strips whose vertices we rewrite each frame.
    function makeRibbon(color, width, opacity) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(SEGS * 2 * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const idx = [];
      for (let i = 0; i < SEGS - 1; i++) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      geo.setIndex(idx);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.width = width;
      scene.add(mesh);
      return mesh;
    }

    const layers = INKS.map((ink) => ({
      ...ink,
      glow: makeRibbon(ink.color, 0.34, 0.10),
      core: makeRibbon(ink.color, 0.055, 0.85),
    }));

    /* pointer → world x/y, smoothed */
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, active: false };
    window.addEventListener('pointermove', (e) => {
      pointer.active = true;
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * viewW;
      pointer.ty = -(e.clientY / window.innerHeight - 0.5) * viewH;
    }, { passive: true });

    const P = new THREE.Vector3();
    const Q = new THREE.Vector3();

    function curvePoint(t, time, layerDir, out) {
      // base thread: a slow wave crossing the screen
      const x = (t - 0.5) * (viewW + 2);
      let y =
        Math.sin(t * 4.1 + time * 0.32) * viewH * 0.045 +
        Math.sin(t * 9.7 - time * 0.21) * viewH * 0.022 +
        Math.sin(t * 1.7 + time * 0.13) * viewH * 0.06;
      y -= viewH * 0.345; // keep the threads in the lower band, clear of the text

      // mis-registration: how far this ink strays from the black line
      const sweep = pointer.active ? pointer.x : Math.sin(time * 0.14) * viewW * 0.3;
      const d = (x - sweep) / (viewW * 0.16);
      const registered = Math.exp(-d * d); // 1 near cursor, 0 far away
      const breathe = 0.75 + 0.25 * Math.sin(time * 0.4 + t * 2.0);
      const spread = viewH * 0.075 * breathe * (1 - 0.92 * registered);

      y += layerDir * spread + (pointer.active ? pointer.y * 0.06 * registered : 0);
      const z = Math.sin(t * 5.3 + time * 0.24 + layerDir) * 0.6;
      out.set(x, y, z);
      return out;
    }

    function updateLayer(layer, time) {
      for (const mesh of [layer.glow, layer.core]) {
        const pos = mesh.geometry.attributes.position.array;
        const hw = mesh.userData.width / 2;
        for (let i = 0; i < SEGS; i++) {
          const t = i / (SEGS - 1);
          curvePoint(t, time, layer.dir, P);
          curvePoint(Math.min(t + 0.01, 1), time, layer.dir, Q);
          // screen-space normal of the thread direction
          let nx = -(Q.y - P.y);
          let ny = Q.x - P.x;
          const len = Math.hypot(nx, ny) || 1;
          nx = (nx / len) * hw;
          ny = (ny / len) * hw;
          const o = i * 6;
          pos[o] = P.x + nx; pos[o + 1] = P.y + ny; pos[o + 2] = P.z;
          pos[o + 3] = P.x - nx; pos[o + 4] = P.y - ny; pos[o + 5] = P.z;
        }
        mesh.geometry.attributes.position.needsUpdate = true;
      }
    }

    let heroVisible = true;
    new IntersectionObserver((entries) => {
      heroVisible = entries[0].isIntersecting;
    }).observe(canvas);

    const clock = new THREE.Clock();
    let elapsed = 0;

    function frame() {
      requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (!heroVisible || document.hidden) return;
      elapsed += dt;

      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;

      layers.forEach((l) => updateLayer(l, elapsed));
      renderer.render(scene, camera);
    }

    resize();
    window.addEventListener('resize', resize);
    frame();
  }
}
