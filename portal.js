import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── FIREBASE CONFIG ──
const firebaseConfig = {
  apiKey: "AIzaSyBIXwgpUFFbJfaBKd0jJRIpZeMmxxmlvLw",
  authDomain: "kitsune-sakura-exe.firebaseapp.com",
  projectId: "kitsune-sakura-exe",
  storageBucket: "kitsune-sakura-exe.firebasestorage.app",
  messagingSenderId: "1046651344092",
  appId: "1:1046651344092:web:e90ef6677f8904abe91019"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── HELPERS ──
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

const safeUrl = (u) => {
  if (!u) return '';
  const s = String(u).trim();
  return /^https?:\/\//i.test(s) ? s : '';
};

// ── AUTH STATE ──
getRedirectResult(auth).catch(err => {
  if (err?.code && err.code !== 'auth/no-auth-event') {
    console.error('Auth redirect error:', err);
    const errEl = document.getElementById('login-error');
    if (errEl) errEl.textContent = 'Error al iniciar sesión: ' + (err.message || err.code);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    showPortal(user);
    await ensureUserDoc(user);
    await loadAll(user);
  } else {
    showLogin();
  }
});

// ── LOGIN ──
window.loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    document.getElementById('btn-google').textContent = 'Redirigiendo a Google...';
    await signInWithRedirect(auth, provider);
  } catch (err) {
    console.error(err);
    document.getElementById('btn-google').innerHTML = `
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style="flex-shrink:0">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
        <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
      Continuar con Google`;
    document.getElementById('login-error').textContent = 'Error al iniciar sesión: ' + (err.message || err.code);
  }
};

// ── LOGOUT ──
window.logout = async () => {
  await signOut(auth);
};

// ── SHOW / HIDE ──
function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('portal').style.display = 'none';
}

function showPortal(user) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('portal').style.display = 'flex';

  const name = user.displayName || 'Cliente';
  const firstName = name.split(' ')[0];
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  document.getElementById('welcome-msg').textContent = `Hola, ${firstName} 👋`;
  document.getElementById('user-name').textContent = name;
  document.getElementById('user-email').textContent = user.email;

  // Avatar
  const avatarEl = document.getElementById('user-avatar');
  const topbarAvatar = document.getElementById('topbar-avatar');
  if (user.photoURL) {
    // Usamos DOM en lugar de innerHTML para evitar XSS con photoURL manipulada
    avatarEl.textContent = '';
    const img = document.createElement('img');
    img.src = user.photoURL;
    img.alt = name;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
    avatarEl.appendChild(img);
    topbarAvatar.src = user.photoURL;
    topbarAvatar.style.display = 'block';
  } else {
    avatarEl.textContent = initials;
  }
}

// ── ENSURE USER DOC ──
// Al loguearse por primera vez, crea el doc en usuarios/ y hace reconciliación
// de cualquier proyecto/archivo/factura que el admin haya creado antes (con
// clienteId null) asignándole ahora el uid correcto.
async function ensureUserDoc(user) {
  const ref = doc(db, 'usuarios', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      nombre: user.displayName || user.email.split('@')[0],
      email: user.email.toLowerCase(),
      foto: user.photoURL || '',
      creadoEn: serverTimestamp(),
      rol: 'cliente'
    });
    // Reconciliación: actualizar docs preexistentes que fueron creados
    // por el admin usando solo el email del cliente.
    await reconcileClienteId(user.uid, user.email.toLowerCase());
  }
}

async function reconcileClienteId(clienteId, clienteEmail) {
  if (!clienteId || !clienteEmail) return;
  const batch = writeBatch(db);
  let updates = 0;
  for (const col of ['proyectos', 'archivos', 'facturas']) {
    const snap = await getDocs(query(
      collection(db, col),
      where('clienteEmail', '==', clienteEmail)
    ));
    snap.docs.forEach(d => {
      const data = d.data();
      if (!data.clienteId || data.clienteId === clienteEmail) {
        batch.update(doc(db, col, d.id), { clienteId });
        updates++;
      }
    });
  }
  if (updates > 0) {
    await batch.commit();
    console.log(`Reconciliados ${updates} documentos`);
  }
}

// ── LOAD ALL DATA ──
async function loadAll(user) {
  try {
    const [proyectos, archivos, facturas] = await Promise.all([
      loadProyectos(user),
      loadArchivos(user),
      loadFacturas(user)
    ]);
    updateStats(proyectos, archivos, facturas);
    renderDashProjects(proyectos);
  } catch (err) {
    console.error('Error al cargar datos:', err);
  }
}

// ── Helper: fetch por uid y por email, mezcla sin duplicados ──
// Busca primero por clienteId == uid, luego por clienteEmail (fallback) y une.
async function fetchForUser(col, user) {
  const email = user.email.toLowerCase();
  const [byUid, byEmail] = await Promise.all([
    getDocs(query(collection(db, col), where('clienteId', '==', user.uid))),
    getDocs(query(collection(db, col), where('clienteEmail', '==', email)))
  ]);
  const map = new Map();
  byUid.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
  byEmail.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
  return Array.from(map.values());
}

// ── PROYECTOS ──
async function loadProyectos(user) {
  const proyectos = await fetchForUser('proyectos', user);

  const container = document.getElementById('proyectos-list');
  if (proyectos.length === 0) {
    container.innerHTML = '<div class="empty-state">No tienes proyectos activos aún.<br>¿Listo para comenzar? <a href="tienda.html" style="color:#C0392B">Ver servicios →</a></div>';
    return proyectos;
  }

  container.innerHTML = proyectos.map(p => renderProjectCard(p)).join('');
  return proyectos;
}

