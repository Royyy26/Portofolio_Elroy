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
  ring.style.transform = `translate(${rx-15}px,${ry-15}px)`;
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