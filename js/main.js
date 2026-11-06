/* main.js — Navegación entre pantallas, inicio, selección de crucigrama y utilidades de interfaz. */
// Altura real visible (barras del navegador y teclado móvil incluidos) -> --app-h
(() => {
  const root = document.documentElement, vv = window.visualViewport;
  const fijar = () => {
    const h = Math.round(vv ? vv.height : window.innerHeight);
    root.style.setProperty('--app-h', h + 'px');
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
  };
  fijar();
  window.addEventListener('resize', fijar);
  window.addEventListener('orientationchange', () => setTimeout(fijar, 150));
  if (vv) { vv.addEventListener('resize', fijar); vv.addEventListener('scroll', fijar); }
})();

const UI = (() => {
  let tt;
  return {
    mostrar(id) {
      document.querySelectorAll('.pantalla').forEach(p => p.classList.toggle('activa', p.id === 'pantalla-' + id));
      window.scrollTo(0, 0);
    },
    toast(msg, tipo) {
      const t = document.getElementById('toast');
      t.textContent = msg; t.className = 'toast visible ' + (tipo || '');
      clearTimeout(tt); tt = setTimeout(() => t.classList.remove('visible'), 3000);
    }
  };
})();

(() => {
  const $ = id => document.getElementById(id);

  // Título animado y fondo de letras flotantes
  $('titulo').innerHTML = [...'CRUCIGRAMA'].map((l, i) => `<span style="--i:${i}">${l}</span>`).join('');
  $('titulo').setAttribute('aria-label', 'CRUCIGRAMA');
  const fondo = $('fondo'), abc = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('span');
    s.textContent = abc[Math.floor(Math.random() * abc.length)];
    s.style.cssText = `left:${Math.random() * 100}%;font-size:${28 + Math.random() * 60}px;animation-duration:${14 + Math.random() * 18}s;animation-delay:${-Math.random() * 30}s`;
    fondo.appendChild(s);
  }

  // Ejemplo inicial (solo la primera vez, si no hay crucigramas)
  if (!Almacen.leer(Almacen.K.sembrado, false) && Almacen.listar().length === 0) {
    const ej = Crucigrama.ejemplo(); if (ej) Almacen.guardar(ej);
  }
  Almacen.escribir(Almacen.K.sembrado, true);

  // Botones de sonido
  const pintarSonido = () => document.querySelectorAll('.btn-sonido').forEach(b => {
    const on = Sonidos.activo();
    if (b.closest('.hud-botones')) { b.textContent = on ? '🔊' : '🔇'; b.setAttribute('aria-label', on ? 'Sonido activado' : 'Sonido desactivado'); }
    else b.textContent = on ? '🔊 Sonido activado' : '🔇 Sonido desactivado';
  });
  document.querySelectorAll('.btn-sonido').forEach(b => b.addEventListener('click', () => { Sonidos.alternar(); pintarSonido(); }));
  pintarSonido();

  document.querySelectorAll('[data-ir]').forEach(b => b.addEventListener('click', () => UI.mostrar(b.dataset.ir)));

  function elegir(id) {
    const c = Almacen.obtener(id);
    if (!c) return UI.toast('No se encontró el crucigrama.', 'error');
    if (!c.diseno) {
      const g = Crucigrama.generar(c.preguntas);
      if (!g.ok) return UI.toast(g.mensaje, 'error');
      c.diseno = g.diseno; Almacen.guardar(c);
    }
    Almacen.setActivo(c.id);
    Juego.preparar(c);
    UI.mostrar('intro');
  }

  function iniciar() {
    Sonidos.desbloquear();
    const lista = Almacen.listar();
    if (!lista.length) return UI.toast('Aún no hay crucigramas. Crea uno en "Configurar crucigrama".', 'error');
    if (lista.length === 1) return elegir(lista[0].id);
    const cont = $('lista-seleccion'), activo = Almacen.getActivo();
    cont.innerHTML = '';
    lista.forEach(c => {
      const b = document.createElement('button');
      b.className = 'item-sel' + (c.id === activo ? ' destacado' : '');
      b.innerHTML = '<strong></strong><span></span><em></em>';
      b.children[0].textContent = c.titulo;
      b.children[1].textContent = c.tema;
      b.children[2].textContent = c.preguntas.length + ' preguntas';
      b.addEventListener('click', () => elegir(c.id));
      cont.appendChild(b);
    });
    UI.mostrar('seleccion');
  }

  $('btn-iniciar').addEventListener('click', iniciar);
  $('btn-comenzar').addEventListener('click', () => Juego.comenzar());

  const jugar = new URLSearchParams(location.search).get('jugar');
  if (jugar) { history.replaceState(null, '', location.pathname); elegir(jugar); }
})();
