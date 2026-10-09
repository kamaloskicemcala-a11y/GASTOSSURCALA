// Páginas: Dashboard, Gastos, Solicitudes y la vista de búsqueda compartida (Gastos / Historial).
(function () {
  const E = window.E, h = E.h, esc = E.esc;
  const head = (title, sub, actions = '') => h`<div class="top"><div style="display:flex;gap:10px;align-items:center"><button class="btn menu-btn" data-menu aria-label="Menú">☰</button><div><h1>${title}</h1>${sub ? h`<div class="sub">${sub}</div>` : ''}</div></div><div class="actions">${E.raw(actions)}</div></div>`;
  E.head = head;
  const delta = (p) => (p == null ? '' : `<span class="${p > 0 ? 'up' : p < 0 ? 'down' : ''}">${p > 0 ? '▲' : p < 0 ? '▼' : '='} ${E.pct(Math.abs(p))}</span>`);

  // ============ DASHBOARD ============
  E.pages.dashboard = async (root) => {
    const st = (E.S.dash ||= { period: 'month', from: '', to: '' });
    root.innerHTML = head('Dashboard', `Resumen de gastos y autorizaciones · ${E.esc(E.S.settings.company_name || 'EMCALA SRL')}`).s + `
      <div class="chips" data-chips>${[['day', 'Hoy'], ['week', 'Semana'], ['month', 'Mes'], ['quarter', 'Trimestre'], ['year', 'Año'], ['custom', 'Personalizado']].map(([k, l]) => `<button class="chip ${st.period === k ? 'on' : ''}" data-p="${k}">${l}</button>`).join('')}</div>
      <div class="filters" data-custom ${st.period === 'custom' ? '' : 'hidden'}><label class="fld"><span>Desde</span><input type="date" name="from" value="${st.from}"></label><label class="fld"><span>Hasta</span><input type="date" name="to" value="${st.to}"></label><button class="btn" data-apply>Aplicar</button></div>
      <div data-body><div class="boot">Cargando…</div></div>`;
    const body = E.$('[data-body]', root);
    const load = async () => {
      const args = { p_period: st.period }; if (st.period === 'custom') { if (!st.from || !st.to) { body.innerHTML = '<div class="empty">Elija el rango de fechas.</div>'; return; } args.p_from = st.from; args.p_to = st.to; }
      let d, b; try { [d, b] = await Promise.all([E.rpc('dashboard', { p_ref: E.todayAR(), ...args }), E.rpc('budgets_report', {})]); } catch (e) { body.innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; return; }
      const k = d.kpis, lbl = { day: 'hoy', week: 'esta semana', month: 'este mes', quarter: 'este trimestre', year: 'este año', custom: 'el período' }[st.period];
      const alerts = b.rows.filter((r) => ['warn', 'crit', 'over'].includes(r.level));
      body.innerHTML = `
        ${alerts.length ? alerts.map((r) => `<div class="alert ${r.level === 'warn' ? 'warn' : 'bad'}"><b>${esc(r.sector)}</b>: ${r.level === 'warn' ? 'se usó' : r.level === 'over' ? 'se superó:' : 'se alcanzó'} el ${E.pct(r.pct)} del presupuesto de ${E.monthName(b.month)} (${E.money(r.spent)} de ${E.money(r.budget)}).</div>`).join('') : ''}
        <div class="kpis">
          <div class="kpi"><div class="l">Gastado ${lbl}</div><div class="v">${E.money(k.total_period)}</div><div class="s">${E.num(k.count_period)} gastos · vs. período anterior ${delta(k.change_pct)}</div></div>
          <div class="kpi"><div class="l">Gastado hoy</div><div class="v">${E.money(k.today_total)}</div><div class="s">${E.num(k.today_count)} gastos</div></div>
          <div class="kpi"><div class="l">Gastado en el mes</div><div class="v">${E.money(k.month_total)}</div><div class="s">${E.num(k.month_count)} gastos</div></div>
          <div class="kpi warn"><div class="l">Pendiente de autorización</div><div class="v">${E.money(k.pending_authorization.amount)}</div><div class="s">${E.num(k.pending_authorization.count)} solicitudes</div></div>
          <div class="kpi info"><div class="l">Autorizado, sin comprar</div><div class="v">${E.money(k.authorized_pending_purchase.amount)}</div><div class="s">${E.num(k.authorized_pending_purchase.count)} solicitudes (no suma como gasto)</div></div>
          <div class="kpi ${k.pending_receipts.count ? 'bad' : ''}"><div class="l">Sin comprobante</div><div class="v">${E.money(k.pending_receipts.amount)}</div><div class="s">${E.num(k.pending_receipts.count)} gastos</div></div>
        </div>
        <div class="cols"><div class="card"><h2>Gasto mensual (últimos 12 meses)</h2><div class="chartbox"><canvas id="c-month" role="img" aria-label="Gasto mensual"></canvas></div></div>
          <div class="card"><h2>Gasto por sector ${lbl}</h2><div class="chartbox"><canvas id="c-sector" role="img" aria-label="Gasto por sector"></canvas></div></div></div>
        <div class="cols"><div class="card"><h2>Por responsable de pago ${lbl}</h2><div class="chartbox"><canvas id="c-payer" role="img" aria-label="Gasto por responsable de pago"></canvas></div></div>
          <div class="card"><h2>Detalle por sector</h2><div class="tablewrap"><table><thead><tr><th>Sector</th><th class="r">Gastado</th><th class="r">Anterior</th><th class="r">Var.</th></tr></thead><tbody>
            ${d.by_sector.map((s) => `<tr><td>${esc(s.sector)}</td><td class="r">${E.money(s.total)}</td><td class="r">${E.money(s.previous)}</td><td class="r">${delta(s.change_pct)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Sin datos</td></tr>'}</tbody></table></div>
            <p class="hint" style="margin-top:8px">Período: ${E.date(d.range.from)} al ${E.date(d.range.to)}. Anterior: ${E.date(d.previous_range.from)} al ${E.date(d.previous_range.to)}.</p></div></div>`;
      E.destroyCharts();
      const axis = { ticks: { callback: (v) => E.moneyShort(v) }, grid: { color: 'rgba(120,130,140,.18)' }, beginAtZero: true };
      const tip = { callbacks: { label: (c) => ' ' + E.money(c.parsed.y ?? c.parsed.x ?? c.parsed) } };
      E.chart(E.$('#c-month'), { type: 'bar', data: { labels: d.monthly.map((m) => E.monthLabel(m.month)), datasets: [{ data: d.monthly.map((m) => m.total), backgroundColor: E.PAL[0], borderRadius: 4 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip }, scales: { y: axis } } });
      E.chart(E.$('#c-sector'), { type: 'bar', data: { labels: d.by_sector.map((s) => s.sector), datasets: [{ data: d.by_sector.map((s) => s.total), backgroundColor: E.PAL[1], borderRadius: 4 }] }, options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip }, scales: { x: axis } } });
      E.chart(E.$('#c-payer'), { type: 'doughnut', data: { labels: d.by_payer.map((s) => s.payer), datasets: [{ data: d.by_payer.map((s) => s.total), backgroundColor: E.PAL, borderWidth: 0 }] }, options: { maintainAspectRatio: false, cutout: '58%', plugins: { legend: { position: 'right' }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${E.money(c.parsed)}` } } } } });
    };
    E.$('[data-chips]', root).onclick = (ev) => { const p = ev.target.dataset.p; if (!p) return; st.period = p; E.$$('.chip', root).forEach((c) => c.classList.toggle('on', c.dataset.p === p)); E.$('[data-custom]', root).hidden = p !== 'custom'; load(); };
    E.$('[data-apply]', root).onclick = () => { st.from = E.$('[name=from]', root).value; st.to = E.$('[name=to]', root).value; load(); };
    await load();
  };

  // ============ VISTA DE BÚSQUEDA (Gastos / Historial) ============
  const COLS = [['date', 'Fecha'], ['number', 'N.º'], ['sector', 'Sector'], [null, 'Descripción'], [null, 'Proveedor'], ['payer', 'Pagó / solicita'], ['amount', 'Importe'], ['status', 'Estado']];
  E.searchView = async (root, { type, title, sub, state }) => {
    const st = state; st.type = type || st.type || 'todos'; st.page ||= 1; st.sort ||= 'date'; st.dir ||= 'desc'; st.f ||= {};
    const f = st.f;
    const canNew = E.can.createExpense() && type === 'gastos';
    root.innerHTML = head(title, sub, `${canNew ? '<button class="btn primary" data-new>＋ Nuevo gasto</button>' : ''}<button class="btn" data-exp="xlsx">Excel</button><button class="btn" data-exp="csv">CSV</button><button class="btn" data-exp="pdf">PDF</button>`).s + `
      ${type ? '' : `<div class="chips" data-types>${[['todos', 'Todo'], ['gastos', 'Gastos'], ['solicitudes', 'Solicitudes']].map(([k, l]) => `<button class="chip ${st.type === k ? 'on' : ''}" data-t="${k}">${l}</button>`).join('')}</div>`}
      <form class="filters" data-f>
        <label class="fld grow"><span>Buscar (texto, N.º, proveedor, comprobante…)</span><input name="q" value="${esc(f.q || '')}" placeholder="Ej. cubiertas, G-000123, Prov A"></label>
        <label class="fld"><span>Desde</span><input type="date" name="from" value="${esc(f.from || '')}"></label>
        <label class="fld"><span>Hasta</span><input type="date" name="to" value="${esc(f.to || '')}"></label>
        <label class="fld"><span>Sector</span><select name="sector_id">${E.optionsHtml(E.activeSectors(), f.sector_id, { empty: 'Todos' })}</select></label>
        <label class="fld"><span>Estado</span><select name="status">${E.optionsHtml([...Object.entries(E.EXP_STATUS), ...Object.entries(E.REQ_STATUS).filter(([k]) => !['pendiente'].includes(k) || true)].filter(([k], i, a) => a.findIndex(x => x[0] === k) === i).map(([value, label]) => ({ value, label })), f.status, { empty: 'Todos' })}</select></label>
      </form>
      <details ${f.adv ? 'open' : ''} style="margin-bottom:12px"><summary class="muted" style="cursor:pointer">Más filtros</summary>
        <form class="filters" data-f2 style="margin-top:10px">
          <label class="fld"><span>Categoría</span><select name="category_id">${E.optionsHtml(E.S.categories, f.category_id, { empty: 'Todas' })}</select></label>
          <label class="fld"><span>Pagó</span><select name="payer_id">${E.optionsHtml(E.S.payers, f.payer_id, { empty: 'Todos' })}</select></label>
          <label class="fld"><span>Medio de pago</span><select name="payment_method">${E.optionsHtml(Object.entries(E.METHODS).map(([value, label]) => ({ value, label })), f.payment_method, { empty: 'Todos' })}</select></label>
          <label class="fld"><span>Proveedor</span><input name="supplier" value="${esc(f.supplier || '')}"></label>
          <label class="fld"><span>Solicitado por</span><input name="requested_by" value="${esc(f.requested_by || '')}"></label>
          <label class="fld"><span>Autorizado por</span><input name="authorized_by" value="${esc(f.authorized_by || '')}"></label>
          <label class="fld"><span>N.º de comprobante</span><input name="invoice" value="${esc(f.invoice || '')}"></label>
          <label class="fld"><span>Importe desde</span><input name="amount_min" inputmode="decimal" value="${esc(f.amount_min_raw || '')}"></label>
          <label class="fld"><span>Importe hasta</span><input name="amount_max" inputmode="decimal" value="${esc(f.amount_max_raw || '')}"></label>
          <label class="fld"><span>Importe exacto</span><input name="amount_exact" inputmode="decimal" value="${esc(f.amount_exact_raw || '')}"></label>
          <label class="fld" style="align-self:center"><span><input type="checkbox" name="pending_receipt" ${f.pending_receipt ? 'checked' : ''}> Solo sin comprobante</span></label>
          <button type="button" class="btn" data-clear>Limpiar filtros</button>
        </form></details>
      <div class="kpis" data-sum></div><div data-table></div>`;
    const read = () => {
      const o = {}; for (const form of [E.$('[data-f]', root), E.$('[data-f2]', root)]) for (const el of form.elements) { if (!el.name) continue; if (el.type === 'checkbox') { if (el.checked) o[el.name] = true; } else if (el.value) o[el.name] = el.value; }
      for (const k of ['amount_min', 'amount_max', 'amount_exact']) if (o[k]) { o[k + '_raw'] = o[k]; o[k] = E.parseMoney(o[k]) || undefined; if (!o[k]) delete o[k]; }
      o.adv = !!(o.category_id || o.payer_id || o.payment_method || o.supplier || o.requested_by || o.authorized_by || o.invoice || o.amount_min || o.amount_max || o.amount_exact || o.pending_receipt);
      return o;
    };
    const params = (extra = {}) => { const o = { ...st.f }; for (const k of Object.keys(o)) if (k.endsWith('_raw') || k === 'adv') delete o[k]; return { type: st.type, sort: st.sort, dir: st.dir, ...o, ...extra }; };
    const load = async () => {
      const box = E.$('[data-table]', root);
      let res; try { res = await E.rpc('history_search', { p: { ...params(), page: st.page, size: 50 } }); } catch (e) { box.innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; return; }
      E.$('[data-sum]', root).innerHTML = `<div class="kpi"><div class="l">Registros</div><div class="v">${E.num(res.total)}</div></div><div class="kpi"><div class="l">Total gastado (sin anulados)</div><div class="v">${E.money(res.spent)}</div></div>${st.type !== 'gastos' ? `<div class="kpi info"><div class="l">En trámite (pendiente + aprobada, sin comprar)</div><div class="v">${E.money(res.in_flight)}</div></div>` : ''}`;
      const pages = Math.max(1, Math.ceil(res.total / res.size));
      const th = COLS.map(([k, l]) => `<th class="${k ? 'sort' : ''} ${k === 'amount' ? 'r' : ''}" ${k ? `data-s="${k}"` : ''}>${l}${st.sort === k ? (st.dir === 'asc' ? ' ▲' : ' ▼') : ''}</th>`).join('');
      box.innerHTML = res.rows.length ? `<div class="tablewrap"><table class="stack"><thead><tr>${th}</tr></thead><tbody>${res.rows.map((r) =>
        `<tr class="click ${r.status === 'anulado' ? 'voided' : ''}" data-t="${r.type}" data-id="${r.rid}"><td data-l="Fecha">${E.date(r.date)}</td><td data-l="N.º" class="nowrap">${r.number}${E.demoTag(r.is_demo).s}</td><td data-l="Sector">${esc(r.sector)}</td>
        <td data-l="Descripción">${esc(r.description)}</td><td data-l="Proveedor">${esc(r.supplier || '')}</td><td data-l="Pagó / solicita">${esc(r.payer)}</td><td data-l="Importe" class="r">${E.money(r.amount)}</td><td data-l="Estado">${E.badge(r.status).s}</td></tr>`).join('')}</tbody></table></div>
        <div class="pager"><span>Página ${res.page} de ${pages}</span><span><button class="btn sm" data-pg="-1" ${res.page <= 1 ? 'disabled' : ''}>← Anterior</button> <button class="btn sm" data-pg="1" ${res.page >= pages ? 'disabled' : ''}>Siguiente →</button></span></div>`
        : '<div class="card empty">No hay registros con esos filtros.</div>';
      E.$$('tr.click', box).forEach((tr) => (tr.onclick = () => (tr.dataset.t === 'gasto' ? E.openExpense(+tr.dataset.id, load) : E.openRequest(+tr.dataset.id, load))));
      E.$$('th[data-s]', box).forEach((t) => (t.onclick = () => { st.dir = st.sort === t.dataset.s && st.dir === 'desc' ? 'asc' : 'desc'; st.sort = t.dataset.s; st.page = 1; load(); }));
      E.$$('[data-pg]', box).forEach((b) => (b.onclick = () => { st.page += +b.dataset.pg; load(); }));
    };
    const apply = () => { st.f = read(); st.page = 1; load(); };
    const deb = E.debounce(apply, 400);
    for (const form of [E.$('[data-f]', root), E.$('[data-f2]', root)]) { form.onsubmit = (ev) => { ev.preventDefault(); apply(); }; form.oninput = (ev) => (ev.target.tagName === 'INPUT' && ev.target.type !== 'date' && ev.target.type !== 'checkbox' ? deb() : apply()); }
    E.$('[data-clear]', root).onclick = () => { st.f = {}; E.searchView(root, { type, title, sub, state: st }); };
    const tp = E.$('[data-types]', root); if (tp) tp.onclick = (ev) => { const t = ev.target.dataset.t; if (!t) return; st.type = t; st.page = 1; E.$$('.chip', tp).forEach((c) => c.classList.toggle('on', c.dataset.t === t)); load(); };
    const nb = E.$('[data-new]', root); if (nb) nb.onclick = () => E.expenseForm({ onSaved: load });
    E.$$('[data-exp]', root).forEach((b) => (b.onclick = () => E.busy(b, async () => {
      try { const res = await E.rpc('history_search', { p: { ...params(), export: true, size: 20000, page: 1 } }); await E.exportRows(res.rows, b.dataset.exp, title, res); } catch (e) { E.fail(e); }
    })));
    await load();
  };

  // ---------- Exportaciones (en el navegador) ----------
  E.exportRows = async (rows, kind, title, res) => {
    const stamp = E.todayAR();
    const head = ['Tipo', 'N.º', 'Fecha', 'Sector', 'Descripción', 'Proveedor', 'Pagó / solicitó', 'Autorizó', 'Importe', 'Estado'];
    const data = rows.map((r) => [r.type === 'gasto' ? 'Gasto' : 'Solicitud', r.number, E.date(r.date), r.sector, r.description, r.supplier || '', r.payer, r.authorizer || '', Number(r.amount), E.EXP_STATUS[r.status] || E.REQ_STATUS[r.status] || r.status]);
    if (!rows.length) return E.toast('No hay registros para exportar', 'info');
    if (kind === 'xlsx') {
      const ws = XLSX.utils.aoa_to_sheet([head, ...data]); ws['!cols'] = [8, 12, 11, 18, 40, 22, 16, 16, 16, 22].map((wch) => ({ wch }));
      data.forEach((_, i) => { const c = ws['I' + (i + 2)]; if (c) c.z = '"$" #,##0.00'; });
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Registros');
      const sum = XLSX.utils.aoa_to_sheet([['EMCALA SRL'], [title], ['Generado', E.dt(new Date())], ['Registros', rows.length], ['Total gastado (sin anulados)', Number(res.spent)]]); XLSX.utils.book_append_sheet(wb, sum, 'Resumen');
      XLSX.writeFile(wb, `emcala-${title.toLowerCase()}-${stamp}.xlsx`);
    } else if (kind === 'csv') {
      const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = '﻿' + [head, ...data.map((r) => r.map((v, i) => (i === 8 ? String(v).replace('.', ',') : v)))].map((r) => r.map(q).join(';')).join('\r\n');
      E.download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `emcala-${title.toLowerCase()}-${stamp}.csv`);
    } else {
      const { jsPDF } = window.jspdf; const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      doc.setFontSize(14); doc.text(`EMCALA SRL · ${title}`, 40, 38); doc.setFontSize(9); doc.setTextColor(100);
      doc.text(`Generado ${E.dt(new Date())} · ${rows.length} registros · Total gastado ${E.money(res.spent)}`, 40, 54);
      doc.autoTable({ startY: 66, head: [head], body: data.map((r) => r.map((v, i) => (i === 8 ? E.money(v) : v))), styles: { fontSize: 7.5, cellPadding: 3 }, headStyles: { fillColor: [15, 92, 92] }, columnStyles: { 8: { halign: 'right' } }, margin: { left: 40, right: 40 } });
      doc.save(`emcala-${title.toLowerCase()}-${stamp}.pdf`);
    }
    E.toast('Exportación lista');
  };

  E.pages.gastos = (root) => E.searchView(root, { type: 'gastos', title: 'Gastos', sub: 'Registro de gastos reales', state: (E.S.gastosSt ||= {}) });
  E.pages.historial = (root) => E.searchView(root, { type: null, title: 'Historial', sub: 'Gastos y solicitudes en un solo lugar', state: (E.S.histSt ||= {}) });

  // ============ SOLICITUDES ============
  E.pages.solicitudes = async (root) => {
    const st = (E.S.reqSt ||= { status: E.can.decide() ? 'pendiente,en_revision' : '', sector: '' });
    const canNew = E.can.createRequest();
    root.innerHTML = head('Solicitudes de compra', E.role() === 'requester' ? 'Sus solicitudes y su estado' : 'Autorizaciones de compra', canNew ? '<button class="btn primary" data-new>＋ Nueva solicitud</button>' : '').s + `
      <div class="chips" data-chips>${[['', 'Todas'], ['pendiente,en_revision', 'Por resolver'], ['borrador', 'Borradores'], ['aprobada', 'Aprobadas (sin comprar)'], ['compra_realizada', 'Compra realizada'], ['rechazada', 'Rechazadas'], ['cancelada,cerrada', 'Canceladas / cerradas']].map(([k, l]) => `<button class="chip ${st.status === k ? 'on' : ''}" data-s="${k}">${l}</button>`).join('')}</div>
      <div data-list></div>`;
    const load = async () => {
      let q = E.sb.from('v_requests').select('*').order('created_at', { ascending: false }).limit(300);
      if (st.status) q = q.in('status', st.status.split(','));
      let rows; try { rows = await E.db(q); } catch (e) { E.$('[data-list]', root).innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; return; }
      E.$('[data-list]', root).innerHTML = rows.length ? `<div class="tablewrap"><table class="stack"><thead><tr><th>N.º</th><th>Fecha</th><th>Solicitante</th><th>Sector</th><th>Descripción</th><th>Prioridad</th><th class="r">Solicitado</th><th class="r">Autorizado</th><th>Estado</th></tr></thead><tbody>${rows.map((r) =>
        `<tr class="click" data-id="${r.id}"><td data-l="N.º" class="nowrap">${r.number}${E.demoTag(r.is_demo).s}</td><td data-l="Fecha">${E.date(r.created_at)}</td><td data-l="Solicitante">${esc(r.requester)}</td><td data-l="Sector">${esc(r.sector)}</td><td data-l="Descripción">${esc(r.description)}</td><td data-l="Prioridad">${E.PRIORITY[r.priority]}</td><td data-l="Solicitado" class="r">${E.money(r.estimated_amount)}</td><td data-l="Autorizado" class="r">${r.authorized_amount != null ? E.money(r.authorized_amount) : '—'}</td><td data-l="Estado">${E.badge(r.status).s}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="card empty">No hay solicitudes en esta vista.</div>';
      E.$$('tr.click', root).forEach((tr) => (tr.onclick = () => E.openRequest(+tr.dataset.id, load)));
    };
    E.$('[data-chips]', root).onclick = (ev) => { const s = ev.target.dataset.s; if (s === undefined) return; st.status = s; E.$$('.chip', root).forEach((c) => c.classList.toggle('on', c.dataset.s === s)); load(); };
    const nb = E.$('[data-new]', root); if (nb) nb.onclick = () => E.requestForm({ onSaved: load });
    await load();
  };
})();
