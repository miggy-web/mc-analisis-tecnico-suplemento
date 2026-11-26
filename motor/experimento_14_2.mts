// Experimento de sobreajuste de 14.2: registro COMPLETO de las 464 variantes, con las funciones del motor
// (rejilla, backtest, metricas, optimizar) sin modificar.
// Banco: bancoDeSeries(4, 250) = 60 series × 250 velas. Dentro de muestra = series de índice par (0, 2, …);
// fuera de muestra = series de índice impar. Por construcción del banco (régimen a régimen, k = 0..3), cada régimen
// aporta las semillas k = 0 y 2 a «dentro» y k = 1 y 3 a «fuera».
// Diagnóstico de ejecución: una réplica instrumentada de backtest (misma lógica) cuenta, por variante, las velas con
// stop y objetivo a la vez, las salidas con hueco de apertura más allá del nivel y las posiciones abiertas al final de
// cada serie. Se exige que sus operaciones coincidan exactamente con las de backtest.
// Costes (sensibilidad que el libro no imprime): c pb ida y vuelta sobre el precio de entrada, en R = (c/1e4)·entrada/riesgo.
import { bancoDeSeries, rejilla, backtest, metricas, optimizar } from './ta/src/index.ts';
import type { Series, Reglas, Operacion } from './ta/src/index.ts';

const banco = bancoDeSeries(4, 250);
const dentro = banco.filter((_, i) => i % 2 === 0).map((b) => b.bars);
const fuera = banco.filter((_, i) => i % 2 === 1).map((b) => b.bars);
const R = { rapidas: [5, 8, 10, 12, 15, 20], lentas: [20, 30, 40, 50, 60], stops: [1, 1.5, 2, 3], objetivos: [1, 1.5, 2, 3] };
const g = rejilla(R.rapidas, R.lentas, R.stops, R.objetivos);
const brutas = R.rapidas.length * R.lentas.length * R.stops.length * R.objetivos.length;