function renderProjectCard(p) {
  const statusMap = {
    activo:    { label: 'Activo',     cls: 'activo' },
    revision:  { label: 'En revisión',cls: 'revision' },
    entregado: { label: 'Entregado',  cls: 'entregado' },
    pausado:   { label: 'Pausado',    cls: 'pausado' }
  };
  const s = statusMap[p.estado] || statusMap['activo'];
  const pct = Number(p.progreso) || 0;
  const inicio = p.fechaInicio?.toDate?.()?.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }) || '—';

  return `
    <div class="project-card">
      <div class="proj-status-dot status-${esc(s.cls)}"></div>
      <div class="proj-info">
        <p class="proj-name">${esc(p.nombre || 'Proyecto')}</p>
        <div class="proj-meta">
          <span>${esc(p.tipo || 'Servicio')}</span>
          <span>Inicio: ${esc(inicio)}</span>
        </div>
      </div>
      <span class="proj-status-badge badge-${esc(s.cls)}">${esc(s.label)}</span>
      <div class="proj-progress">
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <p class="progress-pct">${pct}%</p>
      </div>
    </div>`;
}

function renderDashProjects(proyectos) {
  const el = document.getElementById('dash-projects-list');
  if (proyectos.length === 0) {
    el.innerHTML = '<div class="empty-state">Sin proyectos activos.</div>';
    return;
  }
  el.innerHTML = proyectos.slice(0, 3).map(p => renderProjectCard(p)).join('');
}

// ── ARCHIVOS ──
async function loadArchivos(user) {
  const archivos = await fetchForUser('archivos', user);

  const container = document.getElementById('archivos-list');
  if (archivos.length === 0) {
    container.innerHTML = '<div class="empty-state">No hay archivos disponibles aún.</div>';
    return archivos;
  }

  const extMap = {
    pdf: 'PDF', zip: 'ZIP', rar: 'ZIP',
    doc: 'DOC', docx: 'DOC', txt: 'DOC',
    png: 'IMG', jpg: 'IMG', jpeg: 'IMG', gif: 'IMG', webp: 'IMG',
    mp4: 'VID', mov: 'VID',
    xlsx: 'XLS', xls: 'XLS', csv: 'XLS'
  };
  container.innerHTML = archivos.map(a => {
    const ext = a.nombre?.split('.').pop()?.toLowerCase() || 'doc';
    const tipo = extMap[ext] || 'DOC';
    const fecha = a.subidoEn?.toDate?.()?.toLocaleDateString('es-MX') || '—';
    const url = safeUrl(a.url);
    return `
      <div class="file-card">
        <div class="file-icon ${esc(ext)}">${esc(tipo)}</div>
        <div class="file-info">
          <p class="file-name">${esc(a.nombre || 'Archivo')}</p>
          <p class="file-meta">${esc(a.proyecto || '')} · ${esc(fecha)} · ${esc(a.tamano || '')}</p>
        </div>
        ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="btn-download">Descargar</a>` : '<span style="font-size:.72rem;color:var(--gray)">Próximamente</span>'}
      </div>`;
  }).join('');

  return archivos;
}

// ── FACTURAS ──
async function loadFacturas(user) {
  const facturas = await fetchForUser('facturas', user);

  const container = document.getElementById('facturas-list');
  if (facturas.length === 0) {
    container.innerHTML = '<div class="empty-state">No hay facturas registradas aún.</div>';
    return facturas;
  }

  container.innerHTML = facturas.map(f => {
    const statusMap = { pagada: 'Pagada', pendiente: 'Pendiente', vencida: 'Vencida' };
    const s = f.estado || 'pendiente';
    const fecha = f.fecha?.toDate?.()?.toLocaleDateString('es-MX') || '—';
    const url = safeUrl(f.url);
    return `
      <div class="invoice-card">
        <div class="inv-info">
          <p class="inv-num">Factura #${esc(f.numero || '—')}</p>
          <p class="inv-name">${esc(f.concepto || 'Servicio')}</p>
          <p class="inv-date">${esc(fecha)}</p>
        </div>
        <span class="inv-amount">$${(Number(f.monto) || 0).toLocaleString('es-MX')} MXN</span>
        <span class="inv-status inv-${esc(s)}">${esc(statusMap[s] || s)}</span>
        ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="btn-download" style="margin-left:.5rem">PDF</a>` : ''}
      </div>`;
  }).join('');

  return facturas;
}

// ── STATS ──
function updateStats(proyectos, archivos, facturas) {
  const activos = proyectos.filter(p => p.estado === 'activo').length;
  const pendientes = facturas.filter(f => f.estado === 'pendiente').length;
  const totalPagado = facturas.filter(f => f.estado === 'pagada').reduce((s, f) => s + (Number(f.monto) || 0), 0);
  const cats = Math.round(totalPagado * 0.03);

  document.getElementById('stat-proyectos').textContent = activos || '0';
  document.getElementById('stat-archivos').textContent = archivos.length || '0';
  document.getElementById('stat-facturas').textContent = pendientes || '0';
  document.getElementById('stat-cats').textContent = '$' + cats.toLocaleString('es-MX');
}

// ── NAVEGACIÓN ──
window.showSection = (sec) => {
  document.querySelectorAll('.portal-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.snav-item').forEach(s => s.classList.remove('active'));
  document.getElementById('section-' + sec).classList.add('active');
  document.getElementById('nav-' + sec).classList.add('active');
  closeSidebarMobile();
};

// ── SIDEBAR MOBILE ──
window.toggleSidebar = () => {
  document.getElementById('sidebar').classList.toggle('open');
};
function closeSidebarMobile() {
  if (window.innerWidth <= 900) {
    document.getElementById('sidebar').classList.remove('open');
  }
}
