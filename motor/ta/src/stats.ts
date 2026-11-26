/* ============================================================
   MC Análisis Técnico™ — estadística de sistemas · MIGGY CAPITAL

   La Parte XIV, y el cierre de la obra.

   Las trece partes anteriores han ido señalando lo mismo con herramientas
   distintas: casi todo lo que el análisis técnico llama patrón, nivel o figura
   lleva dentro un parámetro que no está en el precio. Aquí se demuestra qué
   pasa cuando ese parámetro se elige mirando los datos — que es lo que hace
   todo el mundo, casi siempre sin darse cuenta.

   ---------------------------------------------------------------------------
   POR QUÉ EL BACKTEST DE ESTE MÓDULO ES DELIBERADAMENTE TOSCO

   Una vela sirve cuatro precios y no dice en qué orden ocurrieron. Si en una
   misma vela se tocan el stop y el objetivo, no hay forma de saber cuál se
   tocó antes — y esa ambigüedad es la fuente número uno de backtests
   optimistas.

   Aquí se resuelve del lado PESIMISTA: si los dos caben en la vela, se da por
   perdido. No es una elección conservadora por gusto; es la única que no
   inventa información. Cualquier otra convención produce resultados mejores de
   los que existen, y el capítulo entero va sobre no engañarse.
   ============================================================ */
import type { Series } from './types.ts';
import { at, closes } from './types.ts';

export interface Operacion {
  entrada: number;
  salida: number;
  precioEntrada: number;
  precioSalida: number;
  dir: 1 | -1;
  /** Resultado en múltiplos del riesgo (R). Es la unidad de toda la parte:
   *  hablar en R —y no en dinero— es lo que permite comparar sistemas y lo que
   *  hace que la aritmética del riesgo funcione igual con cualquier cuenta. */
  r: number;
  /** Lo más en contra que fue antes de cerrar, en R. */
  mae: number;
  /** Lo más a favor. */
  mfe: number;
}

export interface Metricas {
  operaciones: number;
  aciertos: number;
  tasaAcierto: number;
  /** R medio por operación. Es LA cifra: si es negativa, nada más importa. */
  esperanza: number;
  /** Ganado entre perdido. */
  profitFactor: number;
  /** Peor caída desde un máximo de la curva, en R. */
  drawdown: number;
  /** R total acumulado. */
  total: number;
}

/* ---------- un sistema mínimo, para tener algo que optimizar ----------
   Cruce de medias con stop y objetivo en múltiplos del ATR. Se elige porque es
   el sistema más enseñado del mundo y porque tiene exactamente tres
   parámetros: suficientes para sobreajustar, pocos para explicarlo. */
export interface Reglas {
  rapida: number;
  lenta: number;
  /** Stop en múltiplos del ATR de 14. */
  stopATR: number;
  /** Objetivo, en múltiplos del stop. */
  objetivoR: number;
}

function sma(v: readonly number[], n: number, i: number): number | null {
  if (i < n - 1) return null;
  let acc = 0;
  for (let j = i - n + 1; j <= i; j++) acc += at(v, j);
  return acc / n;
}

function atrSimple(s: Series, i: number, n = 14): number | null {
  if (i < n) return null;
  let acc = 0;
  for (let j = i - n + 1; j <= i; j++) {
    const b = s[j];
    const p = s[j - 1];
    if (!b || !p) return null;
    acc += Math.max(b.h - b.l, Math.abs(b.h - p.c), Math.abs(b.l - p.c));
  }
  return acc / n;
}

