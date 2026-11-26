/* ============================================================
   MC Análisis Técnico™ — la matriz de redundancia · MIGGY CAPITAL

   Esta es la pieza que separa este libro de los demás de su género.

   Todos los manuales de análisis técnico repiten el mismo consejo —«no pongas
   cinco indicadores que digan lo mismo»— y ninguno lo demuestra. Lo dicen y
   pasan a la página siguiente, y el lector se queda sin saber CUÁLES dicen lo
   mismo, que es la única parte útil de la frase.

   Aquí se mide. Cada herramienta corre sobre el mismo banco de series —los
   quince regímenes, siempre las mismas seeds— y se calcula la correlación por
   pares. El resultado no es una opinión editorial: es un número que se puede
   comprobar, que se recalcula solo cuando cambia una implementación, y que se
   imprime en el libro junto a la afirmación que sostiene.

   Con esa matriz, el capítulo de «cómo montar un panel equilibrado» deja de
   ser una recomendación de estilo y pasa a ser una consecuencia de los datos.

   ---------------------------------------------------------------------------
   POR QUÉ PEARSON SOBRE LA LÍNEA, Y NO SOBRE LAS SEÑALES

   Se podría comparar el acierto de dos indicadores sobre operaciones
   simuladas. Sería más vistoso y mucho menos honesto: dependería del sistema
   de entrada, del stop, del objetivo y de mil decisiones que no son del
   indicador. Lo que se quiere responder es más simple y más limpio: cuando uno
   sube, ¿sube el otro? Esa pregunta la contesta la correlación de las líneas,
   y no necesita inventarse ninguna regla de operativa para hacerlo.

   Dos avisos que el libro imprime junto a la tabla, porque una tabla sin ellos
   se lee mal:

     · La correlación mide relación LINEAL. Dos osciladores pueden marcar los
       mismos giros con distinta amplitud y correlacionar menos de lo que se
       parecen. Por eso la tabla se acompaña de la concordancia de signo.
     · Correlacionar poco no convierte a un indicador en útil. Solo dice que es
       distinto. Un indicador puede ser distinto y también inútil.
   ============================================================ */
import type { Line, Series } from './types.ts';
import { REGIMES, bancoDeSeries, type Regime } from './series.ts';
import { OSC_KINDS, OSC_LABEL, osc, type OscKind } from './momentum.ts';
import { MA_KINDS, MA_LABEL, ma, type MAKind } from './ma.ts';

/** Los pares de valores en los que las DOS líneas tienen valor. Comparar
 *  tramos donde una está calentando y la otra no mezcla el periodo de arranque
 *  con la señal, y eso solo puede inflar o hundir la cifra sin motivo. */
function comunes(a: Line, b: Line): { x: number[]; y: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const u = a[i];
    const v = b[i];
    if (u === null || u === undefined || v === null || v === undefined) continue;
    if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
    x.push(u);
    y.push(v);
  }
  return { x, y };
}

/** Correlación de Pearson. Devuelve null si no hay muestra suficiente o si una
 *  de las series es constante — en ese caso la correlación no está definida, y
 *  devolver 0 haría pasar por «independiente» lo que en realidad es «no se
 *  puede saber». */
export function pearson(a: Line, b: Line, minimo = 30): number | null {
  const { x, y } = comunes(a, b);
  const n = x.length;
  if (n < minimo) return null;

  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) { mx += x[i] as number; my += y[i] as number; }
  mx /= n;
  my /= n;

  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = (x[i] as number) - mx;
    const dy = (y[i] as number) - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** Correlación sobre los CAMBIOS, no sobre el nivel.
 *
 *  Necesaria para los indicadores acumulativos —OBV, A/D, VPT—: dos series que
 *  suben sin parar correlacionan casi 1 aunque no tengan nada que ver, solo
 *  porque las dos tienen tendencia. Comparar las variaciones quita ese efecto,
 *  que en estadística es la trampa de la regresión espuria y aquí sería una
 *  cifra falsa impresa en un libro. */
export function pearsonDiff(a: Line, b: Line, minimo = 30): number | null {
  const da = diferencias(a);
  const db = diferencias(b);
  return pearson(da, db, minimo);
}

