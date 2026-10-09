// Arranque: sesión, menú lateral y enrutador.
(function () {
  const E = window.E, esc = E.esc, app = document.getElementById('app');
  const NAV = [
    ['dashboard', 'Dashboard', '▦', () => E.can.read()], ['gastos', 'Gastos', '＄', () => E.can.read()], ['solicitudes', 'Solicitudes', '✓', () => true],
    ['historial', 'Historial', '☰', () => E.can.read()], ['sectores', 'Sectores', '◫', () => E.can.read()], ['presupuestos', 'Presupuestos', '％', () => E.can.read()], ['config', 'Configuración', '⚙', () => E.can.admin()],
  ];

  function loginView(msg) {
    app.innerHTML = `<div class="login"><form class="card" novalidate><div class="brand"><i>E</i><span>EMCALA SRL<small style="color:var(--mut)">Control de gastos y autorizaciones</small></span></div>
      <h2 style="margin:14px 0 12px;text-align:center">Ingresar</h2>
      <label class="fld"><span>Email</span><input type="email" name="email" autocomplete="username" required autofocus></label>
      <label class="fld" style="margin-top:10px"><span>Contraseña</span><input type="password" name="password" autocomplete="current-password" required></label>
      <p class="err" ${msg ? '' : 'hidden'}>${esc(msg || '')}</p>
      <button class="btn primary" style="width:100%;justify-content:center;margin-top:14px" type="submit">Ingresar</button>
      <p class="hint" style="text-align:center;margin-top:12px">¿Sin acceso? Pídaselo al administrador.</p></form></div>`;
    const f = E.$('form', app);
    f.onsubmit = (ev) => {
      ev.preventDefault();
      E.busy(E.$('[type=submit]', f), async () => {
        const { error } = await E.sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
        if (error) { const er = E.$('.err', f); er.hidden = false; er.textContent = /invalid login/i.test(error.message) ? 'Email o contraseña incorrectos.' : /rate|too many/i.test(error.message) ? 'Demasiados intentos. Espere unos minutos.' : 'No se pudo ingresar: ' + error.message; }
      });
    };
  }

  function blockedView(text) {
    app.innerHTML = `<div class="login"><div class="card"><div class="brand"><i>E</i><span>EMCALA SRL</span></div><h2 style="text-align:center;margin:14px 0">Acceso pendiente</h2><p>${esc(text)}</p><button class="btn" style="width:100%;justify-content:center" data-out>Salir</button></div></div>`;
    E.$('[data-out]', app).onclick = () => E.sb.auth.signOut();
  }

  function route() {
    if (!E.S.profile) return;
    E.destroyCharts();
    const items = NAV.filter((n) => n[3]());
    let name = (location.hash.replace(/^#\/?/, '') || '').split('?')[0];
    if (!items.find((n) => n[0] === name)) name = items[0][0];
    E.$$('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.r === name));
    document.body.classList.remove('nav-open');
    const root = E.$('#view'); root.innerHTML = '<div class="boot">Cargando…</div>';
    const token = (E._route = {});
    Promise.resolve(E.pages[name](root)).catch((e) => { if (E._route === token) root.innerHTML = `<div class="alert bad">${esc(e.message || 'Error inesperado')}</div>`; console.error(e); })
      .then(() => E.$$('[data-menu]', root).forEach((b) => (b.onclick = () => document.body.classList.toggle('nav-open'))));
    window.scrollTo(0, 0);
  }

  function shell() {
    const p = E.S.profile;
    app.innerHTML = `<div class="shell"><aside class="side"><div class="brand"><i>E</i><span>${esc(E.S.settings.company_name || 'EMCALA SRL')}<small>Gastos y autorizaciones</small></span></div>
      <nav class="nav">${NAV.filter((n) => n[3]()).map((n) => `<a href="#/${n[0]}" data-r="${n[0]}"><span class="ic">${n[2]}</span>${n[1]}</a>`).join('')}</nav>
      <div class="who"><b>${esc(p.name)}</b>${esc(E.ROLES[p.role])}<br><button data-pw>Contraseña</button> <button data-out>Salir</button></div></aside><main class="main" id="view"></main></div>`;
    E.$('[data-out]', app).onclick = () => E.sb.auth.signOut();
    E.$('[data-pw]', app).onclick = () => {
      const m = E.modal('Cambiar contraseña', '', { sticky: true });
      m.body.innerHTML = `<label class="fld"><span>Nueva contraseña (mínimo 10 caracteres)</span><input type="password" name="p1" autocomplete="new-password" autofocus></label><label class="fld" style="margin-top:10px"><span>Repetir contraseña</span><input type="password" name="p2" autocomplete="new-password"></label><p class="err" hidden></p><footer class="dlg-foot"><button class="btn" data-x>Cancelar</button><button class="btn primary" data-ok>Cambiar</button></footer>`;
      E.$('[data-x]', m.body).onclick = m.close;
      E.$('[data-ok]', m.body).onclick = (ev) => E.busy(ev.target, async () => {
        const a = E.$('[name=p1]', m.body).value, b = E.$('[name=p2]', m.body).value, er = E.$('.err', m.body);
        if (a.length < 10) { er.hidden = false; er.textContent = 'La contraseña debe tener al menos 10 caracteres.'; return; }
        if (a !== b) { er.hidden = false; er.textContent = 'Las contraseñas no coinciden.'; return; }
        const { error } = await E.sb.auth.updateUser({ password: a });
        if (error) { er.hidden = false; er.textContent = error.message; return; } E.toast('Contraseña actualizada'); m.close();
      });
    };
    route();
  }

  let booting = false;
  async function start(session) {
    if (!session) { E.S.profile = null; E.destroyCharts(); loginView(); return; }
    if (booting) return; booting = true;
    try {
      const { data: prof, error } = await E.sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (error) throw error;
      if (!prof) return blockedView('Su usuario todavía no tiene perfil. Avise al administrador.');
      if (!prof.active) return blockedView('Su cuenta está creada pero todavía no fue activada. Pídale al administrador que le asigne un rol y la active.');
      E.S.profile = prof; await E.loadCatalogs(); shell();
    } catch (e) { console.error(e); app.innerHTML = `<div class="login"><div class="card"><h2>No se pudo cargar</h2><p>${esc(e.message || e)}</p><button class="btn" onclick="location.reload()">Reintentar</button></div></div>`; }
    finally { booting = false; }
  }

  E.sb.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(() => { if (event === 'SIGNED_IN' && E.S.profile && E.S.profile.id === session?.user?.id) return; start(session); }, 0);
  });
  window.addEventListener('hashchange', route);
})();