/** Corre las reglas sobre una serie y devuelve las operaciones. */
export function backtest(s: Series, r: Reglas): Operacion[] {
  const c = closes(s);
  const out: Operacion[] = [];
  let abierta: { i: number; precio: number; stop: number; objetivo: number; dir: 1 | -1; riesgo: number } | null = null;
  let mae = 0;
  let mfe = 0;

  for (let i = 1; i < s.length; i++) {
    const b = s[i];
    if (!b) continue;

    if (abierta) {
      const contra = abierta.dir === 1 ? abierta.precio - b.l : b.h - abierta.precio;
      const favor = abierta.dir === 1 ? b.h - abierta.precio : abierta.precio - b.l;
      mae = Math.max(mae, contra / abierta.riesgo);
      mfe = Math.max(mfe, favor / abierta.riesgo);

      const tocaStop = abierta.dir === 1 ? b.l <= abierta.stop : b.h >= abierta.stop;
      const tocaObj = abierta.dir === 1 ? b.h >= abierta.objetivo : b.l <= abierta.objetivo;

      if (tocaStop || tocaObj) {
        /* Los dos en la misma vela: se da por perdido. La vela no dice el
           orden, y suponer el favorable es exactamente cómo un backtest se
           vuelve optimista sin que nadie mienta a propósito. */
        const perdida = tocaStop;
        const precioSalida = perdida ? abierta.stop : abierta.objetivo;
        const rr = perdida ? -1 : r.objetivoR;
        out.push({
          entrada: abierta.i, salida: i,
          precioEntrada: abierta.precio, precioSalida,
          dir: abierta.dir, r: rr, mae, mfe,
        });
        abierta = null;
        mae = 0;
        mfe = 0;
        continue;
      }
    }

    if (abierta) continue;

    const fa = sma(c, r.rapida, i);
    const fp = sma(c, r.rapida, i - 1);
    const la = sma(c, r.lenta, i);
    const lp = sma(c, r.lenta, i - 1);
    const a = atrSimple(s, i);
    if (fa === null || fp === null || la === null || lp === null || a === null || a <= 0) continue;

    const cruzaArriba = fp <= lp && fa > la;
    const cruzaAbajo = fp >= lp && fa < la;
    if (!cruzaArriba && !cruzaAbajo) continue;

    const dir: 1 | -1 = cruzaArriba ? 1 : -1;
    const riesgo = a * r.stopATR;
    abierta = {
      i, precio: b.c, dir, riesgo,
      stop: dir === 1 ? b.c - riesgo : b.c + riesgo,
      objetivo: dir === 1 ? b.c + riesgo * r.objetivoR : b.c - riesgo * r.objetivoR,
    };
    mae = 0;
    mfe = 0;
  }
  return out;
}

/** Las métricas de un conjunto de operaciones. */
export function metricas(ops: Operacion[]): Metricas {
  const n = ops.length;
  if (!n) {
    return { operaciones: 0, aciertos: 0, tasaAcierto: 0, esperanza: 0, profitFactor: 0, drawdown: 0, total: 0 };
  }
  let ganado = 0;
  let perdido = 0;
  let aciertos = 0;
  let acumulado = 0;
  let pico = 0;
  let drawdown = 0;

  for (const o of ops) {
    if (o.r > 0) { ganado += o.r; aciertos++; } else perdido += -o.r;
    acumulado += o.r;
    pico = Math.max(pico, acumulado);
    drawdown = Math.max(drawdown, pico - acumulado);
  }
  return {
    operaciones: n,
    aciertos,
    tasaAcierto: aciertos / n,
    esperanza: acumulado / n,
    // Sin pérdidas el cociente se indetermina. Se devuelve el ganado, que es
    // informativo, en vez de un infinito que rompe cualquier tabla.
    profitFactor: perdido > 0 ? ganado / perdido : ganado,
    drawdown,
    total: acumulado,
  };
}

/* ============================================================
   La demostración del sobreajuste
   ============================================================ */

export interface ResultadoOptimizacion {
  mejor: Reglas;
  /** Lo que el mejor juego de parámetros dio en la muestra donde se eligió. */
  dentro: Metricas;
  /** Lo que dio en datos que no vio al elegirse. */
  fuera: Metricas;
  /** Cuántas combinaciones se probaron. */
  combinaciones: number;
  /** La media de TODAS las combinaciones fuera de muestra. Es la referencia
   *  honesta: si el mejor no la supera, la optimización no encontró nada. */
  mediaFuera: number;
}

/**
 * Optimiza sobre una mitad del banco y mide en la otra.
 *
 * Es la demostración que cierra el libro. Elegir los parámetros que mejor
 * funcionaron en unos datos y publicar ESE resultado es lo que hace la mayoría
 * de los sistemas que se venden, y la diferencia entre las dos columnas es
 * exactamente lo que el comprador no ve.
 */
