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

/* ── AI ASSISTANT: tanya jawab tentang Elroy ── */
(function assistant() {
  const panel = document.getElementById('chatPanel');
  const toggle = document.getElementById('chatToggle');
  const closeBtn = document.getElementById('chatClose');
  const log = document.getElementById('chatLog');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSend');
  const chips = document.getElementById('chatChips');
  if (!panel || !toggle || !log || !form) return;

  const history = [];          // dikirim ulang tiap request; API-nya stateless
  let busy = false;
  let greeted = false;

  /* ---------- render ---------- */

  const scroll = () => { log.scrollTop = log.scrollHeight; };

  function bubble(cls, text) {
    const el = document.createElement('div');
    el.className = 'msg ' + cls;
    el.textContent = text || '';
    log.appendChild(el);
    scroll();
    return el;
  }

  function typingBubble() {
    const el = document.createElement('div');
    el.className = 'msg msg-bot msg-typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    log.appendChild(el);
    scroll();
    return el;
  }

  /* ---------- buka / tutup ---------- */

  function open() {
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add('show'));
    toggle.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    if (!greeted) {
      greeted = true;
      bubble('msg-bot',
        "Hai! Saya asisten AI-nya Elroy. Tanya apa saja soal pengalaman, project, atau keahliannya — boleh pakai bahasa Indonesia atau Inggris.");
    }
    setTimeout(() => input.focus(), 280);
  }

  function close() {
    panel.classList.remove('show');
    toggle.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    setTimeout(() => { panel.hidden = true; }, 300);
  }

  toggle.addEventListener('click', () => (panel.hidden ? open() : close()));
  if (closeBtn) closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !panel.hidden) close();
  });

  /* ---------- penyajian teks ----------
     Prompt sudah meminta teks biasa, tapi model tidak selalu menurut. Ini
     jaring pengamannya, sekaligus membuat penekanan tetap terbaca.

     Urutannya penting: escape HTML DULU, baru terapkan pola. Dengan begitu
     tidak ada markup dari jawaban model yang bisa hidup sebagai HTML — hanya
     tag yang kita buat sendiri di langkah kedua. */

  const escapeHtml = (t) => t
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function render(text) {
    return escapeHtml(text)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')   // **tebal**
      .replace(/(^|\n)[ \t]*[*-][ \t]+/g, '$1• ');            // butir daftar
  }

  /* ---------- jawaban pintasan ----------
     Sebagian besar pertanyaan pengunjung adalah beberapa hal yang itu-itu saja,
     dan jawabannya tidak berubah. Menjawabnya di sini berarti nol panggilan API
     dan nol pemakaian kuota gratis — sekaligus balasannya instan.

     Aturan mainnya: hanya untuk pertanyaan PENDEK. Kalau seseorang menulis
     kalimat panjang, ia sedang menanyakan sesuatu yang spesifik, dan jawaban
     kalengan justru merugikan. Biarkan model yang menangani. */

  const FAST = [
    {
      re: /^(hai|halo|hallo|hi|hello|hey|pagi|siang|sore|malam|selamat (pagi|siang|sore|malam))\b/i,
      id: 'Halo! Silakan tanya apa saja tentang Elroy — pengalaman kerja, project, keahlian, atau ketersediaannya.',
      en: 'Hi! Ask me anything about Elroy — his work experience, projects, skills, or availability.',
    },
    {
      re: /(siapa kamu|kamu siapa|kamu ini apa|kamu ai|kamu bot|who are you|what are you|are you (an? )?(ai|bot|gemini|chatgpt))/i,
      id: 'Saya asisten AI di portfolio Elroy Matthew Wiyanto, ditenagai Google Gemini. Saya menjawab berdasarkan CV dan profil Elroy — jadi kalau ada yang tidak saya ketahui, saya akan bilang tidak tahu, bukan mengarang.',
      en: "I'm the AI assistant on Elroy Matthew Wiyanto's portfolio, powered by Google Gemini. I answer from Elroy's CV and profile — so if I don't know something, I'll say so rather than make it up.",
    },
    {
      re: /(kontak|hubungi|contact|reach (him|out)|email\b|e-mail|whatsapp|wa\b|nomor|phone)/i,
      id: 'Elroy bisa dihubungi lewat:\n• Email — elroy.matthew10@gmail.com\n• WhatsApp — +62 878-0677-6235 (ada tombol hijaunya di pojok kanan bawah)\n• LinkedIn — elroy-matthew-wiyanto\n• GitHub — @Royyy26',
      en: 'You can reach Elroy at:\n• Email — elroy.matthew10@gmail.com\n• WhatsApp — +62 878-0677-6235 (green button, bottom right)\n• LinkedIn — elroy-matthew-wiyanto\n• GitHub — @Royyy26',
    },
    {
      re: /(open to work|lagi cari kerja|sedang mencari|available|tersedia|bisa direkrut|hiring|lowongan|masih kuliah)/i,
      id: 'Ya, Elroy terbuka untuk peluang internship, project freelance, maupun posisi full-time. Ia mencari posisi di Bandung, on-site atau hybrid. Saat ini masih berkuliah (perkiraan lulus Juni 2027) sambil magang, jadi soal jadwal sebaiknya dibicarakan langsung dengannya.',
      en: "Yes — Elroy is open to internships, freelance projects, and full-time roles. He's looking in Bandung, on-site or hybrid. He's still studying (expected to graduate June 2027) alongside his internship, so timing is best discussed with him directly.",
    },
    {
      re: /^(.{0,40})(cv|resume|curriculum)\b/i,
      id: 'CV lengkap Elroy bisa diunduh lewat tombol "Download CV" di bagian atas halaman.',
      en: 'You can download Elroy\'s full CV from the "Download CV" button at the top of the page.',
    },
    {
      re: /(github|repo|repositor|source code|kode sumber)/i,
      id: 'Kode Elroy ada di github.com/Royyy26 — di sana ada TripVerse, Customer Portal Comtronics, NEXA, dan OdeBistro. Beberapa project lain seperti ERP Egafood bersifat privat karena project internship.',
      en: "Elroy's code is at github.com/Royyy26 — TripVerse, the Comtronics Customer Portal, NEXA, and OdeBistro are there. A few projects like the Egafood ERP are private because they're internship work.",
    },
    {
      re: /(makasih|terima kasih|thanks|thank you|thx|ok(e|ay)?$|sip$|mantap$)/i,
      id: 'Sama-sama! Kalau ada yang mau ditanyakan lagi soal Elroy, silakan.',
      en: "You're welcome! Ask me anything else about Elroy whenever you like.",
    },
  ];

  // Kata yang praktis hanya muncul di salah satu bahasa. Sapaan ikut masuk:
  // "halo" sendirian tidak punya kata petunjuk lain, jadi tanpa ini ia salah
  // dikira bahasa Inggris.
  const ID_HINT = /\b(apa|siapa|gimana|bagaimana|dimana|di\s?mana|kapan|kenapa|mengapa|bisa|boleh|yang|dan|untuk|saja|aja|nya|kah|dong|sih|tolong|mau|ada|halo|hallo|hai|pagi|siang|sore|malam|selamat|makasih|terima\s?kasih|sip|mantap|kerja|kuliah)\b/i;
  const EN_HINT = /\b(hi|hello|hey|thanks|thank|who|what|how|where|when|why|can|do|does|is|are|your|you|the|about|contact|available|resume|tell)\b/i;

  function fastAnswer(q) {
    const query = q.trim();
    // Pertanyaan panjang hampir selalu spesifik — serahkan ke model.
    if (query.split(/\s+/).length > 8) return null;

    const hit = FAST.find((f) => f.re.test(query));
    if (!hit) return null;
    // Bahasa Indonesia jadi default: pengunjung situs ini sebagian besar
    // berbahasa Indonesia, jadi itu tebakan yang paling sering benar.
    if (ID_HINT.test(query)) return hit.id;
    if (EN_HINT.test(query)) return hit.en;
    return hit.id;
  }

  // Ditulis bertahap supaya terasa sama dengan jawaban dari model — kalau
  // muncul sekaligus, dua jenis jawaban akan terasa berbeda tanpa alasan.
  async function typeOut(el, str) {
    const parts = str.split(/(\s+)/);
    let acc = '';
    for (let i = 0; i < parts.length; i++) {
      acc += parts[i];
      el.innerHTML = render(acc);
      scroll();
      if (parts[i].trim()) await new Promise((r) => setTimeout(r, 18));
    }
  }

  /* ---------- kirim ---------- */

  function setBusy(v) {
    busy = v;
    input.disabled = v;
    sendBtn.disabled = v;
  }

  async function ask(question) {
    if (busy || !question.trim()) return;
    if (chips) chips.classList.add('gone');

    bubble('msg-user', question);
    history.push({ role: 'user', content: question });
    input.value = '';
    setBusy(true);

    // Dijawab lokal kalau bisa: tanpa panggilan API, tanpa kuota terpakai.
    const quick = fastAnswer(question);
    if (quick) {
      const el = bubble('msg-bot', '');
      el.classList.add('streaming');
      await typeOut(el, quick);
      el.classList.remove('streaming');
      history.push({ role: 'assistant', content: quick });
      setBusy(false);
      input.focus();
      return;
    }

    const typing = typingBubble();
    let answer = null;
    let text = '';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-10) }),
      });

      if (!res.ok || !res.body) {
        // 404 di sini biasanya berarti dibuka sebagai file statis tanpa
        // serverless function-nya (mis. python -m http.server).
        let msg = 'Asisten belum aktif di sini.';
        if (res.status === 404 || res.status === 405 || res.status === 501) {
          // Preview statis (mis. python -m http.server) tidak punya serverless
          // function, jadi POST ke /api/chat tidak akan pernah berhasil.
          msg = 'Asisten hanya berjalan di versi yang sudah di-deploy, bukan di preview statis lokal.';
        } else if (res.status === 429) {
          msg = 'Terlalu banyak pertanyaan sekaligus. Tunggu sebentar ya.';
        } else {
          try { msg = (await res.json()).error || msg; } catch (_) { /* biarkan pesan default */ }
        }
        typing.remove();
        bubble('msg-error', msg);
        history.pop();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      // Server-Sent Events: tiap kejadian dipisah baris kosong ganda.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let sep;
        while ((sep = buf.indexOf('\n\n')) !== -1) {
          const raw = buf.slice(0, sep);
          buf = buf.slice(sep + 2);

          let evt = 'message', data = '';
          for (const line of raw.split('\n')) {
            if (line.startsWith('event:')) evt = line.slice(6).trim();
            else if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          if (!data) continue;

          let payload;
          try { payload = JSON.parse(data); } catch (_) { continue; }

          if (evt === 'delta') {
            if (!answer) { typing.remove(); answer = bubble('msg-bot', ''); answer.classList.add('streaming'); }
            text += payload.text;
            answer.innerHTML = render(text);
            scroll();
          } else if (evt === 'error') {
            typing.remove();
            if (answer) answer.classList.remove('streaming');
            bubble('msg-error', payload.message || 'Ada gangguan sebentar.');
          }
        }
      }

      if (answer) {
        answer.classList.remove('streaming');
        history.push({ role: 'assistant', content: text });
      } else {
        typing.remove();
        bubble('msg-error', 'Tidak ada jawaban yang diterima. Coba lagi ya.');
        history.pop();
      }
    } catch (err) {
      typing.remove();
      if (answer) answer.classList.remove('streaming');
      bubble('msg-error', 'Koneksi terputus. Coba lagi ya.');
      history.pop();
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    ask(input.value);
  });

  if (chips) {
    chips.addEventListener('click', e => {
      const chip = e.target.closest('.chat-chip');
      if (chip) ask(chip.textContent.trim());
    });
  }
})();
