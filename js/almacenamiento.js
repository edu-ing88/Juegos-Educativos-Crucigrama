/* almacenamiento.js — Persistencia en localStorage (crucigramas, borrador, preferencias). */
const Almacen = (() => {
  const K = { lista: 'crucigramas_v1', activo: 'crucigrama_activo', borrador: 'crucigrama_borrador',
              sembrado: 'crucigrama_sembrado', sonido: 'crucigrama_sonido' };
  const leer = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } };
  const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const quitar = k => { try { localStorage.removeItem(k); } catch (e) {} };
  const listar = () => { const l = leer(K.lista, []); return Array.isArray(l) ? l : []; };

  return {
    K, leer, escribir, listar,
    obtener: id => listar().find(c => c.id === id) || null,
    guardar(c) {
      const l = listar();
      if (!c.id) c.id = 'cw_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      c.actualizado = Date.now();
      const i = l.findIndex(x => x.id === c.id);
      if (i >= 0) l[i] = c; else l.push(c);
      escribir(K.lista, l);
      return c;
    },
    eliminar(id) {
      escribir(K.lista, listar().filter(c => c.id !== id));
      if (leer(K.activo, null) === id) quitar(K.activo);
    },
    getActivo: () => leer(K.activo, null),
    setActivo: id => escribir(K.activo, id),
    getBorrador: () => leer(K.borrador, null),
    setBorrador: b => escribir(K.borrador, b),
    limpiarBorrador: () => quitar(K.borrador)
  };
})();
