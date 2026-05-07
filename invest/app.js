'use strict';

const STATE = {
  portfolio: [],
  alerts: [],
  decisions: [],
  settings: {
    initialCapital: 500,
    riskProfile: 'conservative',
    refreshInterval: 300000,
    claudeApiKey: '',
    finnhubApiKey: ''
  },
  prices: {},
  currentFilter: 'crypto',
  refreshTimer: null
};

const CRYPTO_LIST = [
  { symbol: 'BTC',  id: 'bitcoin',       name: 'Bitcoin',    icon: '₿' },
  { symbol: 'ETH',  id: 'ethereum',      name: 'Ethereum',   icon: 'Ξ' },
  { symbol: 'BNB',  id: 'binancecoin',   name: 'BNB',        icon: 'B' },
  { symbol: 'SOL',  id: 'solana',        name: 'Solana',     icon: '◎' },
  { symbol: 'XRP',  id: 'ripple',        name: 'XRP',        icon: 'X' },
  { symbol: 'ADA',  id: 'cardano',       name: 'Cardano',    icon: '₳' },
  { symbol: 'DOGE', id: 'dogecoin',      name: 'Dogecoin',   icon: 'D' },
  { symbol: 'AVAX', id: 'avalanche-2',   name: 'Avalanche',  icon: 'A' }
];

const STOCK_LIST = [
  { symbol: 'SPY',  name: 'S&P 500 ETF',  icon: '📊' },
  { symbol: 'QQQ',  name: 'Nasdaq ETF',   icon: '💹' },
  { symbol: 'AAPL', name: 'Apple',        icon: '🍎' },
  { symbol: 'MSFT', name: 'Microsoft',    icon: '🖥' },
  { symbol: 'TSLA', name: 'Tesla',        icon: '⚡' },
  { symbol: 'NVDA', name: 'NVIDIA',       icon: '🎮' },
  { symbol: 'AMZN', name: 'Amazon',       icon: '\ud83d�' },
  { symbol: 'GOOGL', name: 'Alphabet',   icon: '🔍' }
];

// ---------- INIT ----------

function initApp() {
  loadFromStorage();
  registerSW();
  setupNavigation();
  setupModals();
  setupListeners();
  applyRiskProfile();
  updateDashboard();
  fetchCryptoPrices();
  startAutoRefresh();
  if (STATE.settings.claudeApiKey) getDailyInsight();
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem('investai_v1');
    if (raw) {
      const data = JSON.parse(raw);
      STATE.portfolio  = data.portfolio  || [];
      STATE.alerts     = data.alerts     || [];
      STATE.decisions  = data.decisions  || [];
      STATE.prices     = data.prices     || {};
      if (data.settings) Object.assign(STATE.settings, data.settings);
    }
  } catch (e) { console.warn('Storage load error', e); }
}

function save() {
  try {
    localStorage.setItem('investai_v1', JSON.stringify({
      portfolio:  STATE.portfolio,
      alerts:     STATE.alerts,
      decisions:  STATE.decisions,
      prices:     STATE.prices,
      settings:   STATE.settings
    }));
  } catch (e) {}
}

async function registerSW() {
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/invest/sw.js'); } catch (e) {}
  }
}

// ---------- NAVIGATION ----------

function setupNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tab) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector(`.nav-btn[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
  if (tab === 'market')    renderMarketList();
  if (tab === 'portfolio') renderPositions();
  if (tab === 'alerts')    renderAlerts();
  if (tab === 'ai')        { renderDecisionsHistory(); loadApiUI(); }
}

// ---------- MODALS ----------

function setupModals() {
  document.querySelectorAll('.modal-close').forEach(btn =>
    btn.addEventListener('click', () => closeModal(btn.dataset.modal))
  );
  document.querySelectorAll('.modal-overlay').forEach(overlay =>
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); })
  );
}

const openModal  = id => document.getElementById(id).classList.add('open');
const closeModal = id => document.getElementById(id).classList.remove('open');

// ---------- EVENT LISTENERS ----------

function setupListeners() {
  $('#notif-btn').addEventListener('click', requestNotifPermission);
  $('#settings-btn').addEventListener('click', () => { loadSettingsUI(); openModal('modal-settings'); });

  $('#add-position-btn').addEventListener('click', () => {
    $('#pos-date').value = new Date().toISOString().split('T')[0];
    openModal('modal-position');
  });
  $('#save-position-btn').addEventListener('click', savePosition);

  $('#add-alert-btn').addEventListener('click', () => openModal('modal-alert'));
  $('#save-alert-btn').addEventListener('click', saveAlert);

  $('#save-settings-btn').addEventListener('click', saveSettings);
  $('#export-data-btn').addEventListener('click', exportData);
  $('#clear-data-btn').addEventListener('click', clearData);

  $('#save-keys-btn').addEventListener('click', saveApiKeys);
  $('#get-analysis-btn').addEventListener('click', getFullAnalysis);
  $('#refresh-insight').addEventListener('click', getDailyInsight);

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.currentFilter = btn.dataset.filter;
      renderMarketList();
    });
  });
}

const $ = id => document.getElementById(id);

// ---------- CRYPTO PRICES (CoinGecko — free, no key) ----------

async function fetchCryptoPrices() {
  const ids = CRYPTO_LIST.map(c => c.id).join(',');
  try {
    const res  = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`);
    const data = await res.json();
    CRYPTO_LIST.forEach(c => {
      const d = data[c.id];
      if (d) STATE.prices[c.symbol] = { price: d.usd, change24h: d.usd_24h_change, type: 'crypto', name: c.name, icon: c.icon, ts: Date.now() };
    });
    save();
    updateDashboard();
    checkAlerts();
    if (document.querySelector('.nav-btn[data-tab="market"].active')) renderMarketList();
  } catch (e) {
    toast('No se pudo actualizar precios cripto');
  }
}

// ---------- STOCK PRICES (Finnhub — free, user key) ----------

async function fetchStockPrices() {
  const key = STATE.settings.finnhubApiKey;
  if (!key) return;
  for (const s of STOCK_LIST) {
    try {
      const res  = await fetch(`https://finnhub.io/api/v1/quote?symbol=${s.symbol}&token=${key}`);
      const data = await res.json();
      if (data.c) {
        STATE.prices[s.symbol] = {
          price:    data.c,
          change24h: ((data.c - data.pc) / data.pc) * 100,
          type:     'stock',
          name:     s.name,
          icon:     s.icon,
          ts:       Date.now()
        };
      }
      await delay(200);
    } catch (e) {}
  }
  save();
  updateDashboard();
  if (document.querySelector('.nav-btn[data-tab="market"].active')) renderMarketList();
}

const delay = ms => new Promise(r => setTimeout(r, ms));

// ---------- DASHBOARD ----------

function updateDashboard() {
  const invested = STATE.portfolio.reduce((s, p) => s + p.buyPrice * p.amount, 0);
  const current  = STATE.portfolio.reduce((s, p) => {
    const pr = STATE.prices[p.symbol]?.price ?? p.buyPrice;
    return s + pr * p.amount;
  }, 0);

  const pnl    = current - invested;
  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
  const avail  = Math.max(0, STATE.settings.initialCapital - invested);

  $('total-value').textContent    = fmtUSD(current || STATE.settings.initialCapital);
  $('invested-amount').textContent = fmtUSD(invested);
  $('available-amount').textContent = fmtUSD(avail);

  const pnlEl = $('total-pnl');
  pnlEl.textContent = `${pnl >= 0 ? '+' : ''}${fmtUSD(pnl)} (${pnl >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`;
  pnlEl.className   = `portfolio-pnl ${pnl >= 0 ? 'positive' : 'negative'}`;

  renderTopMovers();
}

function renderTopMovers() {
  const el = $('top-movers');
  const entries = Object.entries(STATE.prices)
    .filter(([, d]) => d.change24h != null)
    .sort((a, b) => Math.abs(b[1].change24h) - Math.abs(a[1].change24h))
    .slice(0, 5);

  if (!entries.length) { el.innerHTML = '<p class="empty-state">Cargando mercado…</p>'; return; }

  el.innerHTML = entries.map(([sym, d]) => `
    <div class="mover-item">
      <span style="font-weight:600">${sym}</span>
      <span>${fmtUSD(d.price)}</span>
      <span class="price-change ${d.change24h >= 0 ? 'positive' : 'negative'}">
        ${d.change24h >= 0 ? '▲' : '▼'} ${Math.abs(d.change24h).toFixed(2)}%
      </span>
    </div>`).join('');
}

