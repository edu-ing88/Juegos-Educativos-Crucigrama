/* crucigrama.js — Validación y generación automática de la cuadrícula (sin DOM). */
const Crucigrama = (() => {
  const MAX = 20;
  const L = 'A-ZÁÉÍÓÚÜÑ';
  // Letras separadas por espacios o guiones (ej.: BUENOS AIRES). En la cuadrícula solo van las letras.
  const RE_VALIDA = new RegExp('^[' + L + ']+(?:[ \\-]+[' + L + ']+)*$');
  const letras = r => r.replace(/[\s-]/g, '');
  const patron = r => r.split(/[\s-]+/).filter(Boolean).map(x => x.length).join(', ');
  const limpiar = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const normalizarRespuesta = s => limpiar(s).normalize('NFC').toLocaleUpperCase('es');
  // Quita tildes pero conserva la Ñ: las letras se comparan sin tilde.
  const base = s => s.replace(/Ñ/g, '\u0001').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0001/g, 'Ñ');

  function validarRespuesta(r) {
    if (!r) return 'La respuesta está vacía.';
    if (!RE_VALIDA.test(r)) return `"${r}" solo puede contener letras (A-Z, tildes y Ñ), espacios y guiones.`;
    const n = letras(r).length;
    if (n < 2) return `"${r}" debe tener al menos 2 letras.`;
    if (n > MAX) return `"${r}" supera el máximo de ${MAX} letras (sin contar espacios).`;
    return null;
  }

  function validar(preguntas) {
    const errores = [], vistos = new Map(), ok = [];
    if (preguntas.length < 2) errores.push('Se necesitan al menos 2 preguntas para formar un crucigrama.');
    preguntas.forEach((p, i) => {
      const n = i + 1, r = normalizarRespuesta(p.respuesta);
      if (!limpiar(p.pregunta)) errores.push(`Pregunta ${n}: la pista está vacía.`);
      const e = validarRespuesta(r);
      if (e) { errores.push(`Pregunta ${n}: ${e}`); return; }
      const b = base(letras(r));
      if (vistos.has(b)) errores.push(`Pregunta ${n}: la respuesta "${r}" está duplicada (pregunta ${vistos.get(b)}).`);
      else { vistos.set(b, n); ok.push({ r, b }); }
    });
    if (!errores.length) {
      ok.forEach(({ r, b }, i) => {
        const otras = ok.filter((_, j) => j !== i).map(o => o.b);
        if (!otras.some(o => [...b].some(ch => o.includes(ch))))
          errores.push(`La respuesta "${r}" no comparte ninguna letra con las demás, así que no puede cruzarse.`);
      });
    }
    return errores;
  }

  const clave = (r, c) => r + ',' + c;

  // Devuelve cuántas intersecciones tendría la palabra en esa posición, o -1 si es inválida.
  function verificar(grid, w, r, c, dir) {
    const dr = dir === 'V' ? 1 : 0, dc = dir === 'H' ? 1 : 0, n = w.length;
    if (grid.has(clave(r - dr, c - dc)) || grid.has(clave(r + dr * n, c + dc * n))) return -1;
    let inter = 0;
    for (let i = 0; i < n; i++) {
      const rr = r + dr * i, cc = c + dc * i, ex = grid.get(clave(rr, cc));
      if (ex) { if (ex.letra !== w[i] || ex.dirs.has(dir)) return -1; inter++; }
      else if (grid.has(clave(rr + dc, cc + dr)) || grid.has(clave(rr - dc, cc - dr))) return -1; // sin palabras pegadas
    }
    return inter;
  }

  function intento(items) {
    const orden = [...items].sort((a, b) => (b.norm.length - a.norm.length) + (Math.random() - 0.5) * 3);
    const grid = new Map(), puestas = [];
    const b = { r0: 0, r1: 0, c0: 0, c1: 0 };
    let primera = true;

    function poner(it, r, c, dir) {
      const n = it.norm.length;
      for (let i = 0; i < n; i++) {
        const rr = r + (dir === 'V' ? i : 0), cc = c + (dir === 'H' ? i : 0), k = clave(rr, cc);
        if (!grid.has(k)) grid.set(k, { letra: it.norm[i], dirs: new Set() });
        grid.get(k).dirs.add(dir);
      }
      const r2 = r + (dir === 'V' ? n - 1 : 0), c2 = c + (dir === 'H' ? n - 1 : 0);
      if (primera) { b.r0 = r; b.r1 = r2; b.c0 = c; b.c1 = c2; primera = false; }
      else { b.r0 = Math.min(b.r0, r); b.r1 = Math.max(b.r1, r2); b.c0 = Math.min(b.c0, c); b.c1 = Math.max(b.c1, c2); }
      puestas.push({ ...it, fila: r, col: c, dir });
    }

    function mejorPosicion(it) {
      let mejor = null;
      const n = it.norm.length;
      for (const pw of puestas) {
        for (let j = 0; j < pw.norm.length; j++) for (let k = 0; k < n; k++) {
          if (pw.norm[j] !== it.norm[k]) continue;
          const dir = pw.dir === 'H' ? 'V' : 'H';
          const r = pw.dir === 'H' ? pw.fila - k : pw.fila + j;
          const c = pw.dir === 'H' ? pw.col + j : pw.col - k;
          const inter = verificar(grid, it.norm, r, c, dir);
          if (inter < 1) continue;
          const r2 = r + (dir === 'V' ? n - 1 : 0), c2 = c + (dir === 'H' ? n - 1 : 0);
          const h = Math.max(b.r1, r2) - Math.min(b.r0, r) + 1, w = Math.max(b.c1, c2) - Math.min(b.c0, c) + 1;
          const punt = inter * 6 - h * w * 0.3 - Math.abs(h - w) * 1.5 + Math.random() * 4;
          if (!mejor || punt > mejor.punt) mejor = { r, c, dir, punt };
        }
      }
      return mejor;
    }

    const p0 = orden.shift();
    poner(p0, 0, 0, 'H');
    let pend = orden;
    for (let pasada = 0; pasada < 3 && pend.length; pasada++) {
      const sig = [];
      for (const it of pend) { const m = mejorPosicion(it); if (m) poner(it, m.r, m.c, m.dir); else sig.push(it); }
      pend = sig;
    }
    const h = b.r1 - b.r0 + 1, w = b.c1 - b.c0 + 1;
    let cruces = 0; grid.forEach(c => { if (c.dirs.size === 2) cruces++; });
    return { puestas, pend, b, h, w, puntaje: puestas.length * 1000 - h * w - Math.abs(h - w) * 2 + cruces * 3 };
  }

  function generar(preguntas, intentos = 150) {
    const errores = validar(preguntas);
    if (errores.length) return { ok: false, mensaje: errores[0], detalle: errores };
    const items = preguntas.map((p, i) => {
      const respuesta = normalizarRespuesta(p.respuesta);
      const lt = letras(respuesta);
      return { id: i, pregunta: limpiar(p.pregunta), respuesta, letras: lt, norm: base(lt) };
    });
    let mejor = null;
    for (let t = 0; t < intentos; t++) {
      const r = intento(items);
      if (!mejor || r.puntaje > mejor.puntaje) mejor = r;
      if (t >= 60 && mejor.pend.length === 0) break;
    }
    if (mejor.pend.length) {
      const lista = mejor.pend.map(p => p.respuesta).join(', ');
      return { ok: false, faltantes: mejor.pend.map(p => p.respuesta),
        mensaje: `No fue posible ubicar: ${lista}. Cambia esas respuestas (o agrega otras) para que compartan letras con el resto.` };
    }
    // Normaliza coordenadas y numera las casillas de inicio (arriba→abajo, izquierda→derecha).
    const palabras = mejor.puestas.map(p => ({ id: p.id, pregunta: p.pregunta, respuesta: p.respuesta, letras: p.letras, norm: p.norm,
      fila: p.fila - mejor.b.r0, col: p.col - mejor.b.c0, dir: p.dir, numero: 0 }));
    const inicios = [...new Set(palabras.map(p => clave(p.fila, p.col)))]
      .map(k => k.split(',').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const num = new Map(inicios.map((s, i) => [clave(s[0], s[1]), i + 1]));
    palabras.forEach(p => { p.numero = num.get(clave(p.fila, p.col)); });
    palabras.sort((a, b) => a.numero - b.numero || (a.dir === 'H' ? -1 : 1));
    return { ok: true, diseno: { filas: mejor.h, columnas: mejor.w, palabras } };
  }

  // Matriz filas×columnas: null (bloqueada) o {norm, mostrar, numero, palabras:{H:id,V:id}}.
  function matriz(d) {
    const m = Array.from({ length: d.filas }, () => Array(d.columnas).fill(null));
    d.palabras.forEach(p => {
      for (let i = 0; i < p.norm.length; i++) {
        const r = p.fila + (p.dir === 'V' ? i : 0), c = p.col + (p.dir === 'H' ? i : 0);
        const cel = m[r][c] || (m[r][c] = { norm: p.norm[i], mostrar: (p.letras || letras(p.respuesta))[i], numero: null, palabras: {} });
        cel.palabras[p.dir] = p.id;
        if (i === 0) cel.numero = p.numero;
      }
    });
    return m;
  }

  function ejemplo() {
    const g = generar([
      { pregunta: 'Ciencia que estudia los seres vivos.', respuesta: 'BIOLOGÍA' },
      { pregunta: 'Proceso mediante el cual las plantas producen su alimento.', respuesta: 'FOTOSÍNTESIS' },
      { pregunta: 'Unidad básica de los seres vivos.', respuesta: 'CÉLULA' },
      { pregunta: 'Conjunto de seres vivos y el medio en que viven.', respuesta: 'ECOSISTEMA' },
      { pregunta: 'Pigmento verde de las plantas.', respuesta: 'CLOROFILA' },
      { pregunta: 'Ser vivo individual.', respuesta: 'ORGANISMO' }
    ]);
    if (!g.ok) return null;
    return { titulo: 'Ciencias naturales (ejemplo)', tema: 'Los seres vivos', instrucciones: '', diseno: g.diseno,
      preguntas: g.diseno.palabras.slice().sort((a, b) => a.id - b.id).map(p => ({ pregunta: p.pregunta, respuesta: p.respuesta })) };
  }

  const claveRespuesta = r => base(letras(normalizarRespuesta(r)));
  return { MAX, limpiar, normalizarRespuesta, base, letras, patron, claveRespuesta, validarRespuesta, validar, generar, matriz, ejemplo };
})();
