/* sonidos.js — Efectos sintetizados con Web Audio API (no requiere archivos de audio). */
const Sonidos = (() => {
  let ctx = null, ultimo = 0;
  let activo = Almacen.leer(Almacen.K.sonido, true);

  function ctxListo() {
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function nota(freq, inicio, dur, tipo, vol) {
    const c = ctxListo(); if (!c) return;
    const t = c.currentTime + inicio, o = c.createOscillator(), g = c.createGain();
    o.type = tipo || 'sine'; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.03);
  }
  const si = fn => (...a) => { if (activo) fn(...a); };

  return {
    activo: () => activo,
    alternar() { activo = !activo; Almacen.escribir(Almacen.K.sonido, activo); if (activo) this.tecla(true); return activo; },
    desbloquear: ctxListo,
    tecla: (forzar) => { if (!activo) return; const n = performance.now(); if (!forzar && n - ultimo < 45) return; ultimo = n; nota(480 + Math.random() * 140, 0, 0.05, 'square', 0.045); },
    cuenta: si(alto => nota(alto ? 880 : 440, 0, 0.18, 'triangle', 0.2)),
    correcto: si(() => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => nota(f, i * 0.08, 0.28, 'triangle', 0.15))),
    error: si(() => { nota(240, 0, 0.18, 'sawtooth', 0.1); nota(170, 0.17, 0.3, 'sawtooth', 0.1); }),
    victoria: si(() => {
      [523.25, 659.25, 783.99, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => nota(f, i * 0.13, 0.35, 'triangle', 0.17));
      nota(1568, 0.95, 0.7, 'sine', 0.12);
    })
  };
})();
