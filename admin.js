import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, signInWithRedirect, getRedirectResult, GoogleAuthProvider,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, query, where, orderBy,
  getDocs, getDoc, doc, addDoc, setDoc, updateDoc,
  deleteDoc, serverTimestamp, Timestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── CONFIG ──
const ADMIN_EMAIL = "yamatodcherry@gmail.com";

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
// Escape para prevenir XSS al interpolar datos en innerHTML
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

// Solo permitir URLs http(s), prevenir javascript:
const safeUrl = (u) => {
  if (!u) return '';
  const s = String(u).trim();
  return /^https?:\/\//i.test(s) ? s : '';
};

// ── AUTH ──
// Procesar resultado del redirect al cargar la página
getRedirectResult(auth).catch(err => {
  if (err?.code && err.code !== 'auth/no-auth-event') {
    console.error('Auth redirect error:', err);
    const errEl = document.getElementById('login-error');
    if (errEl) errEl.textContent = 'Error al iniciar sesión: ' + (err.message || err.code);
  }
});

onAuthStateChanged(auth, user => {
  if (user && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() && user.emailVerified) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin').style.display = 'flex';
    document.getElementById('topbar-user').textContent = user.displayName || user.email;
    loadAll();
  } else if (user) {
    signOut(auth);
    document.getElementById('login-error').textContent = '⚠ Acceso denegado. Esta cuenta no tiene permisos de administrador.';
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('admin').style.display = 'none';
  }
});

window.adminLogin = async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ login_hint: ADMIN_EMAIL });
  try {
    document.getElementById('btn-google').textContent = 'Redirigiendo a Google...';
    await signInWithRedirect(auth, provider);
    // signInWithRedirect no retorna aquí: la página se redirige a Google.
    // El resultado se procesa al volver, en getRedirectResult arriba.
  } catch (err) {
    console.error(err);
    document.getElementById('btn-google').innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" style="flex-shrink:0"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg> Entrar con Google`;
    document.getElementById('login-error').textContent = 'Error al iniciar sesión: ' + (err.message || err.code);
  }
};

window.adminLogout = () => signOut(auth);

// ── NAVEGACIÓN ──
window.showTab = (tab) => {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.snav').forEach(s => s.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('nav-' + tab).classList.add('active');
  const titles = { dashboard:'Dashboard', clientes:'Clientes', proyectos:'Proyectos', archivos:'Archivos', facturas:'Facturas' };
  document.getElementById('topbar-title').textContent = titles[tab] || tab;
  const actionBtn = document.getElementById('topbar-action');
  actionBtn.style.display = ['proyectos','archivos','facturas'].includes(tab) ? 'flex' : 'none';
  const actionMap = { proyectos:'proyecto', archivos:'archivo', facturas:'factura' };
  if (actionMap[tab]) actionBtn.onclick = () => openModal(actionMap[tab]);
};

// ── LOAD ALL ──
async function loadAll() {
  try {
    const [clientes, proyectos, archivos, facturas] = await Promise.all([
      fetchClientes(), fetchProyectos(), fetchArchivos(), fetchFacturas()
    ]);
    renderStats(clientes, proyectos, facturas);
    renderDashboard(proyectos, facturas);
    renderClientes(clientes, proyectos);
    renderProyectos(proyectos);
    renderArchivos(archivos);
    renderFacturas(facturas);
  } catch (err) {
    console.error('Error al cargar datos:', err);
    showToast('Error al cargar datos: ' + err.message, 'error');
  }
}