export function optimizar(
  dentroDe: Series[],
  fueraDe: Series[],
  rejilla: Reglas[],
  /* Operaciones mínimas para que una combinación pueda ganar la optimización.
   *
   * Sin este filtro, el optimizador elige sistemáticamente la combinación con
   * MENOS operaciones. Es aritmética, no mala suerte: con diez operaciones,
   * tres aciertos seguidos dan una esperanza magnífica, y entre cuatrocientas
   * combinaciones siempre hay alguna a la que le tocan esos tres. La que gana
   * no es la mejor: es la que menos muestra tiene, porque es donde la suerte
   * pesa más.
   *
   * Se deja en cero por defecto A PROPÓSITO, para que el capítulo pueda
   * enseñar las dos columnas: lo que sale sin filtro y lo que sale con él. */
  minOperaciones = 0,
): ResultadoOptimizacion {
  const evalua = (series: Series[], r: Reglas): Metricas => {
    const todas: Operacion[] = [];
    for (const s of series) todas.push(...backtest(s, r));
    return metricas(todas);
  };

  const admisible = (m: Metricas) => m.operaciones >= minOperaciones;
  let mejor: Reglas | null = null;
  let mejorM: Metricas | null = null;
  for (const r of rejilla) {
    const m = evalua(dentroDe, r);
    if (!admisible(m)) continue;
    if (!mejorM || m.esperanza > mejorM.esperanza) { mejor = r; mejorM = m; }
  }
  if (!mejor || !mejorM) {
    // Ninguna combinación llega al mínimo: se informa con la primera y cero
    // operaciones, en vez de fingir un resultado.
    mejor = rejilla[0] as Reglas;
    mejorM = evalua(dentroDe, mejor);
  }

  let suma = 0;
  for (const r of rejilla) suma += evalua(fueraDe, r).esperanza;

  return {
    mejor,
    dentro: mejorM,
    fuera: evalua(fueraDe, mejor),
    combinaciones: rejilla.length,
    mediaFuera: suma / rejilla.length,
  };
}

/** Una rejilla de parámetros a partir de listas de valores. */
export function rejilla(rapidas: number[], lentas: number[], stops: number[], objetivos: number[]): Reglas[] {
  const out: Reglas[] = [];
  for (const rapida of rapidas) {
    for (const lenta of lentas) {
      if (lenta <= rapida) continue;
      for (const stopATR of stops) {
        for (const objetivoR of objetivos) out.push({ rapida, lenta, stopATR, objetivoR });
      }
    }
  }
  return out;
}

/* ============================================================
   Monte Carlo
   ============================================================ */

/**
 * Baraja el ORDEN de las operaciones y mide el peor drawdown de cada baraja.
 *
 * El resultado total no cambia —las mismas operaciones suman lo mismo— pero el
 * drawdown sí, y mucho. Eso enseña algo que ninguna curva de resultados
 * enseña: **el drawdown que viste es uno de los posibles, no el que te
 * espera**. Con las mismas operaciones en otro orden, la racha mala se
 * concentra y hunde una cuenta que la histórica aguantaba.
 */
export function monteCarlo(ops: Operacion[], barajas: number, seed = 7): { p50: number; p95: number; peor: number } {
  let a = seed >>> 0;
  const rnd = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const dds: number[] = [];
  const base = ops.map((o) => o.r);
  for (let k = 0; k < barajas; k++) {
    const v = [...base];
    for (let i = v.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = v[i] as number;
      v[i] = v[j] as number;
      v[j] = t;
    }
    let acc = 0;
    let pico = 0;
    let dd = 0;
    for (const r of v) {
      acc += r;
      pico = Math.max(pico, acc);
      dd = Math.max(dd, pico - acc);
    }
    dds.push(dd);
  }
  dds.sort((x, y) => x - y);
  const pct = (p: number) => dds[Math.min(dds.length - 1, Math.floor(dds.length * p))] as number;
  return { p50: pct(0.5), p95: pct(0.95), peor: dds[dds.length - 1] as number };
}

/** Riesgo de ruina aproximado por simulación.
 *
 *  La aritmética que cierra la parte: con una esperanza positiva se puede
 *  quebrar igual si el tamaño de posición es grande, porque la ruina es
 *  absorbente y la recuperación es asimétrica. */
export function riesgoDeRuina(ops: Operacion[], riesgoPorOperacion: number, barajas = 2000, seed = 11): number {
  let a = seed >>> 0;
  const rnd = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  if (!ops.length) return 0;
  let ruinas = 0;
  for (let k = 0; k < barajas; k++) {
    let capital = 1;
    for (let i = 0; i < ops.length; i++) {
      const o = ops[Math.floor(rnd() * ops.length)] as Operacion;
      capital *= 1 + o.r * riesgoPorOperacion;
      if (capital <= 0.2) { ruinas++; break; }
    }
  }
  return ruinas / barajas;
}
