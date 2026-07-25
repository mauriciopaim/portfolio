/* ————————————————————————————————————————————
   The press.

   Three ink threads, cyan, magenta and yellow, running
   out of register across the plate. Where the eye is,
   they line up and print white. No libraries: a few
   hundred lines of canvas, which is the whole point.
   ———————————————————————————————————————————— */

(function () {
  'use strict';

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  /* ——— scroll reveals ——————————————————————————— */
  var revealEls = document.querySelectorAll('.reveal, .register');

  if (reduced || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ——— nav: which plate are we on ————————————————— */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-links a'));
  var marks = navLinks
    .map(function (a) {
      return { link: a, section: document.querySelector(a.getAttribute('href')) };
    })
    .filter(function (m) { return m.section; });

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      root.classList.toggle('scrolled', scrollY > 60);

      var current = null;
      marks.forEach(function (m) {
        if (m.section.getBoundingClientRect().top <= 140) current = m;
      });
      marks.forEach(function (m) {
        if (m === current) m.link.setAttribute('aria-current', 'true');
        else m.link.removeAttribute('aria-current');
      });
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ——— footer utilities ——————————————————————————— */
  var printBtn = document.querySelector('.print-cv');
  if (printBtn) printBtn.addEventListener('click', function () { print(); });

  var copyBtn = document.querySelector('.copy-mail');
  if (copyBtn && navigator.clipboard) {
    copyBtn.addEventListener('click', function () {
      navigator.clipboard.writeText(copyBtn.dataset.copy).then(function () {
        var was = copyBtn.textContent;
        copyBtn.textContent = 'Copied';
        copyBtn.classList.add('copied');
        setTimeout(function () {
          copyBtn.textContent = was;
          copyBtn.classList.remove('copied');
        }, 1600);
      });
    });
  } else if (copyBtn) {
    copyBtn.remove();
  }

  /* ——— the press ——————————————————————————————— */
  var canvas = document.getElementById('press');
  var ctx = canvas && canvas.getContext('2d');
  if (!ctx) { if (canvas) canvas.remove(); return; }

  var INKS = [
    { rgb: '0,174,239', dir: -1 },     // cyan
    { rgb: '236,0,140', dir: 1 },      // magenta
    { rgb: '255,210,0', dir: 0.45 },   // yellow
  ];

  var SEGS = 140;
  var W = 0, H = 0, dpr = 1;
  var band = { y: 0, h: 0 };
  var reg = { x: 0, tx: 0, y: 0, ty: 0, pointer: false };
  var hero = document.querySelector('.hero');
  var heroInner = document.querySelector('.hero-inner');

  function measure() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // keep the threads clear of the type: the band sits between the
    // bottom of the copy and the scroll cue, wherever those land.
    var top = H * 0.62;
    if (heroInner && hero) {
      var a = heroInner.getBoundingClientRect();
      var b = hero.getBoundingClientRect();
      top = a.bottom - b.top + 40;
    }
    var bottom = H - 84;
    if (bottom - top < 90) { top = H * 0.68; bottom = H - 40; }
    band.y = (top + bottom) / 2;
    band.h = Math.max(40, Math.min((bottom - top) / 2, 130));

    if (!reg.pointer) { reg.x = W * 0.62; reg.tx = reg.x; }
    reg.y = reg.ty = 0;
  }

  addEventListener('pointermove', function (e) {
    reg.pointer = true;
    reg.tx = e.clientX;
    reg.ty = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });

  addEventListener('pointerleave', function () { reg.pointer = false; }, { passive: true });

  /* the thread: a slow wave, plus however far this plate has slipped */
  function threadY(t, time, dir) {
    var x = t * W;
    var y =
      Math.sin(t * 4.1 + time * 0.32) * band.h * 0.34 +
      Math.sin(t * 9.7 - time * 0.21) * band.h * 0.16 +
      Math.sin(t * 1.7 + time * 0.13) * band.h * 0.46;

    var d = (x - reg.x) / (W * 0.15);
    var registered = Math.exp(-d * d);          // 1 at the register point, 0 away from it
    var breathe = 0.75 + 0.25 * Math.sin(time * 0.4 + t * 2);
    var spread = band.h * 0.55 * breathe * (1 - 0.94 * registered);

    return band.y + y + dir * spread + reg.y * 14 * registered;
  }

  function stroke(ink, time, width, alpha) {
    ctx.beginPath();
    for (var i = 0; i < SEGS; i++) {
      var t = i / (SEGS - 1);
      var y = threadY(t, time, ink.dir);
      if (i === 0) ctx.moveTo(t * W, y);
      else ctx.lineTo(t * W, y);
    }
    ctx.strokeStyle = 'rgba(' + ink.rgb + ',' + alpha + ')';
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function draw(time) {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    INKS.forEach(function (ink) {
      stroke(ink, time, 26, 0.06);   // the halo the ink leaves in the stock
      stroke(ink, time, 1.6, 0.92);  // the line itself
    });

    // the register gauge: a hairline where the plates agree
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(242,241,236,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(reg.x, band.y - band.h * 1.5);
    ctx.lineTo(reg.x, band.y + band.h * 1.5);
    ctx.stroke();

    // let the threads run off the edges instead of stopping dead
    var fade = Math.min(W * 0.18, 260);
    ctx.globalCompositeOperation = 'destination-out';
    var left = ctx.createLinearGradient(0, 0, fade, 0);
    left.addColorStop(0, 'rgba(0,0,0,1)');
    left.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = left;
    ctx.fillRect(0, 0, fade, H);
    var right = ctx.createLinearGradient(W, 0, W - fade, 0);
    right.addColorStop(0, 'rgba(0,0,0,1)');
    right.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = right;
    ctx.fillRect(W - fade, 0, fade, H);
    ctx.globalCompositeOperation = 'source-over';
  }

  measure();
  addEventListener('resize', function () {
    measure();
    if (reduced) draw(0);
  }, { passive: true });

  if (reduced) {
    reg.x = W * 0.62;
    draw(0);
    return;
  }

  var visible = true;
  var running = false;

  function start() {
    if (running || !visible || document.hidden) return;
    running = true;
    last = 0;
    requestAnimationFrame(frame);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      start();
    }).observe(canvas);
  }
  document.addEventListener('visibilitychange', start);

  var elapsed = 0;
  var last = 0;

  function frame(now) {
    if (!visible || document.hidden) { running = false; return; }
    requestAnimationFrame(frame);

    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;
    elapsed += dt;

    if (!reg.pointer) {
      // with nobody at the press, the register point drifts on its own
      reg.tx = W * (0.5 + 0.32 * Math.sin(elapsed * 0.16));
      reg.ty = 0;
    }
    reg.x += (reg.tx - reg.x) * 0.055;
    reg.y += (reg.ty - reg.y) * 0.055;

    draw(elapsed);
  }

  start();
})();
