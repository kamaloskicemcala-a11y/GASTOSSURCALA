// Formularios y detalles de gastos y solicitudes, comprobantes.
(function () {
  const E = window.E, h = E.h, esc = E.esc;

  // ---------- Comprobantes (Supabase Storage) ----------
  const ALLOWED = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    csv: 'text/csv', txt: 'text/plain' };
  E.uploadAttachment = async (type, id, file) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED[ext]) throw new E.AppError('Tipo de archivo no permitido. Use PDF, imagen (JPG/PNG/WEBP), Excel, Word o texto.', 'VALIDATION');
    if (file.size > 10 * 1024 * 1024) throw new E.AppError(`"${file.name}" supera el máximo de 10 MB.`, 'VALIDATION');
    if (file.size === 0) throw new E.AppError(`"${file.name}" está vacío.`, 'VALIDATION');
    const path = `${type}/${id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await E.sb.storage.from('comprobantes').upload(path, file, { contentType: ALLOWED[ext], upsert: false });
    if (error) throw new E.AppError('No se pudo subir el archivo: ' + error.message, 'ERROR');
    await E.rpc('register_attachment', { p_type: type, p_id: id, p_filename: file.name, p_path: path, p_mime: ALLOWED[ext], p_size: file.size });
  };
  E.openAttachment = async (path) => {
    const { data, error } = await E.sb.storage.from('comprobantes').createSignedUrl(path, 60);
    if (error) return E.fail(new E.AppError('No se pudo abrir el archivo: ' + error.message));
    window.open(data.signedUrl, '_blank', 'noopener');
  };
  E.attachmentsBlock = async (type, id, canAdd, onChange) => {
    const box = document.createElement('div');
    const render = async () => {
      const list = await E.db(E.sb.from('attachments').select('*').eq('entity_type', type).eq('entity_id', id).order('uploaded_at'));
      box.innerHTML = `<h3 style="margin:16px 0 6px">Comprobantes y archivos</h3>${list.length ? `<ul class="atts">${list.map((a) =>
        `<li><span>📎 <a href="#" data-p="${esc(a.storage_path)}">${esc(a.filename)}</a> <small class="muted">${(a.size / 1024).toFixed(0)} KB · ${E.dt(a.uploaded_at)}</small></span></li>`).join('')}</ul>` : '<p class="hint">Sin archivos adjuntos.</p>'}
        ${canAdd ? `<div style="margin-top:8px"><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.xlsx,.docx,.csv,.txt"><div class="hint">PDF, imágenes, Excel, Word, CSV o TXT · hasta 10 MB</div></div>` : ''}`;
      E.$$('a[data-p]', box).forEach((a) => (a.onclick = (ev) => { ev.preventDefault(); E.openAttachment(a.dataset.p); }));
      const inp = E.$('input[type=file]', box);
      if (inp) inp.onchange = async () => {
        inp.disabled = true;
        try { for (const f of inp.files) await E.uploadAttachment(type, id, f); E.toast('Archivo adjuntado'); onChange?.(); await render(); }
        catch (e) { E.fail(e); inp.disabled = false; inp.value = ''; }
      };
    };
    await render(); return box;
  };

  // ---------- Formulario de gasto ----------
  // opts: { expense, request (solicitud aprobada que se convierte), onSaved }
  E.expenseForm = async (opts = {}) => {
    const ex = opts.expense, rq = opts.request;
    const sectors = E.activeSectors();
    const d = ex ? { ...ex } : { expense_date: E.todayAR(), payment_method: 'efectivo',
      sector_id: rq?.sector_id, amount: rq?.authorized_amount, description: rq?.description, supplier: rq?.supplier, authorized_by_name: rq?.decided_by_name, requested_by_name: rq?.requester };
    const sel = (k) => d[k] ?? '';
    const m = E.modal(ex ? `Modificar gasto ${ex.number}` : rq ? `Registrar compra · ${rq.number}` : 'Nuevo gasto', '', { wide: true, sticky: true });
    m.body.innerHTML = `<form novalidate><div class="grid g2">
      <label class="fld"><span>Fecha del gasto <em>*</em></span><input type="date" name="expense_date" value="${esc(sel('expense_date'))}" max="${E.todayAR()}" required></label>
      <label class="fld"><span>Hora</span><input type="time" name="expense_time" value="${esc(E.time(d.expense_time))}"></label>
      <label class="fld"><span>Sector <em>*</em></span><select name="sector_id" required ${rq ? 'disabled' : ''}>${E.optionsHtml(sectors, sel('sector_id'), { empty: 'Seleccione…' })}</select></label>
      <label class="fld"><span>Categoría <em>*</em></span><select name="category_id" required></select></label>
      <label class="fld span2"><span>Descripción <em>*</em></span><input name="description" value="${esc(sel('description'))}" maxlength="1000" required></label>
      <label class="fld"><span>Proveedor</span><input name="supplier" value="${esc(sel('supplier'))}" list="dl-sup"><datalist id="dl-sup"></datalist></label>
      <label class="fld"><span>Importe real (ARS) <em>*</em></span><input name="amount" inputmode="decimal" value="${esc(E.moneyStr(d.amount))}" placeholder="0,00" required></label>
      <label class="fld"><span>Medio de pago <em>*</em></span><select name="payment_method">${E.optionsHtml(Object.entries(E.METHODS).map(([value, label]) => ({ value, label })), sel('payment_method'))}</select></label>
      <label class="fld"><span>Pagó <em>*</em></span><select name="payer_id" required>${E.optionsHtml(E.S.payers.filter((p) => p.active || p.id === d.payer_id), sel('payer_id'), { empty: 'Seleccione…' })}</select></label>
      <label class="fld"><span>Solicitado por</span><input name="requested_by_name" value="${esc(sel('requested_by_name'))}"></label>
      <label class="fld"><span>Autorizado por</span><input name="authorized_by_name" value="${esc(sel('authorized_by_name'))}"></label>
      <label class="fld"><span>N.º de factura / comprobante</span><input name="invoice_number" value="${esc(sel('invoice_number'))}"></label>
      <label class="fld span2"><span>Observaciones</span><textarea name="notes" rows="2">${esc(sel('notes'))}</textarea></label>
    </div>
    ${rq ? `<div class="alert info">Autorizado: <b>${E.money(rq.authorized_amount)}</b>. El importe real no puede superarlo.</div>` : ''}
    ${ex ? '' : '<p class="hint">Podrá adjuntar el comprobante después de guardar. Con N.º de comprobante o archivo, el gasto queda “Rendido”.</p>'}
    <div class="alert bad" data-err hidden></div><div data-over></div>
    <footer class="dlg-foot"><button type="button" class="btn" data-cancel>Cancelar</button><button class="btn primary" type="submit">${ex ? 'Guardar cambios' : 'Registrar gasto'}</button></footer></form>`;
    const f = E.$('form', m.body), errBox = E.$('[data-err]', m.body), overBox = E.$('[data-over]', m.body);
    E.$('[data-cancel]', m.body).onclick = m.close;
    const fillCats = () => {
      const sid = +f.sector_id.value || +d.sector_id; const cur = f.category_id.value || d.category_id;
      f.category_id.innerHTML = E.optionsHtml(E.S.categories.filter((c) => c.sector_id === sid && (c.active || c.id === +cur)), cur, { empty: sid ? 'Seleccione…' : 'Elija primero el sector' });
    };
    f.sector_id.onchange = () => { f.category_id.value = ''; fillCats(); };
    if (rq) f.sector_id.value = rq.sector_id;
    fillCats();
    E.db(E.sb.from('suppliers').select('name').order('name').limit(500)).then((r) => { E.$('#dl-sup', m.body).innerHTML = r.filter((x) => !x.name.startsWith('DEMO')).map((x) => `<option value="${esc(x.name)}">`).join(''); }).catch(() => {});

    const submit = async (force) => {
      errBox.hidden = true; overBox.innerHTML = '';
      const amount = E.parseMoney(f.amount.value);
      if (!amount) { errBox.hidden = false; errBox.textContent = 'Ingrese un importe válido (ej. 85.000,50).'; f.amount.focus(); return; }
      const body = { expense_date: f.expense_date.value, expense_time: f.expense_time.value, sector_id: rq ? rq.sector_id : f.sector_id.value, category_id: f.category_id.value,
        description: f.description.value, supplier: f.supplier.value, amount, payment_method: f.payment_method.value, payer_id: f.payer_id.value,
        requested_by_name: f.requested_by_name.value, authorized_by_name: f.authorized_by_name.value, invoice_number: f.invoice_number.value, notes: f.notes.value };
      if (rq) body.request_id = rq.id;
      if (force) body.force = true;
      try {
        let res;
        if (ex) await E.rpc('update_expense', { p_id: ex.id, p: body }); else res = await E.rpc('create_expense', { p: body });
        E.toast(ex ? 'Gasto modificado' : `Gasto ${res.number} registrado`); m.close(); opts.onSaved?.(res);
      } catch (e) {
        if (e.code === 'DUPLICATE') {
          overBox.innerHTML = `<div class="alert warn">${esc(e.message)}<div class="dlg-foot"><button type="button" class="btn sm" data-force>Registrar igual</button></div></div>`;
          E.$('[data-force]', overBox).onclick = (ev) => E.busy(ev.target, () => submit(true));
        } else if (e.code === 'OVER_AUTHORIZED') {
          overBox.innerHTML = `<div class="alert bad">${esc(e.extra.authorized != null ? `El importe real (${E.money(e.extra.amount)}) supera el autorizado (${E.money(e.extra.authorized)}). Solicite una nueva autorización.` : e.message)}<div class="dlg-foot"><button type="button" class="btn sm primary" data-reauth>Solicitar nueva autorización</button></div></div>`;
          E.$('[data-reauth]', overBox).onclick = async () => {
            const reason = await E.ask('Nueva autorización', `Se creará una nueva solicitud por ${E.money(amount)}. La anterior se cancelará al registrar la compra bajo la nueva.`, { label: 'Motivo del mayor importe', required: true, confirm: 'Crear solicitud', type: 'textarea' });
            if (!reason) return;
            try { const r = await E.rpc('reauthorize_request', { p_id: rq.id, p_amount: amount, p_reason: reason }); E.toast(`Solicitud ${r.number} enviada a autorización`); m.close(); opts.onSaved?.(); } catch (er) { E.fail(er); }
          };
        } else { errBox.hidden = false; errBox.textContent = e.message; errBox.scrollIntoView({ block: 'nearest' }); }
      }
    };
    f.onsubmit = (ev) => { ev.preventDefault(); E.busy(E.$('[type=submit]', f), () => submit(false)); };
    return m;
  };

  // ---------- Detalle de gasto ----------
  E.openExpense = async (id, onChange) => {
    const rows = await E.db(E.sb.from('v_expenses').select('*').eq('id', id));
    const e = rows[0]; if (!e) return E.toast('Gasto no encontrado', 'bad');
    const m = E.modal(`Gasto ${e.number}`, '', { wide: true });
    const reload = () => { m.close(); onChange?.(); E.openExpense(id, onChange); };
    const kv = [['Estado', E.badge(e.status)], ['Fecha y hora del gasto', `${E.date(e.expense_date)} ${E.time(e.expense_time)}`], ['Cargado el', `${E.dt(e.created_at)} por ${e.created_by_name}`],
      ['Sector / categoría', `${e.sector} · ${e.category}`], ['Descripción', e.description], ['Proveedor', e.supplier || '—'], ['Importe', h`<b>${E.money(e.amount)}</b>`],
      ['Medio de pago', E.METHODS[e.payment_method]], ['Pagó', e.payer], ['Solicitado por', e.requested_by_name || '—'], ['Autorizado por', e.authorized_by_name || '—'],
      ['N.º de comprobante', e.invoice_number || '—'], ['Solicitud vinculada', e.request_number ? h`<a href="#" data-req="${e.request_id}">${e.request_number}</a>` : '—'], ['Observaciones', e.notes || '—']];
    if (e.status === 'anulado') kv.push(['Anulado', `${E.dt(e.voided_at)} · Motivo: ${e.void_reason}`]);
    m.body.innerHTML = `${e.is_demo ? '<div class="alert info">Dato de demostración (DEMO)</div>' : ''}<dl class="kv">${kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v instanceof Object && v.s !== undefined ? v.s : esc(v)}</dd>`).join('')}</dl>
      <div data-att></div><div data-audit></div>
      <footer class="dlg-foot">${E.can.editExpense(e) ? '<button class="btn" data-edit>Modificar</button>' : ''}${E.can.voidExpense(e) ? '<button class="btn danger" data-void>Anular gasto</button>' : ''}</footer>`;
    const rl = E.$('[data-req]', m.body); if (rl) rl.onclick = (ev) => { ev.preventDefault(); E.openRequest(+rl.dataset.req, onChange); };
    E.$('[data-att]', m.body).appendChild(await E.attachmentsBlock('expense', id, E.can.attachExpense(e), reload));
    if (E.can.admin()) {
      const aud = await E.db(E.sb.from('audit_log').select('*').eq('entity_type', 'expense').eq('entity_id', id).order('at', { ascending: false }).limit(30));
      E.$('[data-audit]', m.body).innerHTML = `<h3 style="margin:16px 0 6px">Historial de cambios</h3>${aud.length ? `<ul class="timeline">${aud.map((a) => `<li><b>${esc(a.action)}</b> · ${esc(a.user_name || '')} <small>${E.dt(a.at)}</small>${E.auditDetails(a.details)}</li>`).join('')}</ul>` : '<p class="hint">Sin registros.</p>'}`;
    }
    const ed = E.$('[data-edit]', m.body); if (ed) ed.onclick = () => { m.close(); E.expenseForm({ expense: e, onSaved: () => { onChange?.(); E.openExpense(id, onChange); } }); };
    const vd = E.$('[data-void]', m.body); if (vd) vd.onclick = async () => {
      const reason = await E.ask('Anular gasto', `El gasto ${e.number} dejará de sumar en los totales. No se elimina: queda registrado con su motivo.`, { label: 'Motivo de la anulación', required: true, confirm: 'Anular', danger: true, type: 'textarea' });
      if (!reason) return; try { await E.rpc('void_expense', { p_id: id, p_reason: reason }); E.toast('Gasto anulado'); reload(); } catch (er) { E.fail(er); }
    };
  };
  E.auditDetails = (d) => {
    if (!d || typeof d !== 'object') return '';
    const rows = Object.entries(d).map(([k, v]) => {
      if (v && typeof v === 'object' && ('antes' in v || 'despues' in v)) return `<div class="hint">${esc(k)}: ${esc(v.antes ?? '—')} → ${esc(v.despues ?? '—')}</div>`;
      return `<div class="hint">${esc(k)}: ${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</div>`;
    }).join('');
    return rows;
  };

  // ---------- Formulario de solicitud ----------
  E.requestForm = async (opts = {}) => {
    const r = opts.request; const d = r ? { ...r } : { priority: 'normal' };
    const m = E.modal(r ? `Editar solicitud ${r.number}` : 'Nueva solicitud de compra', '', { wide: true, sticky: true });
    m.body.innerHTML = `<form novalidate><div class="grid g2">
      <label class="fld"><span>Sector <em>*</em></span><select name="sector_id" required>${E.optionsHtml(E.activeSectors(), d.sector_id, { empty: 'Seleccione…' })}</select></label>
      <label class="fld"><span>Prioridad</span><select name="priority">${E.optionsHtml(Object.entries(E.PRIORITY).map(([value, label]) => ({ value, label })), d.priority)}</select></label>
      <label class="fld span2"><span>¿Qué se necesita comprar? <em>*</em></span><input name="description" value="${esc(d.description)}" maxlength="1000" required></label>
      <label class="fld span2"><span>Motivo / justificación <em>*</em></span><textarea name="reason" rows="2">${esc(d.reason)}</textarea></label>
      <label class="fld"><span>Importe estimado (ARS) <em>*</em></span><input name="estimated_amount" inputmode="decimal" value="${esc(E.moneyStr(d.estimated_amount))}" placeholder="0,00" required></label>
      <label class="fld"><span>Proveedor sugerido</span><input name="supplier" value="${esc(d.supplier)}"></label>
      <label class="fld"><span>Fecha necesaria</span><input type="date" name="needed_date" value="${esc(d.needed_date)}"></label>
      <label class="fld span2"><span>Observaciones</span><textarea name="notes" rows="2">${esc(d.notes)}</textarea></label></div>
      <div class="alert bad" data-err hidden></div><div data-over></div>
      <footer class="dlg-foot"><button type="button" class="btn" data-cancel>Cancelar</button>
        <button type="button" class="btn" data-draft>${r && r.status === 'en_revision' ? 'Guardar sin enviar' : 'Guardar borrador'}</button>
        <button type="submit" class="btn primary">Enviar a autorización</button></footer></form>`;
    const f = E.$('form', m.body), errBox = E.$('[data-err]', m.body), overBox = E.$('[data-over]', m.body);
    E.$('[data-cancel]', m.body).onclick = m.close;
    const go = async (submit, force) => {
      errBox.hidden = true; overBox.innerHTML = '';
      const amount = E.parseMoney(f.estimated_amount.value);
      if (!amount) { errBox.hidden = false; errBox.textContent = 'Ingrese un importe estimado válido.'; return; }
      const body = { sector_id: f.sector_id.value, priority: f.priority.value, description: f.description.value, reason: f.reason.value, estimated_amount: amount,
        supplier: f.supplier.value, needed_date: f.needed_date.value, notes: f.notes.value, submit };
      if (force) body.force = true;
      try {
        if (r) await E.rpc('update_request', { p_id: r.id, p: body }); else await E.rpc('create_request', { p: body });
        E.toast(submit ? 'Solicitud enviada a autorización' : 'Borrador guardado'); m.close(); opts.onSaved?.();
      } catch (e) {
        if (e.code === 'DUPLICATE') {
          overBox.innerHTML = `<div class="alert warn">${esc(e.message)}<div class="dlg-foot"><button type="button" class="btn sm" data-force>Crear igual</button></div></div>`;
          E.$('[data-force]', overBox).onclick = (ev) => E.busy(ev.target, () => go(submit, true));
        } else { errBox.hidden = false; errBox.textContent = e.message; }
      }
    };
    f.onsubmit = (ev) => { ev.preventDefault(); E.busy(E.$('[type=submit]', f), () => go(true)); };
    E.$('[data-draft]', f).onclick = (ev) => E.busy(ev.target, () => go(false));
  };

  // ---------- Detalle de solicitud ----------
  E.openRequest = async (id, onChange) => {
    const rows = await E.db(E.sb.from('v_requests').select('*').eq('id', id)); const r = rows[0];
    if (!r) return E.toast('Solicitud no encontrada', 'bad');
    const events = await E.db(E.sb.from('v_request_events').select('*').eq('request_id', id).order('at').order('id'));
    const m = E.modal(`Solicitud ${r.number}`, '', { wide: true });
    const reload = () => { m.close(); onChange?.(); E.openRequest(id, onChange); };
    const me = E.S.profile.id, isOwner = r.requester_id === me, role = E.role();
    const kv = [['Estado', E.badge(r.status)], ['Solicitante', r.requester], ['Sector', r.sector], ['Descripción', r.description], ['Motivo', r.reason || '—'], ['Proveedor sugerido', r.supplier || '—'],
      ['Prioridad', E.PRIORITY[r.priority]], ['Fecha necesaria', E.date(r.needed_date)], ['Creada', E.dt(r.created_at)],
      ['Importe solicitado', h`<b>${E.money(r.estimated_amount)}</b>`], ['Importe autorizado', r.authorized_amount != null ? h`<b>${E.money(r.authorized_amount)}</b>` : '—'],
      ['Gasto real', r.expense_number ? h`<a href="#" data-exp="${r.expense_id}">${r.expense_number}</a> · ${E.money(r.expense_amount)}` : '—'],
      ['Reemplaza a', r.parent_number || '—'], ['Resolución', r.decided_by_name ? `${r.decided_by_name} · ${E.dt(r.decided_at)}${r.decision_reason ? ' · ' + r.decision_reason : ''}` : '—'], ['Observaciones', r.notes || '—']];
    const val = (v) => (v instanceof Object && v.s !== undefined ? v.s : esc(v));
    const canDecide = E.can.decide() && ['pendiente', 'en_revision'].includes(r.status);
    const canEdit = isOwner && ['admin', 'requester'].includes(role) && ['borrador', 'en_revision'].includes(r.status);
    const canCancel = (isOwner && ['borrador', 'pendiente', 'en_revision', 'aprobada'].includes(r.status)) || (role === 'admin' && ['pendiente', 'en_revision', 'aprobada'].includes(r.status));
    const canBuy = E.can.createExpense() && r.status === 'aprobada';
    const canReauth = ['requester', 'loader', 'admin'].includes(role) && r.status === 'aprobada';
    const canClose = E.can.decide() && r.status === 'compra_realizada';
    m.body.innerHTML = `${r.is_demo ? '<div class="alert info">Dato de demostración (DEMO)</div>' : ''}<dl class="kv">${kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${val(v)}</dd>`).join('')}</dl>
      <div data-att></div>
      <h3 style="margin:16px 0 6px">Historial de la autorización</h3>
      <ul class="timeline">${events.map((ev) => `<li><b>${esc(ev.action)}</b>${ev.to_status && ev.to_status !== ev.from_status ? ` → ${esc(E.REQ_STATUS[ev.to_status] || ev.to_status)}` : ''}${ev.amount != null ? ` · ${E.money(ev.amount)}` : ''}<br><small>${esc(ev.user_name)} · ${E.dt(ev.at)}</small>${ev.comment ? `<div>${esc(ev.comment)}</div>` : ''}</li>`).join('')}</ul>
      ${role !== 'loader' ? `<div class="inline-edit" style="margin-top:8px"><input data-cm placeholder="Agregar un comentario…"><button class="btn" data-cmbtn>Comentar</button></div>` : ''}
      <footer class="dlg-foot">${canEdit ? '<button class="btn" data-edit>Editar / reenviar</button>' : ''}${canCancel ? '<button class="btn" data-cancel>Cancelar solicitud</button>' : ''}
        ${canReauth ? '<button class="btn" data-reauth>Pedir mayor importe</button>' : ''}${canClose ? '<button class="btn" data-close>Cerrar</button>' : ''}
        ${canBuy ? '<button class="btn primary" data-buy>Registrar la compra</button>' : ''}
        ${canDecide ? '<button class="btn" data-info>Pedir información</button><button class="btn danger" data-rej>Rechazar</button><button class="btn primary" data-ok>Aprobar</button>' : ''}</footer>`;
    const ea = E.$('[data-exp]', m.body); if (ea) ea.onclick = (ev) => { ev.preventDefault(); E.openExpense(+ea.dataset.exp, onChange); };
    E.$('[data-att]', m.body).appendChild(await E.attachmentsBlock('request', id, (isOwner || role === 'admin') && !['rechazada', 'cancelada', 'cerrada'].includes(r.status), reload));
    const on = (sel, fn) => { const b = E.$(sel, m.body); if (b) b.onclick = (ev) => E.busy(ev.target, fn); };
    const act = async (fn, okMsg) => { try { await fn(); E.toast(okMsg); reload(); } catch (e) { E.fail(e); } };
    on('[data-cmbtn]', async () => { const v = E.$('[data-cm]', m.body).value; if (!v.trim()) return; await act(() => E.rpc('comment_request', { p_id: id, p_comment: v }), 'Comentario agregado'); });
    on('[data-edit]', async () => { m.close(); E.requestForm({ request: r, onSaved: () => { onChange?.(); E.openRequest(id, onChange); } }); });
    on('[data-cancel]', async () => { const v = await E.ask('Cancelar solicitud', 'La solicitud queda registrada como cancelada.', { label: 'Motivo', required: true, confirm: 'Cancelar solicitud', danger: true }); if (v) await act(() => E.rpc('cancel_request', { p_id: id, p_reason: v }), 'Solicitud cancelada'); });
    on('[data-close]', async () => act(() => E.rpc('close_request', { p_id: id }), 'Solicitud cerrada'));
    on('[data-buy]', async () => { m.close(); E.expenseForm({ request: r, onSaved: () => { onChange?.(); } }); });
    on('[data-reauth]', async () => {
      const amt = await E.ask('Pedir mayor importe', `Autorizado actual: ${E.money(r.authorized_amount)}. Indique el nuevo importe total.`, { label: 'Nuevo importe (ARS)', required: true, minLen: 1, confirm: 'Continuar' }); if (!amt) return;
      const a = E.parseMoney(amt); if (!a) return E.toast('Importe inválido', 'bad');
      const why = await E.ask('Motivo', 'Explique por qué aumenta el importe.', { label: 'Motivo', required: true, confirm: 'Crear solicitud', type: 'textarea' }); if (!why) return;
      await act(() => E.rpc('reauthorize_request', { p_id: id, p_amount: a, p_reason: why }), 'Nueva solicitud enviada a autorización');
    });
    on('[data-ok]', async () => {
      const amt = await E.ask('Aprobar solicitud', `Solicitado: ${E.money(r.estimated_amount)}. Puede autorizar un importe distinto.`, { label: 'Importe autorizado (ARS)', required: true, minLen: 1, confirm: 'Aprobar', value: E.moneyStr(r.estimated_amount) }); if (!amt) return;
      const a = E.parseMoney(amt); if (!a) return E.toast('Importe inválido', 'bad');
      await act(() => E.rpc('decide_request', { p_id: id, p_action: 'aprobar', p_comment: '', p_amount: a }), 'Solicitud aprobada');
    });
    on('[data-rej]', async () => { const v = await E.ask('Rechazar solicitud', 'El solicitante verá el motivo.', { label: 'Motivo del rechazo', required: true, confirm: 'Rechazar', danger: true, type: 'textarea' }); if (v) await act(() => E.rpc('decide_request', { p_id: id, p_action: 'rechazar', p_comment: v }), 'Solicitud rechazada'); });
    on('[data-info]', async () => { const v = await E.ask('Pedir información', 'La solicitud pasa a “En revisión” y vuelve al solicitante.', { label: 'Qué información necesita', required: true, confirm: 'Enviar', type: 'textarea' }); if (v) await act(() => E.rpc('decide_request', { p_id: id, p_action: 'pedir_info', p_comment: v }), 'Información solicitada'); });
  };
})();
