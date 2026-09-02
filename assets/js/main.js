/* ── THEME TOGGLE ── */
const html = document.documentElement;
const savedTheme = localStorage.getItem('em-theme') || 'light';
html.setAttribute('data-theme', savedTheme);

function toggleTheme() {
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('em-theme', next);
}
document.getElementById('themeToggle').addEventListener('click', toggleTheme);
document.getElementById('themeToggleMobile').addEventListener('click', toggleTheme);

/* ── CUSTOM CURSOR ── */
const cur  = document.getElementById('cursor');
const ring = document.getElementById('cursor-ring');
let mx=0,my=0,rx=0,ry=0;
document.addEventListener('mousemove', e => { mx=e.clientX; my=e.clientY; });
(function loop(){
  rx += (mx-rx)*.13; ry += (my-ry)*.13;
  cur.style.transform  = `translate(${mx-4}px,${my-4}px)`;
  const rr = ring.offsetWidth / 2;
  ring.style.transform = `translate(${rx-rr}px,${ry-rr}px)`;
  requestAnimationFrame(loop);
})();

/* ── NAVBAR SCROLL ── */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => navbar.classList.toggle('scrolled', window.scrollY > 40), { passive:true });

/* ── HAMBURGER ── */
const burger   = document.getElementById('hamburger');
const mobileNav = document.getElementById('mobileNav');
const overlay  = document.getElementById('overlay');
function closeMobile(){ mobileNav.classList.remove('open'); overlay.classList.remove('open'); burger.classList.remove('open'); }
burger.addEventListener('click', () => { mobileNav.classList.toggle('open'); overlay.classList.toggle('open'); burger.classList.toggle('open'); });
overlay.addEventListener('click', closeMobile);
document.querySelectorAll('.mob-link').forEach(a => a.addEventListener('click', closeMobile));

/* ── SCROLL REVEAL ── */
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('visible'); revealObs.unobserve(e.target); }});
}, { threshold:.1 });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

/* ── SKILL BARS ── */
const skillObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if(e.isIntersecting){
      e.target.querySelectorAll('.skill-bar[data-width]').forEach(b => b.style.width = b.dataset.width + '%');
      skillObs.unobserve(e.target);
    }
  });
}, { threshold:.25 });
document.querySelectorAll('.skills-grid > div').forEach(el => skillObs.observe(el));

/* ── ACTIVE NAV ── */
const sections = document.querySelectorAll('section[id]');
const navAs    = document.querySelectorAll('.nav-links a');
window.addEventListener('scroll', () => {
  let cur = '';
  sections.forEach(s => { if(window.scrollY >= s.offsetTop - 220) cur = s.id; });
  navAs.forEach(a => { a.style.color = a.getAttribute('href') === `#${cur}` ? 'var(--amber)' : ''; });
}, { passive:true });

/* ── PARALLAX BLOBS ── */
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  const b1 = document.querySelector('.hero-blob-1');
  const b2 = document.querySelector('.hero-blob-2');
  if(b1) b1.style.transform = `translateY(${y*.2}px)`;
  if(b2) b2.style.transform = `translateY(${-y*.12}px)`;
}, { passive:true });

