// Matriz de redundancia de los 18 osciladores (figura 7.3.1) con la función del motor matrizOsciladores, más un
// diagnóstico: cuántas de las 60 series dan una correlación válida en cada pareja (la función descarta la serie si
// hay menos de 30 valores comunes no nulos o si una de las dos líneas es constante).
import { matrizOsciladores, bancoDeSeries, OSC_KINDS, OSC_LABEL, osc, pearson, concordanciaSigno } from './ta/src/index.ts';
const m = matrizOsciladores({ seedsPorRegimen: 4, velas: 200 });
const banco = bancoDeSeries(4, 200);
const lineas = Object.fromEntries(OSC_KINDS.map((k) => [k, banco.map((b) => osc(b.bars, k))]));
const primerValor = Object.fromEntries(OSC_KINDS.map((k) => [k, Math.max(...lineas[k].map((l) => l.findIndex((v) => v !== null && v !== undefined && Number.isFinite(v))))]));
const pares = m.map((p) => {
  let validas = 0, validasSigno = 0;
  for (let i = 0; i < banco.length; i++) {
    if (pearson(lineas[p.a][i], lineas[p.b][i]) !== null) validas++;
    if (concordanciaSigno(lineas[p.a][i], lineas[p.b][i]) !== null) validasSigno++;
  }
  return { a: p.a, b: p.b, r: p.r, signo: p.signo, series_validas_r: validas, series_validas_signo: validasSigno, porRegimen: p.porRegimen };
});
process.stdout.write(JSON.stringify({ osciladores: OSC_KINDS.map((k) => ({ id: k, es: OSC_LABEL[k].es, primera_vela_con_valor_max: primerValor[k] })), series: banco.length, pares }));