// ---------- MARKET LIST ----------

function renderMarketList() {
  const el     = $('market-list');
  const filter = STATE.currentFilter;
  const list   = filter === 'crypto' ? CRYPTO_LIST : STOCK_LIST;

  let html = '';

  if (filter === 'stocks' && !STATE.settings.finnhubApiKey) {
    html += `<div class="card warning-card">⚠️ Para ver precios de acciones en tiempo real, agrega tu API key gratuita de <strong>Finnhub.io</strong> en la pestaña 🤖 IA.</div>`;
  }

  html += list.map(item => {
    const d = STATE.prices[item.symbol];
    return `
      <div class="market-item">
        <div class="asset-icon">${item.icon}</div>
        <div class="asset-info">
          <div class="asset-name">${item.name}</div>
          <div class="asset-symbol">${item.symbol}</div>
        </div>
        <div class="asset-price">
          <div class="price-value">${d ? fmtUSD(d.price) : '—'}</div>
          <div class="price-change ${d && d.change24h >= 0 ? 'positive' : 'negative'}">
            ${d && d.change24h != null ? `${d.change24h >= 0 ? '▲' : '▼'} ${Math.abs(d.change24h).toFixed(2)}%` : '—'}
          </div>
        </div>
        <button class="ai-btn" onclick="quickAI('${item.symbol}','${item.name}')">🤖 IA</button>
      </div>`;
  }).join('');

  el.innerHTML = html;
}

// ---------- PORTFOLIO ----------

function savePosition() {
  const type     = $('pos-asset-type').value;
  const symbol   = $('pos-symbol').value.trim().toUpperCase();
  const amount   = parseFloat($('pos-amount').value);
  const buyPrice = parseFloat($('pos-buy-price').value);
  const date     = $('pos-date').value;

  if (!symbol || !amount || !buyPrice) { toast('Completa todos los campos'); return; }

  STATE.portfolio.push({ id: Date.now(), type, symbol, amount, buyPrice, date });
  addDecision('COMPRA', symbol, amount, buyPrice);
  save();
  updateDashboard();
  renderPositions();
  closeModal('modal-position');
  toast(`✓ Posición ${symbol} agregada`);
  ['pos-symbol', 'pos-amount', 'pos-buy-price'].forEach(id => $(id).value = '');
}

function renderPositions() {
  const el = $('positions-list');
  if (!STATE.portfolio.length) {
    el.innerHTML = '<p class="empty-state">💼 No tienes inversiones aún. ¡Agrega tu primera posición!</p>';
    return;
  }
  el.innerHTML = STATE.portfolio.map(pos => {
    const curPrice = STATE.prices[pos.symbol]?.price ?? pos.buyPrice;
    const curVal   = curPrice * pos.amount;
    const invVal   = pos.buyPrice * pos.amount;
    const pnl      = curVal - invVal;
    const pnlPct   = (pnl / invVal) * 100;
    return `
      <div class="position-item">
        <div class="position-header">
          <div><span class="position-symbol">${pos.symbol}</span><span class="position-type">${pos.type === 'crypto' ? 'CRIPTO' : 'ACCIÓN'}</span></div>
          <button class="alert-delete" onclick="removePosition(${pos.id})">🗑</button>
        </div>
        <div class="position-details">
          <div><div class="position-detail-label">Cantidad</div><div class="position-detail-value">${pos.amount}</div></div>
          <div><div class="position-detail-label">Compra</div><div class="position-detail-value">${fmtUSD(pos.buyPrice)}</div></div>
          <div><div class="position-detail-label">Actual</div><div class="position-detail-value">${fmtUSD(curPrice)}</div></div>
          <div><div class="position-detail-label">Invertido</div><div class="position-detail-value">${fmtUSD(invVal)}</div></div>
          <div><div class="position-detail-label">Valor</div><div class="position-detail-value">${fmtUSD(curVal)}</div></div>
          <div><div class="position-detail-label">P&L</div><div class="position-detail-value" style="color:${pnl>=0?'var(--success)':'var(--danger)'}">${pnl>=0?'+':''}${fmtUSD(pnl)} (${pnlPct.toFixed(1)}%)</div></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn-small" onclick="quickAI('${pos.symbol}','${pos.symbol}')">🤖 Analizar</button>
          <button class="btn-small" onclick="recordSell(${pos.id},${curPrice})">💰 Registrar Venta</button>
        </div>
      </div>`;
  }).join('');
}

