// Núcleo: cliente Supabase, formatos, utilidades de interfaz.
(function () {
  const E = (window.E = { pages: {}, S: {} });
  const cfg = window.EMCALA_CONFIG;
  E.sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

  // ---------- HTML seguro ----------
  class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const part = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(part).join('') : esc(v));
  E.raw = (s) => new Raw(s);
  E.h = (strings, ...vals) => new Raw(strings.reduce((a, s, i) => a + s + (i < vals.length ? part(vals[i]) : ''), ''));
  E.esc = esc;
  const h = E.h;
  E.$ = (sel, root = document) => root.querySelector(sel);
  E.$$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ---------- Formatos es-AR ----------
  const nf = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  E.money = (n) => (n == null || n === '' ? '—' : nf.format(Number(n)).replace(/ /g, ' '));
  E.moneyShort = (n) => {
    n = Number(n || 0); const a = Math.abs(n);
    if (a >= 1e6) return '$ ' + (n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' M';
    if (a >= 1e3) return '$ ' + (n / 1e3).toLocaleString('es-AR', { maximumFractionDigits: 0 }) + ' mil';
    return '$ ' + n.toLocaleString('es-AR');
  };
  E.num = (n) => Number(n || 0).toLocaleString('es-AR');
  E.pct = (n) => (n == null ? '—' : Number(n).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' %');
  E.date = (s) => { if (!s) return '—'; const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : s; };
  const dtf = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  E.dt = (s) => (s ? dtf.format(new Date(s)).replace(',', '') : '—');
  E.time = (s) => (s ? String(s).slice(0, 5) : '');
  E.todayAR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  E.monthName = (m) => MONTHS[m - 1];
  E.monthLabel = (ym) => { const [y, m] = ym.split('-'); return MONTHS[+m - 1].slice(0, 3) + ' ' + y.slice(2); };
  // "85.000,50" / "85000.5" / "$ 1.234,56" -> "85000.50" (texto para enviar a la base) o null
  E.parseMoney = (v) => {
    let s = String(v ?? '').replace(/[$\s]/g, '');
    if (!s) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    return /^\d+(\.\d+)?$/.test(s) ? s : null;
  };
  E.moneyStr = (n) => (n == null ? '' : Number(n).toFixed(2).replace('.', ','));

  // ---------- Etiquetas ----------
  E.ROLES = { admin: 'Administrador', authorizer: 'Resp. de autorización', requester: 'Solicitante', loader: 'Resp. de carga / rendición' };
  E.METHODS = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', cuenta_corriente: 'Cuenta corriente', otro: 'Otro' };
  E.EXP_STATUS = { rendido: 'Rendido', pendiente_comprobante: 'Pendiente de comprobante', anulado: 'Anulado' };
  E.REQ_STATUS = { borrador: 'Borrador', pendiente: 'Pendiente', en_revision: 'En revisión', aprobada: 'Aprobada', rechazada: 'Rechazada', cancelada: 'Cancelada', compra_realizada: 'Compra realizada', cerrada: 'Cerrada' };
  E.PRIORITY = { baja: 'Baja', normal: 'Normal', alta: 'Alta', urgente: 'Urgente' };
  E.badge = (status) => {
    const label = E.EXP_STATUS[status] || E.REQ_STATUS[status] || status;
    const tone = { rendido: 'ok', aprobada: 'ok', cerrada: 'muted', compra_realizada: 'info', pendiente_comprobante: 'warn', pendiente: 'warn', en_revision: 'warn',
      anulado: 'bad', rechazada: 'bad', cancelada: 'muted', borrador: 'muted' }[status] || 'muted';
    return h`<span class="badge b-${tone}">${label}</span>`;
  };
  E.demoTag = (isDemo) => (isDemo ? h` <span class="badge b-demo">DEMO</span>` : E.raw(''));

  // ---------- Errores y llamadas ----------
  class AppError extends Error { constructor(msg, code, extra) { super(msg); this.code = code; this.extra = extra || {}; } }
  E.AppError = AppError;
  function wrap(error) {
    let extra = {}; try { extra = error.hint ? JSON.parse(error.hint) : {}; } catch { /* sin datos extra */ }
    const known = ['VALIDATION', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'DUPLICATE', 'OVER_AUTHORIZED', 'ALREADY_LINKED'];
    const code = known.includes(error.details) ? error.details : error.code === '42501' ? 'FORBIDDEN' : 'ERROR';
    let msg = error.message || 'Error inesperado';
    if (code === 'ERROR' && /Failed to fetch|NetworkError|network/i.test(msg)) msg = 'No hay conexión con el servidor. Revise su internet e intente de nuevo.';
    if (error.code === '42501') msg = 'No tiene permisos para esta acción.';
    return new AppError(msg, code, extra);
  }
  E.rpc = async (fn, args = {}) => { const { data, error } = await E.sb.rpc(fn, args); if (error) throw wrap(error); return data; };
  E.db = async (query) => { const { data, error, count } = await query; if (error) throw wrap(error); E._count = count; return data; };

  // ---------- Avisos y diálogos ----------
  E.toast = (msg, type = 'ok') => {
    const t = document.createElement('div'); t.className = 'toast t-' + type; t.textContent = msg; E.$('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), type === 'bad' ? 6000 : 3200); setTimeout(() => t.remove(), type === 'bad' ? 6400 : 3600);
  };
  E.fail = (e) => { console.error(e); E.toast(e.message || 'Error inesperado', 'bad'); };
  E.modal = (title, body, opts = {}) => {
    const wrapEl = document.createElement('div'); wrapEl.className = 'overlay';
    wrapEl.innerHTML = `<div class="dialog ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Cerrar">✕</button></header><div class="dlg-body"></div></div>`;
    const bodyEl = E.$('.dlg-body', wrapEl);
    if (body instanceof Node) bodyEl.appendChild(body); else bodyEl.innerHTML = String(body);
    const prevFocus = document.activeElement;
    const api = { el: wrapEl, body: bodyEl, close() { wrapEl.remove(); document.removeEventListener('keydown', onKey); prevFocus?.focus?.(); opts.onClose?.(); } };
    const onKey = (ev) => { if (ev.key === 'Escape' && [...document.querySelectorAll('.overlay')].pop() === wrapEl) api.close(); };
    document.addEventListener('keydown', onKey);
    wrapEl.addEventListener('mousedown', (ev) => { if (ev.target === wrapEl && !opts.sticky) api.close(); });
    E.$('[data-close]', wrapEl).onclick = api.close;
    document.body.appendChild(wrapEl);
    (E.$('[autofocus]', wrapEl) || E.$('input,select,textarea,button:not([data-close])', wrapEl))?.focus();
    return api;
  };
  // Diálogo de confirmación con campo de texto opcional. Devuelve texto (o true) o null si se cancela.
  E.ask = (title, message, { label, required = false, confirm = 'Confirmar', danger = false, minLen = 3, value = '', type = 'text' } = {}) =>
    new Promise((resolve) => {
      let done = false;
      const m = E.modal(title, '', { onClose: () => { if (!done) resolve(null); }, sticky: true });
      m.body.innerHTML = `<p>${esc(message)}</p>${label ? `<label class="fld"><span>${esc(label)}</span>${type === 'textarea' || required ? `<textarea rows="3" name="v" autofocus>${esc(value)}</textarea>` : `<input name="v" value="${esc(value)}">`}</label>` : ''}
        <p class="err" hidden></p><footer class="dlg-foot"><button class="btn" data-no>Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(confirm)}</button></footer>`;
      E.$('[data-no]', m.body).onclick = () => m.close();
      E.$('[data-yes]', m.body).onclick = () => {
        const v = label ? E.$('[name=v]', m.body).value.trim() : true;
        if (label && required && String(v).length < minLen) { const er = E.$('.err', m.body); er.hidden = false; er.textContent = `Complete este campo (mínimo ${minLen} caracteres).`; return; }
        done = true; m.close(); resolve(v);
      };
    });
  E.busy = async (btn, fn) => { // evita doble envío
    if (btn.disabled) return; const t = btn.textContent; btn.disabled = true; btn.textContent = 'Procesando…';
    try { return await fn(); } finally { btn.disabled = false; btn.textContent = t; }
  };
  E.debounce = (fn, ms = 350) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  // ---------- Permisos (la base los aplica igual; esto solo decide qué mostrar) ----------
  E.role = () => E.S.profile?.role;
  E.can = {
    read: () => ['admin', 'authorizer', 'loader'].includes(E.role()),
    createExpense: () => ['admin', 'loader'].includes(E.role()),
    editExpense: (e) => e.status !== 'anulado' && (E.role() === 'admin' || (E.role() === 'loader' && e.created_by === E.S.profile.id)),
    voidExpense: (e) => E.role() === 'admin' && e.status !== 'anulado',
    attachExpense: (e) => ['admin', 'loader'].includes(E.role()) && e.status !== 'anulado',
    createRequest: () => ['admin', 'requester'].includes(E.role()),
    decide: () => ['admin', 'authorizer'].includes(E.role()),
    admin: () => E.role() === 'admin',
  };

  // ---------- Catálogos ----------
  E.loadCatalogs = async () => {
    const [sectors, categories, payers, settings, us] = await Promise.all([
      E.db(E.sb.from('sectors').select('*').order('sort').order('name')),
      E.db(E.sb.from('categories').select('*').order('name')),
      E.db(E.sb.from('payers').select('*').order('name')),
      E.db(E.sb.from('settings').select('*')),
      E.db(E.sb.from('user_sectors').select('sector_id').eq('user_id', E.S.profile.id)),
    ]);
    Object.assign(E.S, { sectors, categories, payers, settings: Object.fromEntries(settings.map((s) => [s.key, s.value])) });
    const mine = us.map((x) => x.sector_id);
    E.S.mySectors = mine; // vacío = todos
  };
  E.activeSectors = () => E.S.sectors.filter((s) => s.active && (E.role() === 'admin' || !E.S.mySectors.length || E.S.mySectors.includes(s.id)));
  E.optionsHtml = (items, sel, { empty } = {}) =>
    (empty != null ? `<option value="">${esc(empty)}</option>` : '') + items.map((i) => `<option value="${i.id ?? i.value}" ${String(i.id ?? i.value) === String(sel ?? '') ? 'selected' : ''}>${esc(i.name ?? i.label)}</option>`).join('');

  // ---------- Gráficos ----------
  E.charts = [];
  E.destroyCharts = () => { E.charts.forEach((c) => c.destroy()); E.charts = []; };
  const PAL = ['#0f5c5c', '#c8742b', '#3b6fb6', '#8a5a9e', '#6b8e23', '#b8485f', '#5f6b7a'];
  E.PAL = PAL;
  E.chart = (canvas, cfg) => {
    Chart.defaults.font.family = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'; Chart.defaults.color = '#5b6670';
    const c = new Chart(canvas, cfg); E.charts.push(c); return c;
  };

  // ---------- Descargas ----------
  E.download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
})();
