// ── CURSOR ──
const cursor = document.getElementById('cursor');
const cursorDot = document.getElementById('cursor-dot');
let mx = 0, my = 0, cx = 0, cy = 0;

document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  cursorDot.style.left = mx + 'px';
  cursorDot.style.top  = my + 'px';
});

function animCursor() {
  cx += (mx - cx) * 0.14;
  cy += (my - cy) * 0.14;
  cursor.style.left = cx + 'px';
  cursor.style.top  = cy + 'px';
  requestAnimationFrame(animCursor);
}
animCursor();

// ── NAV SCROLL ──
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

// ── BURGER / DRAWER ──
const burger = document.getElementById('burger');
const drawer = document.getElementById('drawer');
const overlay = document.getElementById('drawer-overlay');

burger.addEventListener('click', () => {
  drawer.classList.toggle('open');
  overlay.classList.toggle('show');
});

function closeDrawer() {
  drawer.classList.remove('open');
  overlay.classList.remove('show');
}

// ── SMOOTH SCROLL ──
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const t = document.querySelector(a.getAttribute('href'));
    if (t) {
      window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - 68, behavior: 'smooth' });
    }
  });
});

// ── REVEAL ──
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// ── ACTIVE NAV ──
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');
const sio = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      navLinks.forEach(l => {
        const active = l.getAttribute('href') === '#' + e.target.id;
        l.style.color = active ? 'var(--rojo)' : '';
      });
    }
  });
}, { threshold: 0.5 });
sections.forEach(s => sio.observe(s));

// ── COUNTER ANIMADO ──
function animateCounter(target, duration = 2000) {
  const el = document.getElementById('counter');
  if (!el) return;
  let start = null;
  const step = ts => {
    if (!start) start = ts;
    const progress = Math.min((ts - start) / duration, 1);
    el.textContent = Math.floor(progress * target);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target;
  };
  requestAnimationFrame(step);
}

// Activar counter cuando sea visible
const counterEl = document.getElementById('counter');
if (counterEl) {
  const cio = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      animateCounter(47);
      cio.disconnect();
    }
  }, { threshold: 0.5 });
  cio.observe(counterEl);
}

// ── IDIOMA ──
let lang = localStorage.getItem('ks-lang') || 'es';

function setLang(l) {
  lang = l;
  localStorage.setItem('ks-lang', l);
  document.documentElement.lang = l;
  document.getElementById('btn-es').classList.toggle('active', l === 'es');
  document.getElementById('btn-en').classList.toggle('active', l === 'en');

  document.querySelectorAll('[data-es]').forEach(el => {
    const txt = el.getAttribute('data-' + l);
    if (!txt) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = txt;
    } else if (el.tagName === 'OPTION') {
      el.textContent = txt;
    } else if (el.tagName === 'META') {
      el.setAttribute('content', txt);
    } else {
      el.innerHTML = txt;
    }
  });

  // Actualizar placeholders
  const placeholders = {
    es: { name: 'Tu nombre completo', email: 'tu@email.com', msg: 'Cuéntanos de tu proyecto...' },
    en: { name: 'Your full name',     email: 'your@email.com', msg: 'Tell us about your project...' }
  };
  const p = placeholders[l];
  const fn = document.getElementById('f-name');
  const fe = document.getElementById('f-email');
  const fm = document.getElementById('f-msg');
  if (fn) fn.placeholder = p.name;
  if (fe) fe.placeholder = p.email;
  if (fm) fm.placeholder = p.msg;

  // Select options
  const sel = document.getElementById('f-type');
  if (sel) {
    const opts = {
      es: ['Selecciona una opción', 'Videojuego', 'Consultoría tech', 'Sitio web', 'Otro'],
      en: ['Select an option', 'Video game', 'Tech consulting', 'Website', 'Other']
    };
    opts[l].forEach((txt, i) => { if (sel.options[i]) sel.options[i].text = txt; });
  }

  // Titulo
  document.title = l === 'es'
    ? 'Kitsune Sakura.exe — Technology with a Soul'
    : 'Kitsune Sakura.exe — Technology with a Soul';
}

// ── FORMULARIO ──
function handleSubmit(e) {
  e.preventDefault();
  const name  = document.getElementById('f-name').value.trim();
  const email = document.getElementById('f-email').value.trim();
  const type  = document.getElementById('f-type').value;
  const msg   = document.getElementById('f-msg').value.trim();
  const btn   = document.getElementById('submit-btn');
  const ok    = document.getElementById('form-ok');

  if (!name || !email || !msg) return;

  const subject = encodeURIComponent(`[KS.exe] Proyecto: ${type || 'consulta'} — ${name}`);
  const body = encodeURIComponent(`Nombre: ${name}\nEmail: ${email}\nTipo: ${type || 'no especificado'}\n\nMensaje:\n${msg}`);
  window.location.href = `mailto:hola@kitsune-sakura.mx?subject=${subject}&body=${body}`;

  btn.disabled = true;
  btn.style.opacity = '.6';
  ok.textContent = ok.getAttribute('data-' + lang);
  ok.classList.add('show');

  setTimeout(() => {
    btn.disabled = false;
    btn.style.opacity = '1';
    document.getElementById('contact-form').reset();
    setTimeout(() => ok.classList.remove('show'), 3000);
  }, 2500);
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => setLang(lang));