function removePosition(id) {
  if (!confirm('¿Eliminar esta posición?')) return;
  STATE.portfolio = STATE.portfolio.filter(p => p.id !== id);
  save(); updateDashboard(); renderPositions();
}

function recordSell(id, price) {
  const pos = STATE.portfolio.find(p => p.id === id);
  if (!pos) return;
  addDecision('VENTA', pos.symbol, pos.amount, price);
  STATE.portfolio = STATE.portfolio.filter(p => p.id !== id);
  save(); updateDashboard(); renderPositions();
  toast(`✓ Venta de ${pos.symbol} registrada`);
}

// ---------- ALERTS ----------

function saveAlert() {
  const type        = $('alert-asset-type').value;
  const symbol      = $('alert-symbol').value.trim().toUpperCase();
  const condition   = $('alert-condition').value;
  const targetPrice = parseFloat($('alert-price').value);
  if (!symbol || !targetPrice) { toast('Completa todos los campos'); return; }
  STATE.alerts.push({ id: Date.now(), type, symbol, condition, targetPrice, active: true });
  save(); renderAlerts(); closeModal('modal-alert');
  toast(`✓ Alerta ${symbol} activada`);
  ['alert-symbol', 'alert-price'].forEach(id => $(id).value = '');
}

function renderAlerts() {
  const el = $('alerts-list');
  if (!STATE.alerts.length) { el.innerHTML = '<p class="empty-state">🔔 No tienes alertas configuradas.</p>'; return; }
  el.innerHTML = STATE.alerts.map(a => `
    <div class="alert-item">
      <div class="alert-info">
        <div class="alert-symbol">${a.symbol}</div>
        <div class="alert-condition">${a.condition === 'above' ? '↑ Sube a' : '↓ Baja a'} ${fmtUSD(a.targetPrice)}</div>
      </div>
      <span class="alert-status">${a.active ? 'ACTIVA' : 'DISPARADA'}</span>
      <button class="alert-delete" onclick="removeAlert(${a.id})">✕</button>
    </div>`).join('');
}

function removeAlert(id) {
  STATE.alerts = STATE.alerts.filter(a => a.id !== id);
  save(); renderAlerts();
}

function checkAlerts() {
  let changed = false;
  STATE.alerts.forEach(a => {
    if (!a.active) return;
    const pr = STATE.prices[a.symbol]?.price;
    if (!pr) return;
    const hit = a.condition === 'above' ? pr >= a.targetPrice : pr <= a.targetPrice;
    if (hit) {
      const msg = `${a.symbol} ${a.condition === 'above' ? 'subió a' : 'bajó a'} ${fmtUSD(pr)}`;
      notify('🚨 Alerta InvestAI', msg);
      toast(`🚨 ${msg}`);
      a.active = false;
      changed = true;
    }
  });
  if (changed) { save(); renderAlerts(); }
}

// ---------- NOTIFICATIONS ----------

async function requestNotifPermission() {
  if (!('Notification' in window)) { toast('Tu navegador no soporta notificaciones'); return; }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    toast('✓ Notificaciones activadas');
    notify('InvestAI', '¡Notificaciones activadas! Te avisaré cuando tus alertas se disparen.');
  } else {
    toast('Notificaciones denegadas');
  }
}

function notify(title, body) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/invest/icon.svg' });
  }
}

// ---------- AI (Claude API) ----------