/* ── 3D INTERACTIVE CARD PARALLAX TILT ── */
document.querySelectorAll('.project-card, .stat-card, .cert-card, .org-card, .edu-card, .hero-code, .terminal').forEach(card => {
  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;
    card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-6px)`;
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
  });
});

/* ════════════════════════════════════════════════════════════
   CINEMATIC LAYER
   preloader · masked titles · counters · magnetic buttons
   cursor states · spotlight · scroll progress · timeline draw
════════════════════════════════════════════════════════════ */
const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── PRELOADER ── */
(function preloader() {
  const pre = document.getElementById('preloader');
  const fill = document.getElementById('preFill');
  const pct = document.getElementById('prePct');
  const msg = document.getElementById('preMsg');
  if (!pre) { document.body.classList.add('loaded'); return; }

  const finish = () => {
    document.body.classList.remove('pre-lock');
    document.body.classList.add('loaded');
    pre.classList.add('done');
    setTimeout(() => pre.classList.add('gone'), 1500);
  };

  if (REDUCE) { finish(); return; }

  const steps = ['booting', 'loading assets', 'compiling ui', 'ready'];
  const DURATION = 1200;   // progres berbasis waktu, kebal throttling setInterval
  const HARD_STOP = 3000;
  const t0 = performance.now();
  let done = false;

  const end = () => { if (!done) { done = true; finish(); } };

  const tick = now => {
    if (done) return;
    const p = Math.min(100, ((now - t0) / DURATION) * 100);
    fill.style.width = p + '%';
    pct.textContent = Math.round(p) + '%';
    msg.textContent = steps[Math.min(steps.length - 1, Math.floor(p / 26))];
    if (p >= 100) setTimeout(end, 220);
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // failsafe: rAF berhenti kalau tab disembunyikan, jadi tetap pasang batas keras
  setTimeout(end, HARD_STOP);
})();

/* ── SCROLL PROGRESS ── */
(function scrollProgress() {
  const bar = document.getElementById('scrollProgBar');
  if (!bar) return;
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
})();

/* ── MASKED SECTION TITLES ── */
(function maskedTitles() {
  const titles = document.querySelectorAll('.section-title');
  titles.forEach(t => {
    const parts = t.innerHTML.split(/<br\s*\/?>/i);
    t.innerHTML = parts
      .map((part, i) =>
        '<span class="ln-mask"><span class="ln-in" style="transition-delay:' +
        (i * 95) + 'ms">' + part + '</span></span>')
      .join('');
  });

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('ln-go'); obs.unobserve(e.target); }
    });
  }, { threshold: .25 });
  titles.forEach(t => obs.observe(t));
})();

/* ── COUNT-UP STATS ── */
(function counters() {
  const nums = document.querySelectorAll('.stat-num');
  const run = el => {
    const m = el.textContent.trim().match(/^([^\d]*)([\d.]+)(.*)$/);
    if (!m) return;
    const [, pre, raw, suf] = m;
    const target = parseFloat(raw);
    const dec = (raw.split('.')[1] || '').length;
    if (REDUCE) return;
    const dur = 1500, t0 = performance.now();
    const tick = now => {
      const k = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = pre + (target * eased).toFixed(dec) + suf;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { run(e.target); obs.unobserve(e.target); }
    });
  }, { threshold: .6 });
  nums.forEach(n => obs.observe(n));
})();

/* ── TIMELINE DRAW-IN ── */
(function timelineDraw() {
  const tl = document.querySelector('.timeline');
  if (!tl) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { tl.classList.add('drawn'); obs.unobserve(tl); }
    });
  }, { threshold: .12 });
  obs.observe(tl);
})();

/* ── MAGNETIC BUTTONS ── */
(function magnetic() {
  if (REDUCE || window.matchMedia('(pointer: coarse)').matches) return;
  const bind = (el, strength, lift) => {
    el.classList.add('magnetic');
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * strength;
      const y = (e.clientY - r.top - r.height / 2) * strength;
      el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + (y + lift).toFixed(1) + 'px,0)';
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  };
  document.querySelectorAll('.btn').forEach(el => bind(el, .3, -2));
  document.querySelectorAll('.contact-card').forEach(el => bind(el, .16, -5));
})();

/* ── CURSOR: VIEW STATE OVER PROJECT CARDS ── */
(function cursorStates() {
  const label = document.getElementById('cursor-label');
  if (!label) return;
  document.querySelectorAll('.project-card:not(.project-cta)').forEach(card => {
    card.addEventListener('mouseenter', () => {
      label.textContent = 'View ↗';
      document.body.classList.add('cur-view');
    });
    card.addEventListener('mouseleave', () => document.body.classList.remove('cur-view'));
  });
})();

/* ── PROJECT CARD CURSOR SPOTLIGHT ── */
document.querySelectorAll('.project-card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    card.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });
});

/* ── HERO SCROLL FADE ── */
(function heroFade() {
  const inner = document.querySelector('.hero-inner');
  if (!inner || REDUCE) return;
  let ticking = false;
  const apply = () => {
    const h = window.innerHeight;
    const k = Math.min(1, window.scrollY / (h * .85));
    inner.style.opacity = (1 - k * .95).toFixed(3);
    inner.style.transform = 'translate3d(0,' + (k * 70).toFixed(1) + 'px,0) scale(' + (1 - k * .045).toFixed(4) + ')';
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (window.scrollY > window.innerHeight * 1.1) return;
    if (!ticking) { ticking = true; requestAnimationFrame(apply); }
  }, { passive: true });
})();

/* ── FLOATING BUTTONS ── */
(function fabs() {
  const stack = document.getElementById('fabStack');
  const top = document.getElementById('backToTop');
  if (!stack) return;

  const update = () => stack.classList.toggle('show', window.scrollY > window.innerHeight * 0.55);
  window.addEventListener('scroll', update, { passive: true });
  update();

  if (top) top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: REDUCE ? 'auto' : 'smooth' }));
})();

/* ── EMBER TRAIL: partikel bara yang mengikuti kursor ── */
(function emberTrail() {
  const cv = document.getElementById('sparkCanvas');
  if (!cv || REDUCE || window.matchMedia('(pointer: coarse)').matches) return;

  const ctx = cv.getContext('2d', { alpha: true });
  let W = 0, H = 0;

  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // sprite cahaya dibuat sekali di muka — jauh lebih murah daripada shadowBlur tiap frame
  const PALETTE = ['232,146,42', '245,184,106', '61,184,160', '255,214,150'];
  const SPRITE = 34;
  const sprites = PALETTE.map(rgb => {
    const c = document.createElement('canvas');
    c.width = c.height = SPRITE;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
    grad.addColorStop(0, 'rgba(' + rgb + ',1)');
    grad.addColorStop(.35, 'rgba(' + rgb + ',.55)');
    grad.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, SPRITE, SPRITE);
    return c;
  });

  const MAX = 140;
  const pool = [];
  let live = 0, raf = 0, last = 0;
  let px = 0, py = 0;

  function spawn(x, y, vx, vy, boost) {
    if (live >= MAX) return;
    const p = pool[live] || (pool[live] = {});
    live++;
    p.x = x + (Math.random() - .5) * 10;
    p.y = y + (Math.random() - .5) * 10;
    p.vx = vx * .1 + (Math.random() - .5) * .7;
    p.vy = vy * .1 + (Math.random() - .5) * .7 - .25;
    p.life = 0;
    p.max = 620 + Math.random() * 520;
    p.size = (2.6 + Math.random() * 4.4) * (boost ? 1.35 : 1);
    p.spr = sprites[(Math.random() * (boost ? 4 : 3)) | 0];
  }

  function step(now) {
    raf = 0;
    const dt = Math.min(48, now - (last || now));
    last = now;
    ctx.clearRect(0, 0, W, H);

    let w = 0;
    for (let i = 0; i < live; i++) {
      const p = pool[i];
      p.life += dt;
      if (p.life >= p.max) continue;

      p.vy -= 0.00055 * dt;        // bara naik pelan
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx * dt * 0.06;
      p.y += p.vy * dt * 0.06;

      const t = p.life / p.max;
      const alpha = t < .15 ? t / .15 : 1 - (t - .15) / .85;
      const s = p.size * (1 - t * .55) * 3.2;

      ctx.globalAlpha = alpha * .85;
      ctx.drawImage(p.spr, p.x - s / 2, p.y - s / 2, s, s);

      if (w !== i) { const tmp = pool[w]; pool[w] = p; pool[i] = tmp; }
      w++;
    }
    live = w;
    ctx.globalAlpha = 1;

    if (live > 0) raf = requestAnimationFrame(step);
  }

  const kick = () => { if (!raf) { last = 0; raf = requestAnimationFrame(step); } };

  document.addEventListener('mousemove', e => {
    const mx = e.clientX, my = e.clientY;
    const dx = mx - px, dy = my - py;
    const dist = Math.hypot(dx, dy);
    px = mx; py = my;
    if (dist < 3) return;

    // lebih ramai saat melewati elemen interaktif
    const el = e.target;
    const boost = !!(el && el.closest &&
      el.closest('.project-card, .btn, .fab, .contact-card, .org-card, .edu-card, .cert-card'));
    const count = Math.min(3, 1 + (dist > 26 ? 1 : 0) + (boost ? 1 : 0));
    for (let i = 0; i < count; i++) spawn(mx, my, dx, dy, boost);
    kick();
  }, { passive: true });

  // letupan kecil saat klik
  document.addEventListener('pointerdown', e => {
    for (let i = 0; i < 14; i++) {
      const a = (Math.PI * 2 * i) / 14;
      spawn(e.clientX, e.clientY, Math.cos(a) * 9, Math.sin(a) * 9, true);
    }
    kick();
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { live = 0; ctx.clearRect(0, 0, W, H); }
  });
})();