function sma(v: number[], n: number, i: number): number | null {
  if (i < n - 1) return null; let a = 0; for (let j = i - n + 1; j <= i; j++) a += v[j]; return a / n;
}
function atrSimple(s: Series, i: number, n = 14): number | null {
  if (i < n) return null; let a = 0;
  for (let j = i - n + 1; j <= i; j++) { const b = s[j], p = s[j - 1]; if (!b || !p) return null; a += Math.max(b.h - b.l, Math.abs(b.h - p.c), Math.abs(b.l - p.c)); }
  return a / n;
}
// Réplica instrumentada de stats.ts::backtest (misma lógica, línea a línea) para contar casos de ejecución.
function diagnostico(s: Series, r: Reglas) {
  const c = s.map((b) => b.c); let ab: any = null; const ops: any[] = [];
  let ambos = 0, huecoStop = 0, huecoObj = 0, abiertaFinal = 0, primeraEntrada: number | null = null;
  for (let i = 1; i < s.length; i++) {
    const b = s[i];
    if (ab) {
      const tS = ab.dir === 1 ? b.l <= ab.stop : b.h >= ab.stop;
      const tO = ab.dir === 1 ? b.h >= ab.obj : b.l <= ab.obj;
      if (tS || tO) {
        if (tS && tO) ambos++;
        if (tS && (ab.dir === 1 ? b.o < ab.stop : b.o > ab.stop)) huecoStop++;
        if (!tS && (ab.dir === 1 ? b.o > ab.obj : b.o < ab.obj)) huecoObj++;
        ops.push({ entrada: ab.i, salida: i, r: tS ? -1 : r.objetivoR, precio: ab.precio, riesgo: ab.riesgo });
        ab = null; continue;
      }
    }
    if (ab) continue;
    const fa = sma(c, r.rapida, i), fp = sma(c, r.rapida, i - 1), la = sma(c, r.lenta, i), lp = sma(c, r.lenta, i - 1), a = atrSimple(s, i);
    if (fa === null || fp === null || la === null || lp === null || a === null || a <= 0) continue;
    const up = fp <= lp && fa > la, dn = fp >= lp && fa < la;
    if (!up && !dn) continue;
    const dir = up ? 1 : -1, riesgo = a * r.stopATR;
    if (primeraEntrada === null) primeraEntrada = i;
    ab = { i, precio: b.c, dir, riesgo, stop: dir === 1 ? b.c - riesgo : b.c + riesgo, obj: dir === 1 ? b.c + riesgo * r.objetivoR : b.c - riesgo * r.objetivoR };
  }
  if (ab) abiertaFinal++;
  return { ops, ambos, huecoStop, huecoObj, abiertaFinal, primeraEntrada };
}
function evalua(series: Series[], r: Reglas) {
  const todas: Operacion[] = []; const d = { ambos: 0, huecoStop: 0, huecoObj: 0, abiertaFinal: 0, primeraEntradaMin: Infinity as number };
  const costeR: number[] = [];
  for (const s of series) {
    const ops = backtest(s, r); todas.push(...ops);
    const x = diagnostico(s, r);
    if (x.ops.length !== ops.length || x.ops.some((o, k) => o.entrada !== ops[k].entrada || o.salida !== ops[k].salida || o.r !== ops[k].r)) throw new Error('la réplica instrumentada no coincide con backtest');
    d.ambos += x.ambos; d.huecoStop += x.huecoStop; d.huecoObj += x.huecoObj; d.abiertaFinal += x.abiertaFinal;
    if (x.primeraEntrada !== null) d.primeraEntradaMin = Math.min(d.primeraEntradaMin, x.primeraEntrada);
    for (const o of x.ops) costeR.push(o.precio / o.riesgo);
  }
  const m = metricas(todas);
  const neto = (bps: number) => todas.length ? todas.reduce((a, o, k) => a + o.r - (bps / 1e4) * costeR[k], 0) / todas.length : 0;
  return { m, d: { ...d, primeraEntradaMin: Number.isFinite(d.primeraEntradaMin) ? d.primeraEntradaMin : null }, neto5: neto(5), neto10: neto(10) };
}
const registro = g.map((r, idx) => { const a = evalua(dentro, r), b = evalua(fuera, r); return { idx, ...r, dentro: a, fuera: b }; });
const seleccion: any = {};
for (const min of [0, 30, 100]) {
  const o = optimizar(dentro, fuera, g, min);
  // selección propia sobre el registro, para comprobar que coincide con optimizar (primera mejor en orden de rejilla)
  let best: any = null;
  for (const v of registro) if (v.dentro.m.operaciones >= min && (!best || v.dentro.m.esperanza > best.dentro.m.esperanza)) best = v;
  if (!best || best.rapida !== o.mejor.rapida || best.lenta !== o.mejor.lenta || best.stopATR !== o.mejor.stopATR || best.objetivoR !== o.mejor.objetivoR) throw new Error('selección distinta de optimizar');
  const percentil = 100 * registro.filter((v) => v.fuera.m.esperanza <= best.fuera.m.esperanza).length / registro.length;
  seleccion[`bruto_min${min}`] = { min, mejor: o.mejor, idx: best.idx, dentro: o.dentro, fuera: o.fuera, combinaciones: o.combinaciones, mediaFuera: o.mediaFuera, percentil_fuera_entre_464: percentil };
  for (const bps of [5, 10]) {
    const k = bps === 5 ? 'neto5' : 'neto10';
    let bb: any = null;
    for (const v of registro) if (v.dentro.m.operaciones >= min && (!bb || v.dentro[k] > bb.dentro[k])) bb = v;
    const media = registro.reduce((a, v) => a + v.fuera[k], 0) / registro.length;
    seleccion[`coste${bps}pb_min${min}`] = { min, coste_bps_ida_vuelta: bps, mejor: { rapida: bb.rapida, lenta: bb.lenta, stopATR: bb.stopATR, objetivoR: bb.objetivoR }, idx: bb.idx,
      dentro_R: bb.dentro[k], dentro_ops: bb.dentro.m.operaciones, fuera_R: bb.fuera[k], fuera_ops: bb.fuera.m.operaciones, mediaFuera: media };
  }
}
process.stdout.write(JSON.stringify({ banco: { series: banco.length, velas_por_serie: 250, dentro: dentro.length, fuera: fuera.length,
  semillas_dentro: banco.filter((_, i) => i % 2 === 0).map((b) => b.seed), semillas_fuera: banco.filter((_, i) => i % 2 === 1).map((b) => b.seed) },
  rejilla: R, combinaciones_brutas: brutas, combinaciones_validas: g.length, registro, seleccion }));