async function getFullAnalysis() {
  const key = STATE.settings.claudeApiKey;
  if (!key) { toast('Configura tu Claude API Key en la pestaña IA'); return; }

  const out = $('ai-analysis-output');
  out.className = 'ai-output loading';
  out.textContent = 'Analizando mercado y portafolio…';

  const mkt = Object.entries(STATE.prices).slice(0, 12)
    .map(([s, d]) => `${s}: ${fmtUSD(d.price)} (${d.change24h?.toFixed(2) ?? '?'}% 24h)`).join(', ');

  const port = STATE.portfolio.length
    ? STATE.portfolio.map(p => {
        const cur = STATE.prices[p.symbol]?.price ?? p.buyPrice;
        const pnlPct = ((cur - p.buyPrice) / p.buyPrice * 100).toFixed(1);
        return `${p.symbol}: ${p.amount} @ ${fmtUSD(p.buyPrice)} (actual ${fmtUSD(cur)}, ${pnlPct}%)`;
      }).join('\n')
    : 'Sin posiciones abiertas';

  const hist = STATE.decisions.slice(0, 6)
    .map(d => `${d.action} ${d.symbol} ${d.amount > 0 ? `x${d.amount} @ ${fmtUSD(d.price)}` : ''}`.trim())
    .join('\n') || 'Sin historial';

  const prompt = `Eres un asesor financiero conservador para un inversionista latinoamericano principiante.

Perfil:
- Capital disponible: ${fmtUSD(STATE.settings.initialCapital)} USD
- Capital invertido: ${fmtUSD(STATE.portfolio.reduce((s,p)=>s+p.buyPrice*p.amount,0))} USD
- Perfil de riesgo: ${STATE.settings.riskProfile === 'conservative' ? 'Conservador' : STATE.settings.riskProfile === 'moderate' ? 'Moderado' : 'Agresivo'}

Mercado actual:
${mkt}

Portafolio:
${port}

Historial reciente:
${hist}

Proporciona:
1. **Resumen del mercado** (2-3 oraciones)
2. **Recomendaciones** (máx 3, con COMPRAR/VENDER/MANTENER y razón breve)
3. **Alerta importante** si hay algo urgente
4. **Riesgo actual**: BAJO / MEDIO / ALTO para perfil conservador

Seá directo y en español. Recuerda que el usuario tiene menos de $500 USD.`;

  try {
    const res  = await claudeCall(key, prompt, 1024);
    out.className = 'ai-output';
    out.innerHTML = fmtAI(res);
    addDecision('ANÁLISIS IA', 'MERCADO', 0, 0);
  } catch (e) {
    out.className = 'ai-output';
    out.textContent = `Error: ${e.message}. Verifica tu API key.`;
  }
}

async function getDailyInsight() {
  const key = STATE.settings.claudeApiKey;
  if (!key) return;
  const el = $('ai-insight');
  el.textContent = 'Cargando consejo del día…';

  const top = Object.entries(STATE.prices)
    .sort((a, b) => Math.abs(b[1].change24h ?? 0) - Math.abs(a[1].change24h ?? 0))
    .slice(0, 3).map(([s, d]) => `${s} ${d.change24h?.toFixed(2)}%`).join(', ');

  const prompt = `Eres asesor financiero conservador. Movimientos hoy: ${top || 'sin datos'}.
Da UN consejo breve (máx 2 oraciones) para inversionista conservador con menos de $500 USD. En español.`;

  try {
    el.textContent = await claudeCall(key, prompt, 150);
  } catch (e) {
    el.textContent = 'No se pudo cargar el consejo del día.';
  }
}

window.quickAI = async function(symbol, name) {
  const key = STATE.settings.claudeApiKey;
  if (!key) { toast('Configura tu Claude API Key en 🤖 IA'); switchTab('ai'); return; }

  const d = STATE.prices[symbol];
  const info = d ? `Precio: ${fmtUSD(d.price)}, Cambio 24h: ${d.change24h?.toFixed(2)}%` : 'Sin datos de precio';

  toast(`🤖 Analizando ${symbol}…`);

  const prompt = `Analiza brevemente ${name} (${symbol}) para un inversionista conservador con <$500 USD.
${info}
Da en 3 puntos:
1. Señal: COMPRAR / MANTENER / VENDER
2. Razón (1 oración)
3. Riesgo: BAJO / MEDIO / ALTO
En español, muy breve.`;

  try {
    const res = await claudeCall(key, prompt, 200);
    switchTab('ai');
    const out = $('ai-analysis-output');
    out.className = 'ai-output';
    out.innerHTML = `<strong>Análisis rápido: ${symbol}</strong><br><br>${fmtAI(res)}`;
  } catch (e) {
    toast('Error al obtener análisis');
  }
};

async function claudeCall(apiKey, prompt, maxTokens) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content[0].text;
}

// ---------- DECISIONS ----------

function addDecision(action, symbol, amount, price) {
  STATE.decisions.unshift({ id: Date.now(), action, symbol, amount, price, date: new Date().toLocaleDateString('es-MX') });
  STATE.decisions = STATE.decisions.slice(0, 50);
  save();
}

