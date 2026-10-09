// Páginas: Sectores, Presupuestos, Configuración.
(function () {
  const E = window.E, h = E.h, esc = E.esc, head = (...a) => E.head(...a).s;
  const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: E.monthName(i + 1) }));
  const years = () => { const y = +E.todayAR().slice(0, 4); return [y - 2, y - 1, y, y + 1].map((v) => ({ value: v, label: v })); };
  const lvl = { ok: ['ok', 'En rango'], warn: ['warn', 'Alerta'], crit: ['bad', 'Límite alcanzado'], over: ['bad', 'Excedido'], none: ['muted', 'Sin presupuesto'] };
  const barHtml = (r) => `<div class="bar" title="Gastado ${E.pct(r.pct)}${r.committed_pct != null ? ' · comprometido ' + E.pct(r.committed_pct) : ''}"><i class="${r.level === 'warn' ? 'warn' : ['crit', 'over'].includes(r.level) ? 'bad' : ''}" style="width:${Math.min(100, r.pct || 0)}%"></i></div>`;

  // ============ SECTORES ============
  E.pages.sectores = async (root) => {
    const st = (E.S.secSt ||= { year: +E.todayAR().slice(0, 4), month: +E.todayAR().slice(5, 7), sector: null });
    const sectors = E.activeSectors(); st.sector ||= sectors[0]?.id;
    root.innerHTML = head('Análisis por sector', 'Gasto, comparaciones y proveedores principales') + `
      <div class="filters"><label class="fld"><span>Sector</span><select name="sector">${E.optionsHtml(sectors, st.sector)}</select></label>
        <label class="fld"><span>Mes</span><select name="month">${E.optionsHtml(MONTHS, st.month)}</select></label>
        <label class="fld"><span>Año</span><select name="year">${E.optionsHtml(years(), st.year)}</select></label>
        <button class="btn" data-go>Ver gastos del sector</button></div><div data-body></div>`;
    const load = async () => {
      const body = E.$('[data-body]', root); if (!st.sector) { body.innerHTML = '<div class="empty">No hay sectores disponibles.</div>'; return; }
      let d; try { d = await E.rpc('sector_analysis', { p_sector: st.sector, p_year: st.year, p_month: st.month }); } catch (e) { body.innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; return; }
      const k = d.kpis; const tbl = (rows, key, label) => `<div class="tablewrap"><table><thead><tr><th>${label}</th><th class="r">Cant.</th><th class="r">Total</th></tr></thead><tbody>${rows.map((x) => `<tr><td>${esc(x[key] || '(sin dato)')}</td><td class="r">${E.num(x.count)}</td><td class="r">${E.money(x.total)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">Sin datos</td></tr>'}</tbody></table></div>`;
      const cmp = (a, b) => (b > 0 ? ` <span class="${a > b ? 'up' : 'down'}">${a > b ? '▲' : '▼'} ${E.pct(Math.abs((a - b) / b * 100))}</span>` : '');
      body.innerHTML = `<div class="kpis">
        <div class="kpi"><div class="l">${E.monthName(d.month)} ${d.year}</div><div class="v">${E.money(k.month_total)}</div><div class="s">${E.num(k.month_count)} gastos · prom. ${E.money(k.month_avg)}</div></div>
        <div class="kpi"><div class="l">Mes anterior</div><div class="v">${E.money(k.previous_month)}</div><div class="s">${k.change_vs_previous_pct != null ? 'Variación ' + (k.change_vs_previous_pct > 0 ? '+' : '') + E.pct(k.change_vs_previous_pct) : 'Sin base de comparación'}</div></div>
        <div class="kpi"><div class="l">Promedio de meses previos</div><div class="v">${E.money(k.avg_previous_months)}</div><div class="s">Este mes vs. promedio${cmp(k.month_total, k.avg_previous_months)}</div></div>
        <div class="kpi"><div class="l">Mismo mes, año anterior</div><div class="v">${E.money(k.same_month_last_year)}</div><div class="s">Este mes vs. año anterior${cmp(k.month_total, k.same_month_last_year)}</div></div>
        <div class="kpi"><div class="l">Acumulado ${d.year}</div><div class="v">${E.money(k.year_total)}</div><div class="s">${E.num(k.year_count)} gastos · prom. ${E.money(k.year_avg)}</div></div>
        <div class="kpi info"><div class="l">Solicitudes del mes</div><div class="v">${E.num(d.requests.pendientes.count)} pend. · ${E.num(d.requests.autorizadas.count)} aut. · ${E.num(d.requests.rechazadas.count)} rech.</div><div class="s">Pendientes ${E.money(d.requests.pendientes.amount)} · Autorizadas ${E.money(d.requests.autorizadas.amount)}</div></div></div>
        <div class="cols"><div class="card"><h2>Gasto mensual ${d.year}</h2><div class="chartbox"><canvas id="c-my" role="img" aria-label="Gasto mensual del sector"></canvas></div></div>
          <div class="card"><h2>Últimos 6 meses</h2><div class="chartbox"><canvas id="c-l6" role="img" aria-label="Últimos 6 meses"></canvas></div></div></div>
        <div class="cols"><div class="card"><h2>Categorías con más gasto (${E.monthName(d.month)})</h2>${tbl(d.top_categories, 'category', 'Categoría')}<h3 style="margin:14px 0 6px">En el año</h3>${tbl(d.top_categories_year, 'category', 'Categoría')}</div>
          <div class="card"><h2>Proveedores principales (${E.monthName(d.month)})</h2>${tbl(d.top_suppliers, 'supplier', 'Proveedor')}<h3 style="margin:14px 0 6px">En el año</h3>${tbl(d.top_suppliers_year, 'supplier', 'Proveedor')}</div></div>
        <div class="card"><h2>Por responsable de pago (${E.monthName(d.month)})</h2>${tbl(d.by_payer, 'payer', 'Pagó')}</div>`;
      E.destroyCharts();
      const tip = { callbacks: { label: (c) => ' ' + E.money(c.parsed.y) } }, ax = { ticks: { callback: (v) => E.moneyShort(v) }, beginAtZero: true, grid: { color: 'rgba(120,130,140,.18)' } };
      for (const [id, arr, col] of [['c-my', d.monthly_year, E.PAL[0]], ['c-l6', d.last_6_months, E.PAL[1]]])
        E.chart(E.$('#' + id), { type: 'bar', data: { labels: arr.map((m) => E.monthLabel(m.month)), datasets: [{ data: arr.map((m) => m.total), backgroundColor: col, borderRadius: 4 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip }, scales: { y: ax } } });
    };
    root.onchange = (ev) => { const n = ev.target.name; if (!['sector', 'month', 'year'].includes(n)) return; st[n] = +ev.target.value; load(); };
    E.$('[data-go]', root).onclick = () => { E.S.gastosSt = { f: { sector_id: String(st.sector), from: `${st.year}-${String(st.month).padStart(2, '0')}-01` } }; location.hash = '#/gastos'; };
    await load();
  };

  // ============ PRESUPUESTOS ============
  E.pages.presupuestos = async (root) => {
    const st = (E.S.budSt ||= { year: +E.todayAR().slice(0, 4), month: +E.todayAR().slice(5, 7) });
    root.innerHTML = head('Presupuestos', 'Presupuesto mensual vs. gasto, autorizado y solicitado', E.can.admin() ? '<button class="btn" data-copy>Copiar del mes anterior</button><button class="btn primary" data-edit>Definir presupuesto</button>' : '') + `
      <div class="filters"><label class="fld"><span>Mes</span><select name="month">${E.optionsHtml(MONTHS, st.month)}</select></label><label class="fld"><span>Año</span><select name="year">${E.optionsHtml(years(), st.year)}</select></label></div><div data-body></div>`;
    const load = async () => {
      const body = E.$('[data-body]', root); let d;
      try { d = await E.rpc('budgets_report', { p_year: st.year, p_month: st.month }); } catch (e) { body.innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; return; }
      const t = d.totals;
      body.innerHTML = `<div class="kpis"><div class="kpi"><div class="l">Presupuesto total</div><div class="v">${E.money(t.budget)}</div></div><div class="kpi"><div class="l">Gastado</div><div class="v">${E.money(t.spent)}</div><div class="s">${t.budget > 0 ? E.pct(t.spent / t.budget * 100) + ' del presupuesto' : ''}</div></div>
        <div class="kpi info"><div class="l">Autorizado, sin comprar</div><div class="v">${E.money(t.authorized)}</div></div><div class="kpi warn"><div class="l">Pendiente de autorización</div><div class="v">${E.money(t.requested)}</div></div></div>
        <p class="hint">Alertas configuradas: aviso al ${d.warn_pct}% y límite al ${d.crit_pct}% del presupuesto gastado. “Comprometido” suma lo gastado más lo autorizado y aún no comprado.</p>
        <div class="tablewrap"><table class="stack"><thead><tr><th>Sector</th><th class="r">Presupuesto</th><th class="r">Gastado</th><th class="r">Autorizado s/ comprar</th><th class="r">Solicitado</th><th class="r">Saldo</th><th style="min-width:130px">Avance</th><th class="r">Proyección</th><th>Estado</th></tr></thead><tbody>
        ${d.rows.map((r) => { const [tone, label] = lvl[r.level] || lvl.none; return `<tr><td data-l="Sector"><b>${esc(r.sector)}</b></td><td data-l="Presupuesto" class="r">${r.budget != null ? E.money(r.budget) : '—'}</td><td data-l="Gastado" class="r">${E.money(r.spent)}</td><td data-l="Autorizado" class="r">${E.money(r.authorized)}</td><td data-l="Solicitado" class="r">${E.money(r.requested)}</td><td data-l="Saldo" class="r">${r.balance != null ? E.money(r.balance) : '—'}</td><td data-l="Avance">${r.pct != null ? barHtml(r) + `<small>${E.pct(r.pct)}${r.committed_pct != null ? ' · comprom. ' + E.pct(r.committed_pct) : ''}</small>` : '—'}</td><td data-l="Proyección" class="r">${r.budget != null ? E.money(r.projection) : '—'}</td><td data-l="Estado"><span class="badge b-${tone}">${label}</span></td></tr>`
          + r.categories.map((c) => { const [t2, l2] = lvl[c.level] || lvl.none; return `<tr><td data-l="Categoría" style="padding-left:28px" class="muted">↳ ${esc(c.category)}</td><td class="r" data-l="Presupuesto">${E.money(c.budget)}</td><td class="r" data-l="Gastado">${E.money(c.spent)}</td><td></td><td></td><td class="r" data-l="Saldo">${E.money(c.balance)}</td><td data-l="Avance">${barHtml(c)}<small>${E.pct(c.pct)}</small></td><td></td><td><span class="badge b-${t2}">${l2}</span></td></tr>`; }).join(''); }).join('')}</tbody></table></div>`;
    };
    root.onchange = (ev) => { const n = ev.target.name; if (!['month', 'year'].includes(n)) return; st[n] = +ev.target.value; load(); };
    const ed = E.$('[data-edit]', root); if (ed) ed.onclick = () => budgetEditor(st, load);
    const cp = E.$('[data-copy]', root); if (cp) cp.onclick = () => E.busy(cp, async () => {
      const pm = st.month === 1 ? { y: st.year - 1, m: 12 } : { y: st.year, m: st.month - 1 };
      try {
        const prev = await E.db(E.sb.from('budgets').select('*').eq('year', pm.y).eq('month', pm.m).eq('is_demo', false));
        const cur = await E.db(E.sb.from('budgets').select('sector_id,category_id').eq('year', st.year).eq('month', st.month));
        const have = new Set(cur.map((c) => `${c.sector_id}-${c.category_id || 0}`));
        const add = prev.filter((p) => !have.has(`${p.sector_id}-${p.category_id || 0}`)).map((p) => ({ sector_id: p.sector_id, category_id: p.category_id, year: st.year, month: st.month, amount: p.amount }));
        if (!add.length) return E.toast('No hay presupuestos para copiar (o ya existen)', 'info');
        await E.db(E.sb.from('budgets').insert(add)); E.toast(`${add.length} presupuestos copiados`); load();
      } catch (e) { E.fail(e); }
    });
    await load();
  };
  async function budgetEditor(st, done) {
    const sectors = E.S.sectors.filter((s) => s.active); let sid = sectors[0]?.id;
    const m = E.modal(`Presupuesto · ${E.monthName(st.month)} ${st.year}`, '', { wide: true, sticky: true });
    const draw = async () => {
      const cats = E.S.categories.filter((c) => c.sector_id === sid && c.active);
      const cur = await E.db(E.sb.from('budgets').select('*').eq('year', st.year).eq('month', st.month).eq('sector_id', sid));
      const get = (cid) => cur.find((b) => (b.category_id || null) === cid);
      m.body.innerHTML = `<label class="fld"><span>Sector</span><select data-sec>${E.optionsHtml(sectors, sid)}</select></label>
        <p class="hint" style="margin:10px 0">Deje vacío para no definir presupuesto. El presupuesto por categoría es opcional y no reemplaza al del sector.</p>
        <div class="grid g2"><label class="fld span2"><span><b>Total del sector</b></span><input data-cid="" inputmode="decimal" value="${esc(E.moneyStr(get(null)?.amount))}" placeholder="0,00"></label>
        ${cats.map((c) => `<label class="fld"><span>${esc(c.name)}</span><input data-cid="${c.id}" inputmode="decimal" value="${esc(E.moneyStr(get(c.id)?.amount))}" placeholder="0,00"></label>`).join('')}</div>
        <div class="alert bad" data-err hidden></div><footer class="dlg-foot"><button class="btn" data-x>Cerrar</button><button class="btn primary" data-save>Guardar</button></footer>`;
      E.$('[data-sec]', m.body).onchange = (ev) => { sid = +ev.target.value; draw(); };
      E.$('[data-x]', m.body).onclick = () => { m.close(); done(); };
      E.$('[data-save]', m.body).onclick = (ev) => E.busy(ev.target, async () => {
        try {
          for (const inp of E.$$('input[data-cid]', m.body)) {
            const cid = inp.dataset.cid ? +inp.dataset.cid : null, raw = inp.value.trim(), ex = get(cid);
            if (!raw) { if (ex) await E.db(E.sb.from('budgets').delete().eq('id', ex.id)); continue; }
            const a = E.parseMoney(raw); if (a == null) throw new E.AppError(`Importe inválido: "${raw}"`, 'VALIDATION');
            if (ex) { if (+ex.amount !== +a) await E.db(E.sb.from('budgets').update({ amount: a }).eq('id', ex.id)); }
            else await E.db(E.sb.from('budgets').insert({ sector_id: sid, category_id: cid, year: st.year, month: st.month, amount: a }));
          }
          E.toast('Presupuesto guardado'); await draw();
        } catch (e) { const b = E.$('[data-err]', m.body); b.hidden = false; b.textContent = e.message; }
      });
    };
    await draw();
  }

  // ============ CONFIGURACIÓN ============
  E.pages.config = async (root) => {
    const st = (E.S.cfgSt ||= { tab: 'usuarios' });
    const tabs = [['usuarios', 'Usuarios'], ['sectores', 'Sectores y categorías'], ['pagadores', 'Responsables de pago'], ['alertas', 'Alertas y empresa'], ['auditoria', 'Auditoría'], ['demo', 'Datos DEMO y respaldo']];
    root.innerHTML = head('Configuración', 'Solo administradores') + `<div class="tabs" data-tabs>${tabs.map(([k, l]) => `<button class="${st.tab === k ? 'on' : ''}" data-t="${k}">${l}</button>`).join('')}</div><div data-pane></div>`;
    const show = async () => { E.$$('[data-tabs] button', root).forEach((b) => b.classList.toggle('on', b.dataset.t === st.tab)); const pane = E.$('[data-pane]', root); pane.innerHTML = '<div class="boot">Cargando…</div>'; try { await cfg[st.tab](pane); } catch (e) { pane.innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; } };
    E.$('[data-tabs]', root).onclick = (ev) => { const t = ev.target.dataset.t; if (t) { st.tab = t; show(); } };
    await show();
  };
  const cfg = {};
  cfg.usuarios = async (pane) => {
    const [users, us] = await Promise.all([E.db(E.sb.from('profiles').select('*').order('created_at')), E.db(E.sb.from('user_sectors').select('*'))]);
    const secName = (id) => E.S.sectors.find((s) => s.id === id)?.name;
    pane.innerHTML = `<div class="alert info">Para <b>crear un usuario nuevo</b>: Supabase → Authentication → Users → Add user (con “Auto Confirm User”). Luego aparece acá como <b>inactivo</b>: asígnele rol y actívelo.</div>
      <div class="tablewrap"><table class="stack"><thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Sectores</th><th>Estado</th><th></th></tr></thead><tbody>${users.map((u) => { const mine = us.filter((x) => x.user_id === u.id).map((x) => secName(x.sector_id)); return `<tr><td data-l="Nombre">${esc(u.name)}</td><td data-l="Email">${esc(u.email)}</td><td data-l="Rol">${E.ROLES[u.role]}${u.can_self_approve ? ' <small class="muted">(autoaprueba)</small>' : ''}</td><td data-l="Sectores">${mine.length ? esc(mine.join(', ')) : '<span class="muted">Todos</span>'}</td><td data-l="Estado">${u.active ? '<span class="badge b-ok">Activo</span>' : '<span class="badge b-warn">Inactivo</span>'}</td><td><button class="btn sm" data-u="${u.id}">Editar</button></td></tr>`; }).join('')}</tbody></table></div>`;
    E.$$('[data-u]', pane).forEach((b) => (b.onclick = () => {
      const u = users.find((x) => x.id === b.dataset.u), mine = us.filter((x) => x.user_id === u.id).map((x) => x.sector_id);
      const m = E.modal(`Usuario · ${u.email}`, '', { sticky: true });
      m.body.innerHTML = `<div class="grid"><label class="fld"><span>Nombre</span><input name="name" value="${esc(u.name)}"></label>
        <label class="fld"><span>Rol</span><select name="role">${E.optionsHtml(Object.entries(E.ROLES).map(([value, label]) => ({ value, label })), u.role)}</select></label>
        <label class="fld"><span><input type="checkbox" name="active" ${u.active ? 'checked' : ''}> Usuario activo (puede ingresar)</span></label>
        <label class="fld"><span><input type="checkbox" name="can_self_approve" ${u.can_self_approve ? 'checked' : ''}> Puede aprobar sus propias solicitudes</span></label>
        <fieldset style="border:1px solid var(--line);border-radius:8px"><legend class="hint">Sectores habilitados (ninguno = todos)</legend>${E.S.sectors.filter((s) => s.active).map((s) => `<label style="display:block"><input type="checkbox" data-s="${s.id}" ${mine.includes(s.id) ? 'checked' : ''}> ${esc(s.name)}</label>`).join('')}</fieldset></div>
        <div class="alert bad" data-err hidden></div><footer class="dlg-foot"><button class="btn" data-x>Cancelar</button><button class="btn primary" data-save>Guardar</button></footer>`;
      E.$('[data-x]', m.body).onclick = m.close;
      E.$('[data-save]', m.body).onclick = (ev) => E.busy(ev.target, async () => {
        try {
          await E.db(E.sb.from('profiles').update({ name: E.$('[name=name]', m.body).value.trim() || u.name, role: E.$('[name=role]', m.body).value, active: E.$('[name=active]', m.body).checked, can_self_approve: E.$('[name=can_self_approve]', m.body).checked }).eq('id', u.id));
          const sel = E.$$('[data-s]', m.body).filter((c) => c.checked).map((c) => +c.dataset.s);
          await E.db(E.sb.from('user_sectors').delete().eq('user_id', u.id));
          if (sel.length) await E.db(E.sb.from('user_sectors').insert(sel.map((sector_id) => ({ user_id: u.id, sector_id }))));
          E.toast('Usuario actualizado'); m.close(); cfg.usuarios(pane);
        } catch (e) { const er = E.$('[data-err]', m.body); er.hidden = false; er.textContent = e.message; }
      });
    }));
  };
  cfg.sectores = async (pane) => {
    await E.loadCatalogs();
    const rename = async (table, id, cur) => { const v = await E.ask('Renombrar', '', { label: 'Nombre', required: true, confirm: 'Guardar', value: cur, minLen: 2 }); if (!v) return; try { await E.db(E.sb.from(table).update({ name: v }).eq('id', id)); await cfg.sectores(pane); } catch (e) { E.fail(e); } };
    const toggle = async (table, id, active) => { try { await E.db(E.sb.from(table).update({ active: !active }).eq('id', id)); await cfg.sectores(pane); } catch (e) { E.fail(e); } };
    pane.innerHTML = `<div class="actions" style="margin-bottom:12px"><input data-newsec placeholder="Nuevo sector" style="max-width:260px"><button class="btn primary" data-addsec>Agregar sector</button></div>
      <p class="hint">Los sectores y categorías no se eliminan (los gastos ya cargados los usan): se desactivan y dejan de ofrecerse.</p>
      ${E.S.sectors.map((s) => `<div class="card" style="margin-bottom:12px"><div class="section-title" style="margin:0 0 8px"><h2 style="margin:0">${esc(s.name)} ${s.active ? '' : '<span class="badge b-muted">Inactivo</span>'}</h2><span><button class="btn sm" data-ren="sectors:${s.id}">Renombrar</button> <button class="btn sm" data-tog="sectors:${s.id}:${s.active}">${s.active ? 'Desactivar' : 'Activar'}</button></span></div>
        <div>${E.S.categories.filter((c) => c.sector_id === s.id).map((c) => `<span class="chip ${c.active ? '' : 'muted'}" style="display:inline-flex;gap:8px;margin:0 6px 6px 0;${c.active ? '' : 'text-decoration:line-through'}">${esc(c.name)} <a href="#" data-ren="categories:${c.id}" title="Renombrar">✎</a> <a href="#" data-tog="categories:${c.id}:${c.active}" title="${c.active ? 'Desactivar' : 'Activar'}">${c.active ? '⏸' : '▶'}</a></span>`).join('')}</div>
        <div class="inline-edit" style="margin-top:6px"><input data-newcat="${s.id}" placeholder="Nueva categoría" style="max-width:240px"><button class="btn sm" data-addcat="${s.id}">Agregar</button></div></div>`).join('')}`;
    E.$$('[data-ren]', pane).forEach((a) => (a.onclick = (ev) => { ev.preventDefault(); const [t, id] = a.dataset.ren.split(':'); const cur = (t === 'sectors' ? E.S.sectors : E.S.categories).find((x) => x.id === +id).name; rename(t, +id, cur); }));
    E.$$('[data-tog]', pane).forEach((a) => (a.onclick = (ev) => { ev.preventDefault(); const [t, id, act] = a.dataset.tog.split(':'); toggle(t, +id, act === 'true'); }));
    E.$('[data-addsec]', pane).onclick = async () => { const n = E.$('[data-newsec]', pane).value.trim(); if (n.length < 2) return E.toast('Escriba el nombre del sector', 'bad'); try { await E.db(E.sb.from('sectors').insert({ name: n, sort: E.S.sectors.length })); E.toast('Sector agregado'); cfg.sectores(pane); } catch (e) { E.fail(/uq_sectors/.test(e.message) ? new Error('Ya existe un sector con ese nombre') : e); } };
    E.$$('[data-addcat]', pane).forEach((b) => (b.onclick = async () => { const n = E.$(`[data-newcat="${b.dataset.addcat}"]`, pane).value.trim(); if (n.length < 2) return E.toast('Escriba el nombre de la categoría', 'bad'); try { await E.db(E.sb.from('categories').insert({ sector_id: +b.dataset.addcat, name: n })); E.toast('Categoría agregada'); cfg.sectores(pane); } catch (e) { E.fail(/uq_categories/.test(e.message) ? new Error('Ya existe esa categoría en el sector') : e); } }));
  };
  cfg.pagadores = async (pane) => {
    await E.loadCatalogs();
    pane.innerHTML = `<div class="actions" style="margin-bottom:12px"><input data-new placeholder="Nueva persona" style="max-width:260px"><button class="btn primary" data-add>Agregar</button></div>
      <div class="tablewrap"><table><thead><tr><th>Nombre</th><th>Estado</th><th></th></tr></thead><tbody>${E.S.payers.map((p) => `<tr><td>${esc(p.name)}</td><td>${p.active ? '<span class="badge b-ok">Activo</span>' : '<span class="badge b-muted">Inactivo</span>'}</td><td><button class="btn sm" data-ren="${p.id}">Renombrar</button> <button class="btn sm" data-tog="${p.id}:${p.active}">${p.active ? 'Desactivar' : 'Activar'}</button></td></tr>`).join('')}</tbody></table></div>`;
    E.$('[data-add]', pane).onclick = async () => { const n = E.$('[data-new]', pane).value.trim(); if (n.length < 2) return E.toast('Escriba el nombre', 'bad'); try { await E.db(E.sb.from('payers').insert({ name: n })); E.toast('Agregado'); cfg.pagadores(pane); } catch (e) { E.fail(e); } };
    E.$$('[data-ren]', pane).forEach((b) => (b.onclick = async () => { const p = E.S.payers.find((x) => x.id === +b.dataset.ren); const v = await E.ask('Renombrar', '', { label: 'Nombre', required: true, value: p.name, minLen: 2, confirm: 'Guardar' }); if (v) try { await E.db(E.sb.from('payers').update({ name: v }).eq('id', p.id)); cfg.pagadores(pane); } catch (e) { E.fail(e); } }));
    E.$$('[data-tog]', pane).forEach((b) => (b.onclick = async () => { const [id, a] = b.dataset.tog.split(':'); try { await E.db(E.sb.from('payers').update({ active: a !== 'true' }).eq('id', +id)); cfg.pagadores(pane); } catch (e) { E.fail(e); } }));
  };
  cfg.alertas = async (pane) => {
    await E.loadCatalogs(); const s = E.S.settings;
    pane.innerHTML = `<div class="card" style="max-width:520px"><div class="grid"><label class="fld"><span>Nombre de la empresa</span><input name="company_name" value="${esc(s.company_name || '')}"></label>
      <label class="fld"><span>Alerta de presupuesto (% gastado)</span><input name="alert_warn_pct" inputmode="numeric" value="${esc(s.alert_warn_pct || 80)}"></label>
      <label class="fld"><span>Límite de presupuesto (% gastado)</span><input name="alert_crit_pct" inputmode="numeric" value="${esc(s.alert_crit_pct || 100)}"></label></div>
      <div class="alert bad" data-err hidden></div><footer class="dlg-foot"><button class="btn primary" data-save>Guardar</button></footer></div>`;
    E.$('[data-save]', pane).onclick = (ev) => E.busy(ev.target, async () => {
      const g = (n) => E.$(`[name=${n}]`, pane).value.trim(), w = +g('alert_warn_pct'), c = +g('alert_crit_pct'), er = E.$('[data-err]', pane);
      if (!(w > 0 && w <= 100 && c >= w && c <= 200)) { er.hidden = false; er.textContent = 'Use porcentajes válidos: alerta entre 1 y 100, y límite igual o mayor que la alerta.'; return; }
      try { await E.db(E.sb.from('settings').upsert([{ key: 'company_name', value: g('company_name') || 'EMCALA SRL' }, { key: 'alert_warn_pct', value: String(w) }, { key: 'alert_crit_pct', value: String(c) }])); E.toast('Configuración guardada'); er.hidden = true; await E.loadCatalogs(); } catch (e) { E.fail(e); }
    });
  };
  cfg.auditoria = async (pane) => {
    const st = (E.S.audSt ||= { type: '', q: '', page: 0 });
    pane.innerHTML = `<div class="filters"><label class="fld"><span>Tipo</span><select name="type">${E.optionsHtml([['expense', 'Gastos'], ['request', 'Solicitudes'], ['budget', 'Presupuestos'], ['profile', 'Usuarios'], ['sector', 'Sectores'], ['category', 'Categorías'], ['payer', 'Responsables'], ['setting', 'Ajustes']].map(([value, label]) => ({ value, label })), st.type, { empty: 'Todos' })}</select></label>
      <label class="fld grow"><span>Buscar usuario o registro (ej. G-000012)</span><input name="q" value="${esc(st.q)}"></label></div><div data-list></div>`;
    const load = async () => {
      let q = E.sb.from('audit_log').select('*', { count: 'exact' }).order('at', { ascending: false }).order('id', { ascending: false }).range(st.page * 50, st.page * 50 + 49);
      if (st.type) q = q.eq('entity_type', st.type);
      if (st.q) q = q.or(`user_name.ilike.%${st.q.replace(/[,()%]/g, ' ')}%,entity_label.ilike.%${st.q.replace(/[,()%]/g, ' ')}%`);
      const rows = await E.db(q), total = E._count || 0;
      E.$('[data-list]', pane).innerHTML = `<div class="tablewrap"><table class="stack"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Registro</th><th>Detalle</th></tr></thead><tbody>${rows.map((a) => `<tr><td data-l="Fecha" class="nowrap">${E.dt(a.at)}</td><td data-l="Usuario">${esc(a.user_name || '—')}</td><td data-l="Acción"><b>${esc(a.action)}</b>${E.demoTag(a.is_demo).s}</td><td data-l="Registro">${esc(a.entity_type)} ${esc(a.entity_label || '')}</td><td data-l="Detalle">${E.auditDetails(a.details)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Sin registros</td></tr>'}</tbody></table></div>
        <div class="pager"><span>${E.num(total)} registros</span><span><button class="btn sm" data-pg="-1" ${st.page <= 0 ? 'disabled' : ''}>← Anterior</button> <button class="btn sm" data-pg="1" ${(st.page + 1) * 50 >= total ? 'disabled' : ''}>Siguiente →</button></span></div>`;
      E.$$('[data-pg]', pane).forEach((b) => (b.onclick = () => { st.page += +b.dataset.pg; load(); }));
    };
    const deb = E.debounce(() => { st.type = E.$('[name=type]', pane).value; st.q = E.$('[name=q]', pane).value.trim(); st.page = 0; load(); });
    E.$('.filters', pane).oninput = deb; await load();
  };
  cfg.demo = async (pane) => {
    const d = await E.rpc('demo_status', {}); const has = d.expenses + d.requests + d.budgets > 0;
    pane.innerHTML = `<div class="card" style="max-width:640px;margin-bottom:14px"><h2>Datos DEMO</h2><p>Cargan unos 150 gastos de los últimos 5 meses, 8 solicitudes en distintos estados y presupuestos de ejemplo, todos con la marca <span class="badge b-demo">DEMO</span>. Se asignan a su usuario. Al eliminarlos <b>no se tocan los datos reales</b>.</p>
      <p>Actualmente: <b>${d.expenses}</b> gastos, <b>${d.requests}</b> solicitudes, <b>${d.budgets}</b> presupuestos DEMO.</p>
      <div class="actions">${has ? '<button class="btn danger" data-purge>Eliminar datos DEMO</button>' : '<button class="btn primary" data-load>Cargar datos DEMO</button>'}</div></div>
      <div class="card" style="max-width:640px"><h2>Respaldo (Excel)</h2><p>Descarga un libro con todos los gastos, solicitudes, presupuestos y la auditoría. El plan gratuito de Supabase no hace copias automáticas: conviene bajar este archivo <b>una vez por mes</b> y guardarlo fuera del sistema.</p><div class="actions"><button class="btn primary" data-backup>Descargar respaldo completo</button></div></div>`;
    const l = E.$('[data-load]', pane); if (l) l.onclick = (ev) => E.busy(ev.target, async () => { try { await E.rpc('load_demo', {}); E.toast('Datos DEMO cargados'); cfg.demo(pane); } catch (e) { E.fail(e); } });
    const p = E.$('[data-purge]', pane); if (p) p.onclick = async (ev) => { if (!(await E.ask('Eliminar datos DEMO', 'Se eliminarán únicamente los registros marcados como DEMO. Los datos reales no se modifican.', { confirm: 'Eliminar DEMO', danger: true }))) return; E.busy(ev.target, async () => { try { await E.rpc('purge_demo', {}); E.toast('Datos DEMO eliminados'); cfg.demo(pane); } catch (e) { E.fail(e); } }); };
    E.$('[data-backup]', pane).onclick = (ev) => E.busy(ev.target, async () => {
      try {
        const all = async (table, order = 'id') => { let out = [], from = 0; for (;;) { const r = await E.db(E.sb.from(table).select('*').order(order).range(from, from + 999)); out = out.concat(r); if (r.length < 1000) break; from += 1000; } return out; };
        const wb = XLSX.utils.book_new();
        for (const [t, name] of [['v_expenses', 'Gastos'], ['v_requests', 'Solicitudes'], ['v_request_events', 'Historial solicitudes'], ['budgets', 'Presupuestos'], ['attachments', 'Adjuntos'], ['audit_log', 'Auditoría']]) {
          const rows = (await all(t)).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v && typeof v === 'object' ? JSON.stringify(v) : v])));
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ info: 'sin datos' }]), name);
        }
        XLSX.writeFile(wb, `emcala-respaldo-${E.todayAR()}.xlsx`); E.toast('Respaldo descargado');
      } catch (e) { E.fail(e); }
    });
  };
})();