function diferencias(a: Line): Line {
  const out: Line = new Array<number | null>(a.length).fill(null);
  for (let i = 1; i < a.length; i++) {
    const u = a[i];
    const v = a[i - 1];
    if (u === null || u === undefined || v === null || v === undefined) continue;
    out[i] = u - v;
  }
  return out;
}

/** Con qué frecuencia los dos indicadores se mueven en la MISMA dirección.
 *
 *  Complementa a Pearson y a veces lo contradice, y cuando lo contradice es
 *  cuando se aprende algo: dos osciladores pueden girar a la vez —concordancia
 *  alta— con amplitudes tan distintas que su correlación lineal quede floja.
 *  Para decidir si el segundo panel sobra, la pregunta que importa es si giran
 *  juntos. */
export function concordanciaSigno(a: Line, b: Line): number | null {
  const da = diferencias(a);
  const db = diferencias(b);
  const { x, y } = comunes(da, db);
  if (x.length < 30) return null;
  let iguales = 0;
  let contados = 0;
  for (let i = 0; i < x.length; i++) {
    const u = x[i] as number;
    const v = y[i] as number;
    if (u === 0 || v === 0) continue; // sin movimiento no hay dirección
    contados++;
    if (u > 0 === v > 0) iguales++;
  }
  return contados < 30 ? null : iguales / contados;
}

/* ============================================================
   La medición
   ============================================================ */

export interface ParMedido {
  a: string;
  b: string;
  /** Correlación media sobre todo el banco. */
  r: number | null;
  /** Concordancia de signo media. */
  signo: number | null;
  /** Dónde más y dónde menos se parecen. Es la columna que convierte la tabla
   *  en enseñanza: dos herramientas pueden ser gemelas en tendencia y
   *  divergir en rango, y eso es exactamente lo que hay que saber. */
  porRegimen: { regime: Regime; r: number | null }[];
}

export interface OpcionesMatriz {
  /** Cuántas seeds por régimen. Más seeds, cifra más estable. */
  seedsPorRegimen?: number;
  /** Velas por serie. */
  velas?: number;
  /** Comparar variaciones en vez de niveles. Obligatorio para acumulativos. */
  sobreCambios?: boolean;
}

/** Mide un conjunto de líneas, una por herramienta, sobre el banco entero. */
export function matrizDeRedundancia(
  herramientas: { id: string; calcular: (s: Series) => Line }[],
  opts: OpcionesMatriz = {},
): ParMedido[] {
  const banco = bancoDeSeries(opts.seedsPorRegimen ?? 4, opts.velas ?? 200);
  const corr = opts.sobreCambios ? pearsonDiff : pearson;

  // Se calcula UNA vez por serie y herramienta. Sin esto, una matriz de 18
  // herramientas recalcularía cada indicador diecisiete veces por serie.
  const cache = new Map<string, Line[]>();
  for (const h of herramientas) {
    cache.set(h.id, banco.map((b) => h.calcular(b.bars)));
  }

  const out: ParMedido[] = [];
  for (let i = 0; i < herramientas.length; i++) {
    for (let j = i + 1; j < herramientas.length; j++) {
      const ha = herramientas[i];
      const hb = herramientas[j];
      if (!ha || !hb) continue;
      const la = cache.get(ha.id) ?? [];
      const lb = cache.get(hb.id) ?? [];

      const rs: number[] = [];
      const ss: number[] = [];
      const porRegimen: { regime: Regime; r: number | null }[] = [];

      for (const regime of REGIMES) {
        const idx = banco.map((b, k) => (b.regime === regime ? k : -1)).filter((k) => k >= 0);
        const parciales: number[] = [];
        for (const k of idx) {
          const a = la[k];
          const b = lb[k];
          if (!a || !b) continue;
          const r = corr(a, b);
          if (r !== null) { parciales.push(r); rs.push(r); }
          const sg = concordanciaSigno(a, b);
          if (sg !== null) ss.push(sg);
        }
        porRegimen.push({
          regime,
          r: parciales.length ? parciales.reduce((x, y) => x + y, 0) / parciales.length : null,
        });
      }

      out.push({
        a: ha.id,
        b: hb.id,
        r: rs.length ? rs.reduce((x, y) => x + y, 0) / rs.length : null,
        signo: ss.length ? ss.reduce((x, y) => x + y, 0) / ss.length : null,
        porRegimen,
      });
    }
  }
  return out;
}