function renderDecisionsHistory() {
  const el = $('decisions-history');
  if (!STATE.decisions.length) { el.innerHTML = '<p class="empty-state">Aún no hay decisiones registradas.</p>'; return; }
  const map = { 'COMPRA': 'buy', 'VENTA': 'sell', 'ANÁLISIS IA': 'hold' };
  el.innerHTML = STATE.decisions.slice(0, 20).map(d => `
    <div class="decision-item">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="decision-action ${map[d.action] || 'hold'}">${d.action} ${d.symbol}</span>
        <span style="color:var(--text-secondary);font-size:11px">${d.date}</span>
      </div>
      ${d.amount > 0 ? `<div style="color:var(--text-secondary);margin-top:2px">${d.amount} @ ${fmtUSD(d.price)}</div>` : ''}
    </div>`).join('');
}

// ---------- SETTINGS ----------

function loadApiUI() {
  $('claude-api-key').value  = STATE.settings.claudeApiKey  ? '•'.repeat(16) : '';
  $('finnhub-api-key').value = STATE.settings.finnhubApiKey ? '•'.repeat(16) : '';
}

function saveApiKeys() {
  const ck = $('claude-api-key').value;
  const fk = $('finnhub-api-key').value;
  if (ck && !ck.includes('•')) STATE.settings.claudeApiKey  = ck.trim();
  if (fk && !fk.includes('•')) STATE.settings.finnhubApiKey = fk.trim();
  save(); toast('✓ Claves guardadas');
  if (STATE.settings.claudeApiKey)  getDailyInsight();
  if (STATE.settings.finnhubApiKey) fetchStockPrices();
}

function loadSettingsUI() {
  $('initial-capital').value  = STATE.settings.initialCapital;
  $('risk-profile').value     = STATE.settings.riskProfile;
  $('refresh-interval').value = STATE.settings.refreshInterval;
}

function saveSettings() {
  STATE.settings.initialCapital   = parseFloat($('initial-capital').value) || 500;
  STATE.settings.riskProfile      = $('risk-profile').value;
  STATE.settings.refreshInterval  = parseInt($('refresh-interval').value);
  save(); applyRiskProfile(); closeModal('modal-settings'); toast('✓ Configuración guardada');
  startAutoRefresh();
}

function applyRiskProfile() {
  const map = {
    conservative: { w: '20%', desc: 'Perfil: Conservador — Prioriza preservar capital' },
    moderate:     { w: '55%', desc: 'Perfil: Moderado — Balance riesgo/ganancia' },
    aggressive:   { w: '90%', desc: 'Perfil: Agresivo — Busca máximas ganancias' }
  };
  const r = map[STATE.settings.riskProfile] || map.conservative;
  $('risk-fill').style.width = r.w;
  $('risk-desc').textContent = r.desc;
}

function exportData() {
  const d = { ...STATE, settings: { ...STATE.settings, claudeApiKey: '***', finnhubApiKey: '***' }, exportDate: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `investai-${Date.now()}.json` });
  a.click(); URL.revokeObjectURL(a.href);
}

function clearData() {
  if (!confirm('¿Eliminar TODOS los datos? Esta acción no se puede deshacer.')) return;
  localStorage.removeItem('investai_v1');
  location.reload();
}

// ---------- AUTO REFRESH ----------

function startAutoRefresh() {
  if (STATE.refreshTimer) clearInterval(STATE.refreshTimer);
  STATE.refreshTimer = setInterval(() => {
    fetchCryptoPrices();
    if (STATE.settings.finnhubApiKey) fetchStockPrices();
  }, STATE.settings.refreshInterval);
}

// ---------- HELPERS ----------

function fmtUSD(n) {
  if (n == null) return '$0.00';
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1)    return '$' + n.toFixed(4);
  return '$' + n.toFixed(8);
}

function fmtAI(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
    .replace(/\bCOMPRAR\b/g, '<span class="rec-badge rec-buy">COMPRAR</span>')
    .replace(/\bVENDER\b/g, '<span class="rec-badge rec-sell">VENDER</span>')
    .replace(/\bMANTENER\b/g, '<span class="rec-badge rec-hold">MANTENER</span>');
}

function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ---------- START ----------
document.addEventListener('DOMContentLoaded', initApp);
