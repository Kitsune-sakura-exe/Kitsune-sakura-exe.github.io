// ── IDIOMA ──
const translations = {
  es: {
    'page-title': 'Kitsune Sakura.exe — Technology with a Soul',
    'meta-desc': 'Tecnología con alma. Videojuegos, consultoría tech y soluciones digitales para pymes, despachos y detectives en México.',
    'f-name-placeholder': 'Tu nombre',
    'f-email-placeholder': 'tu@email.com',
    'f-msg-placeholder': 'Cuéntanos de tu proyecto...',
    'select-default': 'Selecciona una opción',
    'opt-game': 'Videojuego',
    'opt-consulting': 'Consultoría tech',
    'opt-web': 'Sitio web',
    'opt-other': 'Otro',
  },
  en: {
    'page-title': 'Kitsune Sakura.exe — Technology with a Soul',
    'meta-desc': 'Technology with a soul. Video games, tech consulting and digital solutions for SMEs, law firms and detectives in Mexico.',
    'f-name-placeholder': 'Your name',
    'f-email-placeholder': 'your@email.com',
    'f-msg-placeholder': 'Tell us about your project...',
    'select-default': 'Select an option',
    'opt-game': 'Video game',
    'opt-consulting': 'Tech consulting',
    'opt-web': 'Website',
    'opt-other': 'Other',
  }
};

let currentLang = localStorage.getItem('ks-lang') || 'es';

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('ks-lang', lang);
  document.documentElement.lang = lang;

  // Botones activos
  document.getElementById('btn-es').classList.toggle('active', lang === 'es');
  document.getElementById('btn-en').classList.toggle('active', lang === 'en');

  // Traducir todos los elementos con data-es / data-en
  document.querySelectorAll('[data-es]').forEach(el => {
    const txt = el.getAttribute(`data-${lang}`);
    if (!txt) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = txt;
    } else if (el.tagName === 'OPTION') {
      el.textContent = txt;
    } else {
      // Preserva HTML interno (ej: <em>)
      if (el.querySelector('em') || el.querySelector('span')) {
        el.innerHTML = txt;
      } else {
        el.textContent = txt;
      }
    }
  });

  // Placeholders y select
  const nameInput = document.getElementById('f-name');
  const msgInput  = document.getElementById('f-msg');
  const t = translations[lang];
  if (nameInput) nameInput.placeholder = t['f-name-placeholder'];
  if (msgInput)  msgInput.placeholder  = t['f-msg-placeholder'];

  // Opciones del select
  const sel = document.getElementById('f-type');
  if (sel) {
    sel.options[0].text = t['select-default'];
    sel.options[1].text = t['opt-game'];
    sel.options[2].text = t['opt-consulting'];
    sel.options[3].text = t['opt-web'];
    sel.options[4].text = t['opt-other'];
  }
}

// ── NAV SCROLL ──
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

// ── MOBILE MENU ──
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');

hamburger.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
});

// Cerrar menú al hacer clic en un link
document.querySelectorAll('.mobile-link').forEach(link => {
  link.addEventListener('click', () => mobileMenu.classList.remove('open'));
});

// ── SMOOTH SCROLL para links internos ──
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      const offset = 70;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ── REVEAL ON SCROLL ──
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ── FORMULARIO ──
function handleSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('submit-btn');
  const success = document.getElementById('form-success');
  const name  = document.getElementById('f-name').value;
  const email = document.getElementById('f-email').value;
  const type  = document.getElementById('f-type').value;
  const msg   = document.getElementById('f-msg').value;

  // Arma el mailto
  const subject = encodeURIComponent(`[Kitsune Sakura.exe] Proyecto: ${type} — ${name}`);
  const body = encodeURIComponent(
    `Nombre: ${name}\nEmail: ${email}\nTipo de proyecto: ${type}\n\nMensaje:\n${msg}`
  );
  window.location.href = `mailto:hola@kitsune-sakura.mx?subject=${subject}&body=${body}`;

  // Feedback visual
  btn.style.opacity = '0.6';
  btn.disabled = true;
  success.classList.add('show');

  setTimeout(() => {
    btn.style.opacity = '1';
    btn.disabled = false;
    document.getElementById('contact-form').reset();
    setTimeout(() => success.classList.remove('show'), 3000);
  }, 2000);
}

// ── ACTIVE NAV LINK según sección visible ──
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(link => {
        link.style.color = link.getAttribute('href') === `#${entry.target.id}` ? 'var(--rojo)' : '';
      });
    }
  });
}, { threshold: 0.4 });

sections.forEach(s => sectionObserver.observe(s));

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  setLang(currentLang);
});