/** La matriz de los dieciocho osciladores de la Parte VII. La que se imprime. */
export function matrizOsciladores(opts: OpcionesMatriz = {}): ParMedido[] {
  const herramientas = OSC_KINDS.map((k: OscKind) => ({
    id: k,
    calcular: (s: Series) => osc(s, k),
  }));
  return matrizDeRedundancia(herramientas, opts);
}

/** La matriz de las once medias de la Parte VI, todas del MISMO periodo.
 *
 *  Se mide sobre CAMBIOS y no sobre niveles, y esa decisión es la que hace que
 *  la tabla diga algo. Once medias de veinte velas sobre la misma serie son
 *  once líneas pegadas al precio: comparadas nivel contra nivel, todas
 *  correlacionan por encima de 0,99 y la conclusión sería que da igual cuál
 *  uses, que es justo lo contrario de lo que enseña el capítulo.
 *
 *  Lo que distingue a una media de otra no es dónde está: es CUÁNDO GIRA. Y
 *  eso se pregunta comparando las variaciones — si una sube mientras la otra
 *  baja, no están diciendo lo mismo aunque estén a dos ticks. */
export function matrizMedias(periodo = 20, opts: OpcionesMatriz = {}): ParMedido[] {
  const herramientas = MA_KINDS.map((k: MAKind) => ({
    id: k,
    calcular: (s: Series) => ma(s, k, periodo),
  }));
  return matrizDeRedundancia(herramientas, { ...opts, sobreCambios: true });
}

/** Los pares más parecidos, de más a menos. El material del capítulo
 *  «herramientas que sobran». */
export function masRedundantes(pares: ParMedido[], cuantos = 15): ParMedido[] {
  return [...pares]
    .filter((p) => p.r !== null)
    .sort((a, b) => Math.abs(b.r as number) - Math.abs(a.r as number))
    .slice(0, cuantos);
}

/** Los pares más independientes: los que SÍ merecen compartir panel. */
export function masComplementarios(pares: ParMedido[], cuantos = 15): ParMedido[] {
  return [...pares]
    .filter((p) => p.r !== null)
    .sort((a, b) => Math.abs(a.r as number) - Math.abs(b.r as number))
    .slice(0, cuantos);
}

/** Cómo se lee una correlación en este libro. Los umbrales se declaran UNA vez
 *  para que todos los capítulos usen las mismas palabras ante el mismo número
 *  — si cada capítulo llamara «alta» a lo que le conviene, la tabla dejaría de
 *  significar nada. */
export function veredicto(r: number | null): 'gemelos' | 'muy parecidos' | 'relacionados' | 'distintos' | 'sin datos' {
  if (r === null) return 'sin datos';
  const a = Math.abs(r);
  if (a >= 0.9) return 'gemelos';
  if (a >= 0.75) return 'muy parecidos';
  if (a >= 0.5) return 'relacionados';
  return 'distintos';
}

export const VEREDICTO_LABEL: Record<ReturnType<typeof veredicto>, { es: string; en: string }> = {
  gemelos: { es: 'Gemelos — uno de los dos sobra', en: 'Twins — one of the two is redundant' },
  'muy parecidos': { es: 'Muy parecidos — rara vez discrepan', en: 'Very similar — they seldom disagree' },
  relacionados: { es: 'Relacionados — coinciden a menudo', en: 'Related — they often agree' },
  distintos: { es: 'Distintos — miden cosas diferentes', en: 'Different — they measure different things' },
  'sin datos': { es: 'Sin muestra suficiente', en: 'Not enough sample' },
};

/** Nombre legible de una herramienta, para imprimir la tabla. */
export function etiqueta(id: string, locale: 'es' | 'en' = 'es'): string {
  const o = (OSC_LABEL as Record<string, { es: string; en: string }>)[id];
  return o ? o[locale] : id;
}
