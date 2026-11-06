/* juego.js — Lógica de la partida: tablero, teclado, comprobación, puntaje, cronómetro y resultados. */
const Juego = (() => {
  const $ = id => document.getElementById(id);
  const PUNTOS = 10;
  let cw = null, diseno = null;
  let celdas = new Map(), palabras = new Map();
  let activaId = null, dirPref = 'H', foco = null, pulsada = false;
  let puntos = 0, resueltas = 0, total = 0, terminado = true;
  let tInicio = 0, tFinal = 0, timer = null, cuentaT = null, ultimoError = 0;
  const fmt = ms => { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const k = (r, c) => r + ',' + c;

  function preparar(c) {
    cw = c; diseno = c.diseno; total = diseno.palabras.length;
    $('intro-titulo').textContent = c.titulo;
    $('intro-tema').textContent = c.tema;
    $('intro-instr').textContent = c.instrucciones || 'Completa el crucigrama escribiendo la respuesta de cada pista. Las palabras se cruzan: aprovecha las letras que ya conoces.';
    $('intro-datos').textContent = `${total} palabras · ${total * PUNTOS} puntos como máximo`;
  }

  function comenzar() {
    Sonidos.desbloquear(); detener();
    UI.mostrar('cuenta');
    const pasos = ['3', '2', '1', '¡EMPEZAR!'], el = $('cuenta-num');
    let i = 0;
    const paso = () => {
      el.textContent = pasos[i]; el.classList.remove('late'); void el.offsetWidth; el.classList.add('late');
      Sonidos.cuenta(i === pasos.length - 1);
      i++;
      if (i < pasos.length) cuentaT = setTimeout(paso, 900);
      else cuentaT = setTimeout(() => { construir(); UI.mostrar('juego'); ajustar(); iniciarCrono(); primeraPalabra(); }, 800);
    };
    paso();
  }

  function detener() { clearTimeout(cuentaT); clearInterval(timer); timer = null; }

  function iniciarCrono() {
    tInicio = Date.now();
    $('j-tiempo').textContent = '00:00';
    timer = setInterval(() => { $('j-tiempo').textContent = fmt(Date.now() - tInicio); }, 250);
  }

  function construir() {
    celdas = new Map(); palabras = new Map(); activaId = null; foco = null;
    puntos = 0; resueltas = 0; terminado = false;
    $('j-titulo').textContent = cw.titulo; $('j-tema').textContent = cw.tema;
    const mat = Crucigrama.matriz(diseno), tab = $('tablero');
    tab.innerHTML = ''; tab.style.gridTemplateColumns = `repeat(${diseno.columnas}, var(--cel))`;
    tab.style.gridTemplateRows = `repeat(${diseno.filas}, var(--cel))`;
    diseno.palabras.forEach(p => {
      const ks = []; for (let i = 0; i < p.norm.length; i++) ks.push(k(p.fila + (p.dir === 'V' ? i : 0), p.col + (p.dir === 'H' ? i : 0)));
      palabras.set(p.id, { ...p, resuelta: false, celdas: ks });
    });
    mat.forEach((fila, r) => fila.forEach((data, c) => {
      const el = document.createElement('div');
      if (!data) { el.className = 'cel bloq'; tab.appendChild(el); return; }
      el.className = 'cel';
      if (data.numero) { const n = document.createElement('span'); n.className = 'num'; n.textContent = data.numero; el.appendChild(n); }
      const inp = document.createElement('input');
      inp.type = 'text'; inp.autocomplete = 'off'; inp.autocapitalize = 'characters'; inp.spellcheck = false;
      inp.setAttribute('autocorrect', 'off'); inp.setAttribute('aria-label', `Fila ${r + 1}, columna ${c + 1}`);
      el.appendChild(inp); tab.appendChild(el);
      const key = k(r, c);
      celdas.set(key, { r, c, data, el, input: inp, bloqueada: false });
      inp.addEventListener('pointerdown', () => { pulsada = document.activeElement === inp; });
      inp.addEventListener('click', () => { if (pulsada && Object.keys(data.palabras).length === 2) alternarDir(); pulsada = false; });
      inp.addEventListener('focus', () => enFoco(key));
      inp.addEventListener('input', () => enInput(key));
      inp.addEventListener('keydown', e => enTecla(e, key));
    }));
    $('area-juego').inert = false; $('modal').hidden = true;
    hud();
  }

  function hud() {
    $('j-puntos').textContent = puntos;
    $('j-progreso').textContent = `${resueltas}/${total}`;
    $('j-barra').style.width = (total ? resueltas / total * 100 : 0) + '%';
  }

  // Texto de la pista de una palabra (también se usa para reservar el alto máximo).
  function pintarPista(p) {
    const pa = $('pista-activa'); pa.textContent = '';
    const b = document.createElement('b'); b.textContent = `${p.numero} ${p.dir === 'H' ? 'Horizontal' : 'Vertical'}`;
    pa.append(b, ` · ${p.pregunta} (${Crucigrama.patron(p.respuesta)} letras)`);
  }

  // Reserva el alto de la pista más larga para que el tablero no "salte" al cambiar de pista.
  function medirPista() {
    const pa = $('pista-activa'); if (!pa.offsetParent) return;
    const actual = activaId !== null ? palabras.get(activaId) : null;
    pa.style.minHeight = '0px';
    let max = 0;
    diseno.palabras.forEach(p => { pintarPista(p); max = Math.max(max, pa.offsetHeight); });
    if (actual) pintarPista(actual); else pa.textContent = '';
    pa.style.minHeight = max + 'px';
  }

  // Calcula el tamaño de casilla que cabe en el espacio libre (ancho Y alto) sin generar scroll.
  function ajustar() {
    if (!diseno || !$('pantalla-juego').classList.contains('activa')) return;
    medirPista();
    const wrap = $('tablero-wrap'), W = wrap.clientWidth, H = wrap.clientHeight;
    if (!W || !H) return;
    const f = diseno.filas, c = diseno.columnas;
    const gap = Math.min(f, c) > 12 ? 2 : 3;
    const cel = Math.max(14, Math.min(60, Math.floor(Math.min((W - gap * (c - 1)) / c, (H - gap * (f - 1)) / f))));
    if (wrap.style.getPropertyValue('--cel') !== cel + 'px') wrap.style.setProperty('--cel', cel + 'px');
    if (wrap.style.getPropertyValue('--gap') !== gap + 'px') wrap.style.setProperty('--gap', gap + 'px');
  }
  let raf = 0;
  const programarAjuste = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(ajustar); };
  window.addEventListener('resize', programarAjuste);
  window.addEventListener('orientationchange', () => setTimeout(programarAjuste, 150));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', programarAjuste);
  if (window.ResizeObserver) new ResizeObserver(programarAjuste).observe($('tablero-wrap'));

  function primeraPalabra() { const p = diseno.palabras[0]; if (p) seleccionar(p.id, true); }

  function seleccionar(id, enfocar) {
    const p = palabras.get(id); if (!p) return;
    activaId = id; dirPref = p.dir;
    celdas.forEach(c => c.el.classList.remove('activa'));
    p.celdas.forEach(key => celdas.get(key).el.classList.add('activa'));
    pintarPista(p);
    if (enfocar) {
      const libre = p.celdas.find(key => !celdas.get(key).bloqueada && !celdas.get(key).input.value) || p.celdas.find(key => !celdas.get(key).bloqueada);
      if (libre) ponerFoco(libre);
    }
  }

  function ponerFoco(key) { celdas.get(key).input.focus(); }

  function enFoco(key) {
    if (foco && celdas.get(foco)) celdas.get(foco).el.classList.remove('foco');
    foco = key; celdas.get(key).el.classList.add('foco');
    const p = palabras.get(activaId);
    if (p && p.celdas.includes(key)) return;
    const ids = celdas.get(key).data.palabras;
    seleccionar(ids[dirPref] !== undefined ? ids[dirPref] : (ids.H !== undefined ? ids.H : ids.V), false);
  }

  function alternarDir() {
    const ids = celdas.get(foco).data.palabras; if (Object.keys(ids).length < 2) return;
    const p = palabras.get(activaId), otra = p.dir === 'H' ? 'V' : 'H';
    seleccionar(ids[otra], false); dirPref = otra;
  }

  const letraDe = key => { const c = celdas.get(key); return c.bloqueada ? c.data.norm : Crucigrama.base(c.input.value.toLocaleUpperCase('es')); };

  function enInput(key) {
    const c = celdas.get(key);
    if (terminado || c.bloqueada) { c.input.value = c.bloqueada ? c.data.mostrar : ''; return; }
    const v = Crucigrama.base(c.input.value.toLocaleUpperCase('es')).replace(/[^A-ZÑ]/g, '').slice(-1);
    c.input.value = v;
    if (!v) return;
    Sonidos.tecla();
    Object.values(c.data.palabras).forEach(id => verificar(id, 'auto')); // valida sin Enter al completar la palabra
    if (terminado) return;
    const p = palabras.get(activaId);
    if (p.resuelta) { siguientePalabra(1); return; }
    avanzar(key);
  }

  function avanzar(key) {
    const p = palabras.get(activaId), i = p.celdas.indexOf(key);
    for (let j = i + 1; j < p.celdas.length; j++) if (!celdas.get(p.celdas[j]).bloqueada) { ponerFoco(p.celdas[j]); return; }
  }

  function retroceder(key) {
    const c = celdas.get(key);
    if (!c.bloqueada && c.input.value) { c.input.value = ''; return; }
    const p = palabras.get(activaId), i = p.celdas.indexOf(key);
    for (let j = i - 1; j >= 0; j--) { const o = celdas.get(p.celdas[j]); if (!o.bloqueada) { o.input.value = ''; ponerFoco(p.celdas[j]); return; } }
  }

  function mover(key, flecha) {
    const c = celdas.get(key);
    const dr = flecha === 'ArrowDown' ? 1 : flecha === 'ArrowUp' ? -1 : 0, dc = flecha === 'ArrowRight' ? 1 : flecha === 'ArrowLeft' ? -1 : 0;
    let r = c.r + dr, cc = c.c + dc;
    while (r >= 0 && cc >= 0 && r < diseno.filas && cc < diseno.columnas) {
      if (celdas.has(k(r, cc))) { dirPref = dc !== 0 ? 'H' : 'V'; ponerFoco(k(r, cc)); return; }
      r += dr; cc += dc;
    }
  }

  function enTecla(e, key) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.key;
    if (t.startsWith('Arrow')) { e.preventDefault(); mover(key, t); }
    else if (t === 'Backspace' || t === 'Delete') { e.preventDefault(); if (!terminado) retroceder(key); }
    else if (t === 'Enter') { e.preventDefault(); verificar(activaId, true); }
    else if (t === 'Tab') { e.preventDefault(); siguientePalabra(e.shiftKey ? -1 : 1); }
    else if (t === ' ') { e.preventDefault(); alternarDir(); }
    else if (t.length === 1 && celdas.get(key).bloqueada) { e.preventDefault(); avanzar(key); }
  }

  function siguientePalabra(d) {
    const ids = diseno.palabras.map(p => p.id), pend = ids.filter(id => !palabras.get(id).resuelta);
    if (!pend.length) return;
    let i = ids.indexOf(activaId);
    for (let n = 0; n < ids.length; n++) { i = (i + d + ids.length) % ids.length; if (!palabras.get(ids[i]).resuelta) { seleccionar(ids[i], true); return; } }
  }

  // Devuelve true (correcta), false (incorrecta) o null (incompleta).
  function verificar(id, explicito) {
    const p = palabras.get(id); if (!p || terminado) return null;
    if (p.resuelta) return true;
    const letras = p.celdas.map(letraDe);
    if (letras.some(l => !l)) { if (explicito === true) UI.toast('Completa todas las casillas de la palabra para comprobarla.'); return null; }
    if (letras.join('') === p.norm) { correcta(p); return true; }
    if (explicito) incorrecta(p);
    return false;
  }

  function correcta(p) {
    p.resuelta = true; puntos += PUNTOS; resueltas++;
    p.celdas.forEach((key, i) => {
      const c = celdas.get(key); c.bloqueada = true; c.input.value = c.data.mostrar; c.input.readOnly = true;
      c.el.classList.remove('error'); c.el.classList.add('correcta');
      c.el.style.animationDelay = (i * 60) + 'ms'; c.el.classList.remove('exito'); void c.el.offsetWidth; c.el.classList.add('exito');
    });
    Sonidos.correcto(); hud();
    if (resueltas === total) terminar();
  }

  function incorrecta(p) {
    const ahora = performance.now(); if (ahora - ultimoError > 400) Sonidos.error(); ultimoError = ahora;
    p.celdas.forEach(key => {
      const c = celdas.get(key); if (c.bloqueada) return;
      c.el.classList.remove('error'); void c.el.offsetWidth; c.el.classList.add('error');
      setTimeout(() => c.el.classList.remove('error'), 1300);
    });
    UI.toast('Esa respuesta no es correcta. Corrígela e inténtalo de nuevo.', 'error');
  }

  function terminar() {
    terminado = true; clearInterval(timer); timer = null;
    tFinal = Date.now() - tInicio; $('j-tiempo').textContent = fmt(tFinal);
    setTimeout(() => { Sonidos.victoria(); mostrarModal(); }, 700);
  }

  function mostrarModal() {
    const prom = tFinal / 1000 / total;
    $('m-tema').textContent = `${cw.titulo} · ${cw.tema}`;
    $('m-puntos').textContent = puntos;
    $('m-correctas').textContent = `${resueltas}/${total}`;
    $('m-tiempo').textContent = fmt(tFinal);
    $('m-pct').textContent = Math.round(resueltas / total * 100) + '%';
    $('m-mensaje').textContent = prom < 15 ? '¡Velocidad y precisión de campeón! Dominas este tema.'
      : prom < 40 ? '¡Excelente trabajo! Tu conocimiento y tu ritmo son muy buenos.'
      : '¡Muy bien! Tu constancia te llevó a completar el reto. Inténtalo otra vez para mejorar tu tiempo.';
    const cf = $('confeti'); cf.innerHTML = '';
    const col = ['#ffc83d', '#2fbf71', '#ff6b57', '#4cc9f0', '#f72585'];
    for (let i = 0; i < 40; i++) {
      const s = document.createElement('i');
      s.style.cssText = `left:${Math.random() * 100}%;background:${col[i % 5]};animation-delay:${Math.random() * 1.2}s;animation-duration:${2 + Math.random() * 2}s`;
      cf.appendChild(s);
    }
    $('area-juego').inert = true; $('modal').hidden = false;
    $('m-again').focus();
  }

  function salir() { detener(); terminado = true; $('modal').hidden = true; $('area-juego').inert = false; UI.mostrar('inicio'); }

  $('btn-comprobar').addEventListener('click', () => verificar(activaId, true));
  // Ventanas de confirmación (Salir / Reiniciar)
  const abrirModal = (id, btn) => { $('area-juego').inert = true; $(id).hidden = false; $(btn).focus(); };
  const cerrarModal = id => { $(id).hidden = true; $('area-juego').inert = false; if (foco && celdas.get(foco)) ponerFoco(foco); };
  $('btn-salir').addEventListener('click', () => abrirModal('modal-salir', 'salir-no'));
  $('salir-no').addEventListener('click', () => cerrarModal('modal-salir'));
  $('salir-si').addEventListener('click', () => { $('modal-salir').hidden = true; salir(); });
  $('btn-reiniciar').addEventListener('click', () => abrirModal('modal-reiniciar', 'reiniciar-no'));
  $('reiniciar-no').addEventListener('click', () => cerrarModal('modal-reiniciar'));
  $('reiniciar-si').addEventListener('click', () => { $('modal-reiniciar').hidden = true; $('area-juego').inert = false; terminado = true; comenzar(); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('modal-salir').hidden) cerrarModal('modal-salir');
    else if (!$('modal-reiniciar').hidden) cerrarModal('modal-reiniciar');
  });
  $('m-again').addEventListener('click', () => { $('modal').hidden = true; $('area-juego').inert = false; comenzar(); });
  $('m-home').addEventListener('click', salir);

  return { preparar, comenzar };
})();