// ── FETCH ──
async function fetchClientes() {
  const snap = await getDocs(collection(db, 'usuarios'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function fetchProyectos() {
  const snap = await getDocs(collection(db, 'proyectos'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function fetchArchivos() {
  const snap = await getDocs(collection(db, 'archivos'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function fetchFacturas() {
  const snap = await getDocs(collection(db, 'facturas'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── STATS ──
function renderStats(clientes, proyectos, facturas) {
  const activos = proyectos.filter(p => p.estado === 'activo').length;
  const pendientes = facturas.filter(f => f.estado === 'pendiente').length;
  const totalPagado = facturas.filter(f => f.estado === 'pagada').reduce((s,f) => s + (f.monto||0), 0);
  document.getElementById('d-clientes').textContent = clientes.length;
  document.getElementById('d-activos').textContent = activos;
  document.getElementById('d-pendientes').textContent = pendientes;
  document.getElementById('d-cats').textContent = '$' + Math.round(totalPagado * 0.03).toLocaleString('es-MX');
}

// ── DASHBOARD ──
function renderDashboard(proyectos, facturas) {
  const pList = document.getElementById('d-proyectos-list');
  const fList = document.getElementById('d-facturas-list');
  const recientes = proyectos.filter(p => p.estado === 'activo').slice(0, 4);
  pList.innerHTML = recientes.length
    ? recientes.map(p => `<div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border)">
        <div><p style="font-size:.83rem;font-weight:500">${esc(p.nombre)}</p><p style="font-family:var(--fm);font-size:.6rem;color:var(--text-m)">${esc(p.tipo)}</p></div>
        <span class="badge badge-${esc(p.estado||'activo')}">${esc(p.estado||'activo')}</span></div>`).join('')
    : '<div class="empty">Sin proyectos activos</div>';

  const pendientes = facturas.filter(f => f.estado === 'pendiente').slice(0, 4);
  fList.innerHTML = pendientes.length
    ? pendientes.map(f => `<div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border)">
        <div><p style="font-size:.83rem;font-weight:500">${esc(f.concepto||'Factura')}</p><p style="font-family:var(--fm);font-size:.6rem;color:var(--text-m)">#${esc(f.numero||'—')}</p></div>
        <span style="font-family:var(--fm);font-size:.75rem;color:var(--rojo);font-weight:500">$${(f.monto||0).toLocaleString('es-MX')}</span></div>`).join('')
    : '<div class="empty">Sin facturas pendientes 🎉</div>';
}

// ── RENDER CLIENTES ──
function renderClientes(clientes, proyectos) {
  const tbody = document.getElementById('clientes-tbody');
  if (!clientes.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">Sin clientes registrados</td></tr>'; return; }
  tbody.innerHTML = clientes.map(c => {
    const nProj = proyectos.filter(p => p.clienteEmail === c.email || p.clienteId === c.id).length;
    const fecha = c.creadoEn?.toDate?.()?.toLocaleDateString('es-MX') || '—';
    const inicial = (c.nombre || '?')[0].toUpperCase();
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:.6rem">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--rojo-l);display:flex;align-items:center;justify-content:center;font-size:.7rem;color:var(--rojo);font-weight:500;flex-shrink:0">${esc(inicial)}</div>
        <span style="font-weight:500">${esc(c.nombre||'Sin nombre')}</span></div></td>
      <td style="font-family:var(--fm);font-size:.72rem;color:var(--text-m)">${esc(c.email||'—')}</td>
      <td style="font-family:var(--fm);font-size:.72rem">${nProj}</td>
      <td style="font-family:var(--fm);font-size:.68rem;color:var(--text-d)">${esc(fecha)}</td>
      <td><button class="btn-action" data-email="${esc(c.email)}" onclick="viewClientProjects(this.dataset.email)">Ver proyectos</button></td>
    </tr>`;
  }).join('');
}

// ── RENDER PROYECTOS ──
function renderProyectos(proyectos) {
  const tbody = document.getElementById('proyectos-tbody');
  if (!proyectos.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">Sin proyectos. Crea el primero →</td></tr>'; return; }
  tbody.innerHTML = proyectos.map(p => `<tr>
    <td><span style="font-weight:500">${esc(p.nombre||'Sin nombre')}</span></td>
    <td style="font-family:var(--fm);font-size:.7rem;color:var(--text-m)">${esc(p.clienteEmail||'—')}</td>
    <td style="font-family:var(--fm);font-size:.7rem">${esc(p.tipo||'—')}</td>
    <td><span class="badge badge-${esc(p.estado||'activo')}">${esc(p.estado||'activo')}</span></td>
    <td><div class="prog-wrap"><div class="prog-bar"><div class="prog-fill" style="width:${Number(p.progreso)||0}%"></div></div><span class="prog-pct">${Number(p.progreso)||0}%</span></div></td>
    <td>
      <button class="btn-action" data-id="${esc(p.id)}" onclick="editProyecto(this.dataset.id)">Editar</button>
      <button class="btn-action del" data-id="${esc(p.id)}" onclick="deleteItem('proyectos', this.dataset.id)">Eliminar</button>
    </td>
  </tr>`).join('');
}

// ── RENDER ARCHIVOS ──
function renderArchivos(archivos) {
  const tbody = document.getElementById('archivos-tbody');
  if (!archivos.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">Sin archivos registrados</td></tr>'; return; }
  tbody.innerHTML = archivos.map(a => {
    const fecha = a.subidoEn?.toDate?.()?.toLocaleDateString('es-MX') || '—';
    const url = safeUrl(a.url);
    return `<tr>
      <td>${esc(a.nombre||'—')}</td>
      <td style="font-family:var(--fm);font-size:.7rem;color:var(--text-m)">${esc(a.clienteEmail||'—')}</td>
      <td style="font-family:var(--fm);font-size:.7rem">${esc(a.proyecto||'—')}</td>
      <td style="font-family:var(--fm);font-size:.68rem;color:var(--text-d)">${esc(a.tamano||'—')}</td>
      <td style="font-family:var(--fm);font-size:.68rem;color:var(--text-d)">${esc(fecha)}</td>
      <td>
        ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="btn-action">Ver</a>` : ''}
        <button class="btn-action del" data-id="${esc(a.id)}" onclick="deleteItem('archivos', this.dataset.id)">Eliminar</button>
      </td>
    </tr>`;
  }).join('');
}

// ── RENDER FACTURAS ──
function renderFacturas(facturas) {
  const tbody = document.getElementById('facturas-tbody');
  if (!facturas.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">Sin facturas registradas</td></tr>'; return; }
  tbody.innerHTML = facturas.map(f => {
    const fecha = f.fecha?.toDate?.()?.toLocaleDateString('es-MX') || (f.fecha ? new Date(f.fecha).toLocaleDateString('es-MX') : '—');
    return `<tr>
      <td style="font-family:var(--fm);font-size:.7rem">#${esc(f.numero||'—')}</td>
      <td style="font-family:var(--fm);font-size:.7rem;color:var(--text-m)">${esc(f.clienteEmail||'—')}</td>
      <td>${esc(f.concepto||'—')}</td>
      <td style="font-family:var(--fm);font-size:.8rem;color:var(--rojo);font-weight:500">$${(Number(f.monto)||0).toLocaleString('es-MX')}</td>
      <td><span class="badge badge-${esc(f.estado||'pendiente')}">${esc(f.estado||'pendiente')}</span></td>
      <td style="font-family:var(--fm);font-size:.68rem;color:var(--text-d)">${esc(fecha)}</td>
      <td>
        <button class="btn-action" data-id="${esc(f.id)}" onclick="editFactura(this.dataset.id)">Editar</button>
        <button class="btn-action del" data-id="${esc(f.id)}" onclick="deleteItem('facturas', this.dataset.id)">Eliminar</button>
      </td>
    </tr>`;
  }).join('');
}

// ── MODALES ──
window.openModal = (type) => {
  document.getElementById('modal-' + type).classList.add('open');
  if (type === 'proyecto') {
    document.getElementById('modal-proyecto-title').textContent = 'Nuevo proyecto';
    document.getElementById('form-proyecto').reset();
    document.getElementById('p-id').value = '';
    document.getElementById('p-fecha').value = new Date().toISOString().split('T')[0];
  }
  if (type === 'factura') {
    document.getElementById('modal-factura-title').textContent = 'Nueva factura';
    document.getElementById('form-factura').reset();
    document.getElementById('f-id').value = '';
    document.getElementById('f-fecha').value = new Date().toISOString().split('T')[0];
    const num = 'KIT-' + String(Date.now()).slice(-4) + '-' + new Date().getFullYear();
    document.getElementById('f-numero').value = num;
  }
};
window.closeModal = (type) => {
  document.getElementById('modal-' + type).classList.remove('open');
};

// ── RESOLVER CLIENTE ──
// Busca el uid del cliente por email. Si no existe, retorna null (no el email).
// Así el clienteId queda consistente: o es el uid real, o null.
async function resolveClienteId(email) {
  const usersSnap = await getDocs(query(collection(db, 'usuarios'), where('email', '==', email)));
  return usersSnap.empty ? null : usersSnap.docs[0].id;
}

// ── RECONCILIACIÓN ──
// Cuando se crea un cliente (por el admin o al loguearse el cliente por primera vez),
// buscamos proyectos/archivos/facturas con clienteId null que coincidan por email
// y les asignamos el uid correcto.
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
      if (!d.data().clienteId || d.data().clienteId === clienteEmail) {
        batch.update(doc(db, col, d.id), { clienteId });
        updates++;
      }
    });
  }
  if (updates > 0) {
    await batch.commit();
    console.log(`Reconciliados ${updates} documentos para ${clienteEmail}`);
  }
}

// ── GUARDAR PROYECTO ──
window.saveProyecto = async (e) => {
  e.preventDefault();
  const id = document.getElementById('p-id').value;
  const clienteEmail = document.getElementById('p-cliente-email').value.trim().toLowerCase();
  const nombre = document.getElementById('p-nombre').value.trim();
  const progreso = parseInt(document.getElementById('p-progreso').value);

  if (!nombre) { showToast('El nombre es obligatorio', 'error'); return; }
  if (!clienteEmail.match(/.+@.+\..+/)) { showToast('Email de cliente inválido', 'error'); return; }
  if (isNaN(progreso) || progreso < 0 || progreso > 100) { showToast('Progreso debe estar entre 0 y 100', 'error'); return; }

  const clienteId = await resolveClienteId(clienteEmail);

  const data = {
    nombre,
    clienteId,
    clienteEmail,
    tipo: document.getElementById('p-tipo').value,
    estado: document.getElementById('p-estado').value,
    progreso,
    descripcion: document.getElementById('p-desc').value.trim(),
    fechaInicio: document.getElementById('p-fecha').value ? Timestamp.fromDate(new Date(document.getElementById('p-fecha').value)) : serverTimestamp(),
    actualizadoEn: serverTimestamp()
  };

  try {
    if (id) {
      await updateDoc(doc(db, 'proyectos', id), data);
      showToast('Proyecto actualizado ✓', 'success');
    } else {
      data.creadoEn = serverTimestamp();
      await addDoc(collection(db, 'proyectos'), data);
      showToast('Proyecto creado ✓', 'success');
    }
    closeModal('proyecto');
    await loadAll();
  } catch (err) {
    console.error(err);
    showToast('Error: ' + err.message, 'error');
  }
};

// ── EDITAR PROYECTO ──
window.editProyecto = async (id) => {
  try {
    const snap = await getDoc(doc(db, 'proyectos', id));
    if (!snap.exists()) return;
    const p = snap.data();
    document.getElementById('modal-proyecto-title').textContent = 'Editar proyecto';
    document.getElementById('p-id').value = id;
    document.getElementById('p-nombre').value = p.nombre || '';
    document.getElementById('p-cliente-email').value = p.clienteEmail || '';
    document.getElementById('p-tipo').value = p.tipo || 'Sitio web';
    document.getElementById('p-estado').value = p.estado || 'activo';
    document.getElementById('p-progreso').value = p.progreso || 0;
    document.getElementById('p-desc').value = p.descripcion || '';
    document.getElementById('p-fecha').value = p.fechaInicio?.toDate?.()?.toISOString().split('T')[0] || '';
    document.getElementById('modal-proyecto').classList.add('open');
  } catch (err) {
    showToast('Error al cargar: ' + err.message, 'error');
  }
};

// ── GUARDAR ARCHIVO ──
window.saveArchivo = async (e) => {
  e.preventDefault();
  const clienteEmail = document.getElementById('a-cliente-email').value.trim().toLowerCase();
  const nombre = document.getElementById('a-nombre').value.trim();
  const urlRaw = document.getElementById('a-url').value.trim();

  if (!nombre) { showToast('Nombre requerido', 'error'); return; }
  if (!clienteEmail.match(/.+@.+\..+/)) { showToast('Email inválido', 'error'); return; }
  if (urlRaw && !urlRaw.match(/^https:\/\//)) { showToast('La URL debe empezar con https://', 'error'); return; }

  const clienteId = await resolveClienteId(clienteEmail);

  const data = {
    nombre,
    clienteId, clienteEmail,
    proyecto: document.getElementById('a-proyecto').value.trim(),
    tamano: document.getElementById('a-tamano').value.trim(),
    url: urlRaw,
    subidoEn: serverTimestamp()
  };
  try {
    await addDoc(collection(db, 'archivos'), data);
    showToast('Archivo registrado ✓', 'success');
    closeModal('archivo');
    renderArchivos(await fetchArchivos());
  } catch (err) {
    console.error(err);
    showToast('Error: ' + err.message, 'error');
  }
};

// ── GUARDAR FACTURA ──
window.saveFactura = async (e) => {
  e.preventDefault();
  const id = document.getElementById('f-id').value;
  const clienteEmail = document.getElementById('f-cliente-email').value.trim().toLowerCase();
  const numero = document.getElementById('f-numero').value.trim();
  const concepto = document.getElementById('f-concepto').value.trim();
  const monto = parseFloat(document.getElementById('f-monto').value);
  const urlRaw = document.getElementById('f-url').value.trim();

  if (!numero) { showToast('Número requerido', 'error'); return; }
  if (!clienteEmail.match(/.+@.+\..+/)) { showToast('Email inválido', 'error'); return; }
  if (!concepto) { showToast('Concepto requerido', 'error'); return; }
  if (isNaN(monto) || monto <= 0 || monto >= 10000000) { showToast('Monto inválido', 'error'); return; }
  if (urlRaw && !urlRaw.match(/^https:\/\//)) { showToast('La URL debe empezar con https://', 'error'); return; }

  const clienteId = await resolveClienteId(clienteEmail);

  const fechaVal = document.getElementById('f-fecha').value;
  const data = {
    numero,
    clienteId, clienteEmail,
    concepto,
    monto,
    estado: document.getElementById('f-estado').value,
    url: urlRaw,
    fecha: fechaVal ? Timestamp.fromDate(new Date(fechaVal)) : serverTimestamp(),
    actualizadoEn: serverTimestamp()
  };
  try {
    if (id) {
      await updateDoc(doc(db, 'facturas', id), data);
      showToast('Factura actualizada ✓', 'success');
    } else {
      data.creadoEn = serverTimestamp();
      await addDoc(collection(db, 'facturas'), data);
      showToast('Factura creada ✓', 'success');
    }
    closeModal('factura');
    await loadAll();
  } catch (err) {
    console.error(err);
    showToast('Error: ' + err.message, 'error');
  }
};

// ── EDITAR FACTURA ──
window.editFactura = async (id) => {
  try {
    const snap = await getDoc(doc(db, 'facturas', id));
    if (!snap.exists()) return;
    const f = snap.data();
    document.getElementById('modal-factura-title').textContent = 'Editar factura';
    document.getElementById('f-id').value = id;
    document.getElementById('f-numero').value = f.numero || '';
    document.getElementById('f-cliente-email').value = f.clienteEmail || '';
    document.getElementById('f-concepto').value = f.concepto || '';
    document.getElementById('f-monto').value = f.monto || '';
    document.getElementById('f-estado').value = f.estado || 'pendiente';
    document.getElementById('f-url').value = f.url || '';
    document.getElementById('f-fecha').value = f.fecha?.toDate?.()?.toISOString().split('T')[0] || '';
    document.getElementById('modal-factura').classList.add('open');
  } catch (err) {
    showToast('Error al cargar: ' + err.message, 'error');
  }
};

// ── ELIMINAR ──
window.deleteItem = async (coleccion, id) => {
  if (!confirm('¿Segura que quieres eliminar este elemento?')) return;
  try {
    await deleteDoc(doc(db, coleccion, id));
    showToast('Eliminado ✓', 'success');
    await loadAll();
  } catch (err) {
    console.error(err);
    showToast('Error: ' + err.message, 'error');
  }
};

// ── VER PROYECTOS DE CLIENTE ──
window.viewClientProjects = (email) => {
  showTab('proyectos');
  setTimeout(() => {
    const search = document.querySelector('.search-input');
    if (search) { search.value = email; filterTable('proyectos-table', email); }
  }, 100);
};

// ── FILTRO TABLA ──
window.filterTable = (tableId, query) => {
  const q = String(query).toLowerCase();
  document.querySelectorAll(`#${tableId} tbody tr`).forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
};

// ── TOAST ──
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.className = 'toast', 3000);
}

// Cerrar modal con ESC
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ['proyecto','archivo','factura'].forEach(m => {
      document.getElementById('modal-' + m)?.classList.remove('open');
    });
  }
});
