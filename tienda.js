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
    } else {
      el.innerHTML = txt;
    }
  });
  updateQuote();
}

// ── TABS ──
function showTab(tab) {
  const isPaquetes = tab === 'paquetes';
  document.getElementById('section-paquetes').style.display = isPaquetes ? 'block' : 'none';
  document.getElementById('section-cotizador').style.display = isPaquetes ? 'none' : 'block';
  document.getElementById('tab-paquetes').classList.toggle('active', isPaquetes);
  document.getElementById('tab-cotizador').classList.toggle('active', !isPaquetes);
  if (!isPaquetes) {
    setTimeout(() => {
      document.getElementById('section-cotizador').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }
}

// ── COTIZADOR ──
function updateQuote() {
  const svc = document.getElementById('q-service').value;
  const urgency = parseInt(document.getElementById('q-urgency').value) || 0;
  const maintenance = parseInt(document.querySelector('input[name="maintenance"]:checked')?.value) || 0;

  let base = 0;
  let svcName = '';

  if (svc && svc !== 'custom:0') {
    const parts = svc.split(':');
    base = parseInt(parts[1]) || 0;
    const opt = document.querySelector(`#q-service option[value="${svc}"]`);
    svcName = opt ? opt.getAttribute('data-' + lang) || opt.textContent.split('—')[0].trim() : '';
  }

  const total = base + urgency;
  const cats = Math.round(total * 0.03);

  const priceEl = document.getElementById('qc-price');
  const noteEl = document.getElementById('qc-note');
  const itemsEl = document.getElementById('qc-items');
  const catsEl = document.getElementById('qc-cats-amount');

  priceEl.textContent = total > 0 ? '$' + total.toLocaleString('es-MX') + ' MXN' : '$0 MXN';
  catsEl.textContent = '$' + cats.toLocaleString('es-MX') + ' MXN';

  if (total === 0) {
    noteEl.textContent = lang === 'es' ? 'Selecciona opciones para ver el estimado' : 'Select options to see estimate';
    itemsEl.innerHTML = '';
    return;
  }

  noteEl.textContent = lang === 'es' ? 'Estimado — precio final en propuesta' : 'Estimated — final price in proposal';

  let items = [];
  if (svcName && base > 0) items.push([svcName, '$' + base.toLocaleString('es-MX')]);
  if (urgency > 0) items.push([lang === 'es' ? 'Urgencia express' : 'Express urgency', '+$' + urgency.toLocaleString('es-MX')]);
  if (maintenance > 0) items.push([lang === 'es' ? 'Mantenimiento/mes' : 'Maintenance/mo', '$' + maintenance.toLocaleString('es-MX')]);

  itemsEl.innerHTML = items.map(([k, v]) =>
    `<div class="qc-item"><span>${k}</span><span>${v}</span></div>`
  ).join('');
}

// ── SUBMIT COTIZACIÓN ──
function submitQuote(e) {
  e.preventDefault();
  const name = document.getElementById('q-name').value;
  const email = document.getElementById('q-email').value;
  const company = document.getElementById('q-company').value;
  const svc = document.getElementById('q-service').options[document.getElementById('q-service').selectedIndex]?.text || '';
  const urgency = document.getElementById('q-urgency').options[document.getElementById('q-urgency').selectedIndex]?.text || '';
  const maintenance = document.querySelector('input[name="maintenance"]:checked')?.parentElement?.textContent?.trim() || '';
  const msg = document.getElementById('q-msg').value;
  const price = document.getElementById('qc-price').textContent;

  const subject = encodeURIComponent(`[KS.exe] Solicitud de cotización — ${name}`);
  const body = encodeURIComponent(
    `Nombre: ${name}\nEmail: ${email}\nEmpresa: ${company || 'No especificado'}\n\nServicio: ${svc}\nUrgencia: ${urgency}\nMantenimiento: ${maintenance}\nEstimado: ${price}\n\nMensaje:\n${msg || 'Sin mensaje adicional'}`
  );
  window.location.href = `mailto:hola@kitsune-sakura.com.mx?subject=${subject}&body=${body}`;

  const ok = document.getElementById('quote-ok');
  ok.textContent = ok.getAttribute('data-' + lang);
  ok.classList.add('show');
  setTimeout(() => ok.classList.remove('show'), 4000);
}

// ── MODAL PAQUETE ──
function selectPlan(planName, price) {
  const cats = Math.round(price * 0.03);
  document.getElementById('modal-plan-name').textContent = planName;
  document.getElementById('modal-plan-price').textContent = '$' + price.toLocaleString('es-MX') + ' MXN';
  document.getElementById('modal-cats').textContent = '$' + cats.toLocaleString('es-MX') + ' MXN';

  const msg = encodeURIComponent(`Hola! Me interesa el paquete "${planName}" por $${price.toLocaleString('es-MX')} MXN. ¿Podemos hablar?`);
  document.getElementById('modal-wa').href = `https://wa.me/5255XXXXXXXX?text=${msg}`;

  const emailSubject = encodeURIComponent(`[KS.exe] Interesado en: ${planName}`);
  const emailBody = encodeURIComponent(`Hola equipo de Kitsune Sakura.exe,\n\nMe interesa el paquete "${planName}" con un costo de $${price.toLocaleString('es-MX')} MXN.\n\nQuedo en espera de su contacto.\n\nSaludos`);
  document.getElementById('modal-email').href = `mailto:hola@kitsune-sakura.com.mx?subject=${emailSubject}&body=${emailBody}`;

  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── REVEAL ──
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  setLang(lang);
  updateQuote();
});
