/* configuracion.js — Panel del docente: datos, preguntas, validación, vista previa y guardado. */
(() => {
  const $ = id => document.getElementById(id);
  const vacio = () => ({ id: null, titulo: '', tema: '', instrucciones: '', preguntas: [] });
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let estado = Almacen.getBorrador() || vacio(), editando = -1, ultimo = null;
  if (!Array.isArray(estado.preguntas)) estado = vacio();

  const persistir = () => Almacen.setBorrador(estado);
  function aviso(msg, tipo, lista) {
    const m = $('mensajes'); m.className = 'mensajes ' + (tipo || 'ok');
    m.innerHTML = `<strong>${esc(msg)}</strong>` + (lista && lista.length > 1 ? `<ul>${lista.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
    m.hidden = false; window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const ocultarAviso = () => { $('mensajes').hidden = true; };

  function leerDatos() {
    estado.titulo = Crucigrama.limpiar($('f-titulo').value);
    estado.tema = Crucigrama.limpiar($('f-tema').value);
    estado.instrucciones = $('f-instr').value.trim();
    persistir();
  }

  function pintarTabla() {
    const tb = $('tabla');
    if (!estado.preguntas.length) { tb.innerHTML = '<tr><td colspan="4" class="vacio">Aún no hay preguntas. Agrega la primera arriba.</td></tr>'; return; }
    tb.innerHTML = estado.preguntas.map((p, i) => `<tr class="${i === editando ? 'editando' : ''}"><td class="n">${i + 1}</td><td>${esc(p.pregunta)}</td><td class="r">${esc(p.respuesta)}</td>
      <td><button class="btn-tabla b-ed" data-ed="${i}">Editar</button><button class="btn-tabla b-el" data-el="${i}">Eliminar</button></td></tr>`).join('');
  }

  function pintarGuardados() {
    const l = Almacen.listar(), cont = $('guardados');
    if (!l.length) { cont.innerHTML = '<p class="vacio">Todavía no has guardado ningún crucigrama.</p>'; return; }
    cont.innerHTML = l.map(c => `<div class="guardado ${c.id === estado.id ? 'actual' : ''}"><strong>${esc(c.titulo)}</strong><span>${esc(c.tema)} · ${c.preguntas.length} preguntas</span><div>
      <button class="btn-tabla b-ju" data-ju="${c.id}">Jugar</button><button class="btn-tabla b-ed" data-edc="${c.id}">Editar</button><button class="btn-tabla b-el" data-elc="${c.id}">Eliminar</button></div></div>`).join('');
  }

  function pintarDatos() { $('f-titulo').value = estado.titulo || ''; $('f-tema').value = estado.tema || ''; $('f-instr').value = estado.instrucciones || ''; }

  function errorespregunta(p, r) {
    const e = [];
    if (!p) e.push('La pregunta o pista no puede estar vacía.');
    const er = Crucigrama.validarRespuesta(r); if (er) e.push(er);
    else { const b = Crucigrama.claveRespuesta(r);
      estado.preguntas.forEach((q, i) => { if (i !== editando && Crucigrama.claveRespuesta(q.respuesta) === b) e.push(`La respuesta "${r}" ya existe (pregunta ${i + 1}).`); }); }
    return e;
  }

  function agregar() {
    const p = Crucigrama.limpiar($('f-pregunta').value), r = Crucigrama.normalizarRespuesta($('f-respuesta').value);
    const e = errorespregunta(p, r);
    if (e.length) return aviso(e.length > 1 ? 'Revisa los datos de la pregunta:' : e[0], 'error', e);
    ocultarAviso();
    if (editando >= 0) estado.preguntas[editando] = { pregunta: p, respuesta: r }; else estado.preguntas.push({ pregunta: p, respuesta: r });
    cancelarEdicion(); persistir(); pintarTabla(); $('f-pregunta').focus();
  }

  function cancelarEdicion() {
    editando = -1; $('f-pregunta').value = ''; $('f-respuesta').value = '';
    $('btn-agregar').textContent = 'AGREGAR PREGUNTA'; $('btn-cancelar').hidden = true; pintarTabla();
  }

  function disenoActual(nuevo) {
    const firma = JSON.stringify(estado.preguntas);
    if (!nuevo && ultimo && ultimo.firma === firma) return { ok: true, diseno: ultimo.diseno };
    const g = Crucigrama.generar(estado.preguntas);
    if (g.ok) ultimo = { firma, diseno: g.diseno };
    return g;
  }

  function guardar() {
    leerDatos();
    const e = [];
    if (!estado.titulo) e.push('Escribe el título del crucigrama.');
    if (!estado.tema) e.push('Escribe el tema o contenido de aprendizaje.');
    e.push(...Crucigrama.validar(estado.preguntas));
    if (e.length) return aviso('No se pudo guardar:', 'error', e);
    const g = disenoActual(false);
    if (!g.ok) return aviso(g.mensaje, 'error');
    const reg = Almacen.guardar({ id: estado.id, titulo: estado.titulo, tema: estado.tema, instrucciones: estado.instrucciones,
      preguntas: estado.preguntas.map(p => ({ pregunta: p.pregunta, respuesta: p.respuesta })), diseno: g.diseno });
    estado.id = reg.id; persistir(); pintarGuardados();
    aviso(`Crucigrama "${reg.titulo}" guardado (${g.diseno.palabras.length} palabras en una cuadrícula de ${g.diseno.filas}×${g.diseno.columnas}).`, 'ok');
  }

  function dibujar(d) {
    const m = Crucigrama.matriz(d), cel = Math.max(26, Math.min(40, Math.floor(520 / d.columnas)));
    let cruces = 0, h = `<div class="vp-gridwrap"><div class="vp-grid" style="grid-template-columns:repeat(${d.columnas},${cel}px)">`;
    m.forEach(f => f.forEach(c => {
      if (!c) { h += `<div class="vp-b" style="width:${cel}px;height:${cel}px"></div>`; return; }
      if (Object.keys(c.palabras).length === 2) cruces++;
      h += `<div class="vp-c" style="width:${cel}px;height:${cel}px">${c.numero ? `<i>${c.numero}</i>` : ''}${esc(c.mostrar)}</div>`;
    }));
    h += '</div></div><div class="vp-pistas">';
    [['H', 'Horizontales'], ['V', 'Verticales']].forEach(([dir, t]) => {
      h += `<h3>${t}</h3><ol>` + d.palabras.filter(p => p.dir === dir).map(p => `<li><b>${p.numero}.</b>${esc(p.pregunta)} <em>${esc(p.respuesta)}</em></li>`).join('') + '</ol>';
    });
    $('vp-cont').innerHTML = h + '</div>';
    $('vp-info').textContent = `Cuadrícula ${d.filas}×${d.columnas} · ${d.palabras.length} palabras · ${cruces} intersecciones`;
  }

  function vistaPrevia(nuevo) {
    leerDatos();
    const g = disenoActual(nuevo === true);
    if (!g.ok) return aviso(g.mensaje, 'error', g.detalle);
    ocultarAviso(); dibujar(g.diseno); $('vp').hidden = false;
  }

  function cargar(id) {
    const c = Almacen.obtener(id); if (!c) return;
    estado = { id: c.id, titulo: c.titulo, tema: c.tema, instrucciones: c.instrucciones || '', preguntas: c.preguntas.map(p => ({ ...p })) };
    ultimo = c.diseno ? { firma: JSON.stringify(estado.preguntas), diseno: c.diseno } : null;
    editando = -1; persistir(); pintarDatos(); cancelarEdicion(); pintarGuardados(); ocultarAviso(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Eventos
  ['f-titulo', 'f-tema', 'f-instr'].forEach(id => $(id).addEventListener('input', leerDatos));
  $('f-respuesta').addEventListener('input', e => { const el = e.target, s = el.selectionStart; el.value = el.value.toLocaleUpperCase('es').replace(/\s+/g, ' '); try { el.setSelectionRange(s, s); } catch (x) {} });
  $('f-respuesta').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } });
  $('btn-agregar').addEventListener('click', agregar);
  $('btn-cancelar').addEventListener('click', cancelarEdicion);
  $('btn-guardar').addEventListener('click', guardar);
  $('btn-vista').addEventListener('click', () => vistaPrevia(false));
  $('vp-otra').addEventListener('click', () => vistaPrevia(true));
  $('vp-cerrar').addEventListener('click', () => { $('vp').hidden = true; });
  $('btn-nuevo').addEventListener('click', () => {
    if ((estado.preguntas.length || estado.titulo) && !confirm('¿Empezar un crucigrama nuevo? Lo que no hayas guardado se perderá.')) return;
    estado = vacio(); ultimo = null; Almacen.limpiarBorrador(); pintarDatos(); cancelarEdicion(); pintarGuardados(); ocultarAviso();
  });

  $('tabla').addEventListener('click', e => {
    const ed = e.target.dataset.ed, el = e.target.dataset.el;
    if (ed !== undefined) {
      editando = +ed; const p = estado.preguntas[editando];
      $('f-pregunta').value = p.pregunta; $('f-respuesta').value = p.respuesta;
      $('btn-agregar').textContent = 'ACTUALIZAR PREGUNTA'; $('btn-cancelar').hidden = false; pintarTabla(); $('f-pregunta').focus();
    } else if (el !== undefined) {
      if (!confirm(`¿Eliminar la pregunta ${+el + 1}?`)) return;
      estado.preguntas.splice(+el, 1); if (editando >= 0) cancelarEdicion(); persistir(); pintarTabla();
    }
  });

  $('guardados').addEventListener('click', e => {
    const d = e.target.dataset;
    if (d.ju) { Almacen.setActivo(d.ju); location.href = 'index.html?jugar=' + encodeURIComponent(d.ju); }
    else if (d.edc) cargar(d.edc);
    else if (d.elc) {
      const c = Almacen.obtener(d.elc);
      if (!c || !confirm(`¿Eliminar el crucigrama "${c.titulo}"?`)) return;
      Almacen.eliminar(d.elc);
      if (estado.id === d.elc) { estado.id = null; persistir(); }
      pintarGuardados();
    }
  });

  pintarDatos(); pintarTabla(); pintarGuardados();
})();
