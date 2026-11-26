/* ============================================================
   MC Análisis Técnico™ — volumen, VWAP y perfil · MIGGY CAPITAL

   La Parte XI. Es la parte que separa un libro de indicadores de un libro de
   análisis, porque el volumen es el único dato del gráfico que no se deriva
   del precio: dice cuánta gente participó, y el precio solo dice a cuánto se
   pusieron de acuerdo.

   ---------------------------------------------------------------------------
   LA TRAMPA DE ESTA FAMILIA

   Casi todos estos indicadores acumulan. OBV, A/D, VPT y los índices de
   volumen positivo y negativo son sumas que empiezan en cero el día que
   empieza tu gráfico. Eso significa que su NIVEL no significa nada: cambiar el
   principio de la serie cambia todos los valores. Lo único legible es su
   PENDIENTE y su divergencia con el precio.

   Es un fallo que se comete leyendo, no calculando, y por eso está escrito
   aquí y también en la ficha de cada uno.
   ============================================================ */
import type { Line, Series } from './types.ts';
import { at, blank, closes, highs, lows, src, volumes } from './types.ts';
import { ema, sma } from './ma.ts';

/* ============================================================
   On Balance Volume — Granville, 1963
   Suma el volumen si el cierre sube y lo resta si baja.

   Es deliberadamente tosco: una subida de un céntimo cuenta igual que una del
   tres por ciento. El libro lo enseña con esa crítica delante, porque
   entenderla es entender qué corrige el A/D.
   ============================================================ */
export function obv(s: Series): Line {
  const out = blank(s.length);
  if (!s.length) return out;
  let acc = 0;
  out[0] = 0;
  for (let i = 1; i < s.length; i++) {
    const b = s[i];
    const p = s[i - 1];
    if (!b || !p) continue;
    if (b.c > p.c) acc += b.v;
    else if (b.c < p.c) acc -= b.v;
    out[i] = acc;
  }
  return out;
}

/* ============================================================
   Acumulación / Distribución — Williams
   Pondera el volumen por DÓNDE cierra la vela dentro de su rango.

   Corrige el defecto del OBV y estrena otro que el libro tiene que señalar: no
   mira el cierre anterior, así que un hueco enorme a la baja que cierre en lo
   alto de su vela cuenta como acumulación. Ningún indicador de esta familia
   está libre; el trabajo del lector es saber de qué está ciego cada uno.
   ============================================================ */
export function accumDist(s: Series): Line {
  const out = blank(s.length);
  let acc = 0;
  for (let i = 0; i < s.length; i++) {
    const b = s[i];
    if (!b) continue;
    const rango = b.h - b.l;
    // Rango nulo: la vela no tiene «dentro», así que no aporta información de
    // localización. Sumar cero es lo correcto; dividir sería un infinito.
    const mfm = rango === 0 ? 0 : ((b.c - b.l) - (b.h - b.c)) / rango;
    acc += mfm * b.v;
    out[i] = acc;
  }
  return out;
}

/* ============================================================
   Chaikin Money Flow
   El A/D de las últimas n velas, normalizado por el volumen de esas n velas.

   La normalización es la mejora: convierte una suma sin escala en un número
   entre −1 y 1 que SÍ se puede comparar entre activos y entre épocas.
   ============================================================ */
export function cmf(s: Series, n = 20): Line {
  const out = blank(s.length);
  for (let i = n - 1; i < s.length; i++) {
    let num = 0;
    let den = 0;
    for (let j = i - n + 1; j <= i; j++) {
      const b = s[j];
      if (!b) continue;
      const rango = b.h - b.l;
      const mfm = rango === 0 ? 0 : ((b.c - b.l) - (b.h - b.c)) / rango;
      num += mfm * b.v;
      den += b.v;
    }
    out[i] = den === 0 ? 0 : num / den;
  }
  return out;
}

/* ============================================================
   Money Flow Index
   El RSI con el volumen dentro. Escala 0–100, misma lectura, mismo error
   clásico: 80 no significa «vende».
   ============================================================ */
export function mfi(s: Series, n = 14): Line {
  const tp = src(s, 'hlc3');
  const out = blank(s.length);
  for (let i = n; i < s.length; i++) {
    let pos = 0;
    let neg = 0;
    for (let j = i - n + 1; j <= i; j++) {
      const b = s[j];
      if (!b) continue;
      const flujo = at(tp, j) * b.v;
      if (at(tp, j) > at(tp, j - 1)) pos += flujo;
      else if (at(tp, j) < at(tp, j - 1)) neg += flujo;
    }
    out[i] = neg === 0 ? 100 : 100 - 100 / (1 + pos / neg);
  }
  return out;
}

/* ============================================================
   Force Index — Elder
   Variación del precio × volumen. Junta las dos preguntas —cuánto se movió y
   con cuánta participación— en un solo número con signo.
   ============================================================ */
export function forceIndex(s: Series, n = 13): Line {
  const bruto = blank(s.length);
  for (let i = 1; i < s.length; i++) {
    const b = s[i];
    const p = s[i - 1];
    if (!b || !p) continue;
    bruto[i] = (b.c - p.c) * b.v;
  }
  if (n <= 1) return bruto;
  const vals: number[] = [];
  let off = -1;
  for (let i = 0; i < bruto.length; i++) {
    const v = bruto[i];
    if (v === null || v === undefined) continue;
    if (off < 0) off = i;
    vals.push(v);
  }
  const suave = ema(vals, n);
  const out = blank(s.length);
  for (let i = 0; i < suave.length; i++) {
    const v = suave[i];
    if (v !== null && v !== undefined) out[off + i] = v;
  }
  return out;
}

/* ============================================================
   Ease of Movement — Arms
   Cuánto se mueve el precio POR unidad de volumen. Un valor alto significa
   que el precio subió sin que hiciera falta mucho volumen: el camino estaba
   despejado. Es la mejor aproximación de esta parte a la idea de liquidez.
   ============================================================ */
export function easeOfMovement(s: Series, n = 14, escala = 1_000_000): Line {
  const bruto = blank(s.length);
  for (let i = 1; i < s.length; i++) {
    const b = s[i];
    const p = s[i - 1];
    if (!b || !p) continue;
    const medio = (b.h + b.l) / 2 - (p.h + p.l) / 2;
    const rango = b.h - b.l;
    const box = b.v === 0 ? 0 : b.v / escala / (rango === 0 ? 1 : rango);
    bruto[i] = box === 0 ? 0 : medio / box;
  }
  const vals = bruto.map((v) => v ?? 0);
  return sma(vals, n);
}

/* ============================================================
   Índices de volumen negativo y positivo — Fosback

   El NVI solo cambia los días en que el volumen BAJA, con la tesis de que en
   esos días opera el dinero informado, sin ruido de multitud. Es una hipótesis,
   no un hecho, y el libro la presenta como tal: es de los pocos indicadores
   clásicos cuya premisa se puede enunciar y discutir.
   ============================================================ */
export function nvi(s: Series, base = 1000): Line {
  return volumeIndex(s, base, 'baja');
}
export function pvi(s: Series, base = 1000): Line {
  return volumeIndex(s, base, 'sube');
}

function volumeIndex(s: Series, base: number, cuando: 'sube' | 'baja'): Line {
  const out = blank(s.length);
  if (!s.length) return out;
  let acc = base;
  out[0] = acc;
  for (let i = 1; i < s.length; i++) {
    const b = s[i];
    const p = s[i - 1];
    if (!b || !p) continue;
    const cambia = cuando === 'sube' ? b.v > p.v : b.v < p.v;
    if (cambia && p.c !== 0) acc += acc * ((b.c - p.c) / p.c);
    out[i] = acc;
  }
  return out;
}

/* ============================================================
   Volume Price Trend
   Como el OBV pero ponderando por el porcentaje que se movió el precio.
   Es literalmente «el OBV que Granville debería haber escrito».
   ============================================================ */
export function vpt(s: Series): Line {
  const out = blank(s.length);
  if (!s.length) return out;
  let acc = 0;
  out[0] = 0;
  for (let i = 1; i < s.length; i++) {
    const b = s[i];
    const p = s[i - 1];
    if (!b || !p || p.c === 0) continue;
    acc += b.v * ((b.c - p.c) / p.c);
    out[i] = acc;
  }
  return out;
}

/** Volumen relativo: cuántas veces el volumen medio reciente. Es el número que
 *  convierte «hoy hay mucho volumen» en un dato comprobable, y el que sostiene
 *  el capítulo de confirmación de rupturas. */
export function relativeVolume(s: Series, n = 20): Line {
  const v = volumes(s);
  const m = sma(v, n);
  return m.map((x, i) => (x === null || x === undefined || x === 0 ? null : at(v, i) / x));
}

/** Tasa de cambio del volumen. */
export function volumeROC(s: Series, n = 14): Line {
  const v = volumes(s);
  const out = blank(s.length);
  for (let i = n; i < v.length; i++) {
    const base = at(v, i - n);
    out[i] = base === 0 ? 0 : (100 * (at(v, i) - base)) / base;
  }
  return out;
}

/* ============================================================
   VWAP — precio medio ponderado por volumen

   El precio al que se negoció de media, no el precio medio del gráfico. Esa
   distinción es todo: la media móvil pondera por TIEMPO y el VWAP por
   VOLUMEN, así que media hora de mercado muerto pesa en una media lo mismo
   que la apertura, y en el VWAP casi nada.

   Es la referencia real de las mesas institucionales, y por eso funciona: no
   funciona porque el gráfico rebote en una línea, funciona porque hay gente
   cuyo trabajo se mide contra ese número.

   `desde` es el anclaje. El VWAP de sesión ancla en la apertura; el anclado,
   en el evento que elija el analista —un máximo, un hueco, una noticia—. Que
   sea el mismo código con distinto anclaje es exactamente lo que el libro
   quiere que se entienda.
   ============================================================ */
export function vwap(s: Series, desde = 0, hasta?: number): Line {
  const tp = src(s, 'hlc3');
  const fin = hasta ?? s.length;
  const out = blank(s.length);
  let pv = 0;
  let vv = 0;
  for (let i = desde; i < fin && i < s.length; i++) {
    const b = s[i];
    if (!b) continue;
    pv += at(tp, i) * b.v;
    vv += b.v;
    out[i] = vv === 0 ? null : pv / vv;
  }
  return out;
}

/** VWAP con bandas de desviación típica ponderada por volumen.
 *
 *  La desviación se pondera POR VOLUMEN, no por tiempo: usar la desviación
 *  normal aquí daría unas bandas que no tienen nada que ver con la dispersión
 *  del precio negociado, que es justo lo que se quiere medir. */
export function vwapBands(s: Series, desde = 0, mults: number[] = [1, 2]): { vwap: Line; bands: { mult: number; upper: Line; lower: Line }[] } {
  const tp = src(s, 'hlc3');
  const centro = blank(s.length);
  const sd = blank(s.length);
  let pv = 0;
  let vv = 0;
  let pv2 = 0;
  for (let i = desde; i < s.length; i++) {
    const b = s[i];
    if (!b) continue;
    const p = at(tp, i);
    pv += p * b.v;
    pv2 += p * p * b.v;
    vv += b.v;
    if (vv === 0) continue;
    const media = pv / vv;
    centro[i] = media;
    const varianza = Math.max(0, pv2 / vv - media * media);
    sd[i] = Math.sqrt(varianza);
  }
  const bands = mults.map((mult) => ({
    mult,
    upper: centro.map((v, i) => {
      const d = sd[i];
      return v === null || d === null || d === undefined ? null : v + mult * d;
    }),
    lower: centro.map((v, i) => {
      const d = sd[i];
      return v === null || d === null || d === undefined ? null : v - mult * d;
    }),
  }));
  return { vwap: centro, bands };
}

/** Divide la serie en sesiones y devuelve un VWAP que se reinicia en cada una.
 *  `inicios` son los índices donde arranca cada sesión. */
export function sessionVwap(s: Series, inicios: number[]): Line {
  const out = blank(s.length);
  const marcas = inicios.length ? [...inicios].sort((a, b) => a - b) : [0];
  for (let k = 0; k < marcas.length; k++) {
    const a = marcas[k] ?? 0;
    const b = marcas[k + 1] ?? s.length;
    const parcial = vwap(s, a, b);
    for (let i = a; i < b && i < s.length; i++) out[i] = parcial[i] ?? null;
  }
  return out;
}

/* ============================================================
   Perfil de volumen

   Reparte el volumen de cada vela entre los niveles de precio que tocó, en vez
   de asignarlo al cierre. Con datos de verdad se construye desde el tick; aquí
   se reparte uniformemente por el rango de la vela.

   Esa aproximación hay que declararla —y el libro la declara— porque cambia el
   detalle fino: un perfil hecho así no distingue dónde DENTRO de la vela se
   negoció. Lo que sí conserva, y es lo que el análisis usa, es la forma del
   perfil, el punto de control y los extremos del área de valor.
   ============================================================ */
export interface NivelPerfil {
  /** Centro del nivel de precio. */
  precio: number;
  volumen: number;
}

export interface Perfil {
  niveles: NivelPerfil[];
  /** Point of Control: el precio con más volumen. Donde más se negoció, que
   *  es donde más gente tiene una posición que defender. */
  poc: number;
  /** Extremos del área de valor: el 70 % del volumen alrededor del POC. */
  vah: number;
  val: number;
  /** Nodos de alto volumen: zonas que frenan el precio. */
  hvn: number[];
  /** Nodos de bajo volumen: zonas que el precio cruza deprisa. */
  lvn: number[];
  alto: number;
  bajo: number;
  paso: number;
}

export function volumeProfile(s: Series, niveles = 40, areaValor = 0.7): Perfil {
  const alto = Math.max(...s.map((b) => b.h));
  const bajo = Math.min(...s.map((b) => b.l));
  const paso = (alto - bajo) / niveles || 1;
  const cubos = new Array<number>(niveles).fill(0);

  for (const b of s) {
    const desde = Math.max(0, Math.floor((b.l - bajo) / paso));
    const hasta = Math.min(niveles - 1, Math.floor((b.h - bajo) / paso));
    const cuantos = hasta - desde + 1;
    // Reparto uniforme por el rango de la vela. Cada nivel que tocó recibe la
    // misma parte, que es lo máximo que se puede afirmar sin datos de tick.
    const porNivel = b.v / Math.max(1, cuantos);
    for (let k = desde; k <= hasta; k++) cubos[k] = (cubos[k] ?? 0) + porNivel;
  }

  const lista: NivelPerfil[] = cubos.map((volumen, k) => ({ precio: bajo + paso * (k + 0.5), volumen }));

  let kPoc = 0;
  for (let k = 1; k < cubos.length; k++) if ((cubos[k] ?? 0) > (cubos[kPoc] ?? 0)) kPoc = k;

  /* El área de valor se expande desde el POC hacia el lado que más volumen
     ofrece en cada paso, hasta cubrir el 70 %. Es el método de Market Profile,
     y no equivale a tomar un percentil: el resultado es asimétrico cuando el
     perfil lo es, que es casi siempre. */
  const total = cubos.reduce((a, b) => a + b, 0);
  const objetivo = total * areaValor;
  let acc = cubos[kPoc] ?? 0;
  let lo = kPoc;
  let hi = kPoc;
  while (acc < objetivo && (lo > 0 || hi < niveles - 1)) {
    const abajo = lo > 0 ? cubos[lo - 1] ?? 0 : -1;
    const arriba = hi < niveles - 1 ? cubos[hi + 1] ?? 0 : -1;
    if (arriba >= abajo) { hi++; acc += arriba; }
    else { lo--; acc += abajo; }
  }

  const medio = total / niveles;
  const hvn: number[] = [];
  const lvn: number[] = [];
  for (let k = 1; k < niveles - 1; k++) {
    const v = cubos[k] ?? 0;
    const a = cubos[k - 1] ?? 0;
    const b = cubos[k + 1] ?? 0;
    if (v > a && v > b && v > medio * 1.2) hvn.push(bajo + paso * (k + 0.5));
    if (v < a && v < b && v < medio * 0.6) lvn.push(bajo + paso * (k + 0.5));
  }

  return {
    niveles: lista,
    poc: bajo + paso * (kPoc + 0.5),
    vah: bajo + paso * (hi + 1),
    val: bajo + paso * lo,
    hvn,
    lvn,
    alto,
    bajo,
    paso,
  };
}

/* ---------- selector ---------- */
export type VolumenKind =
  | 'obv' | 'ad' | 'cmf' | 'mfi' | 'force' | 'eom' | 'nvi' | 'pvi' | 'vpt' | 'relvol' | 'vroc';

export function volumenInd(s: Series, kind: VolumenKind, n?: number): Line {
  switch (kind) {
    case 'obv': return obv(s);
    case 'ad': return accumDist(s);
    case 'cmf': return cmf(s, n ?? 20);
    case 'mfi': return mfi(s, n ?? 14);
    case 'force': return forceIndex(s, n ?? 13);
    case 'eom': return easeOfMovement(s, n ?? 14);
    case 'nvi': return nvi(s);
    case 'pvi': return pvi(s);
    case 'vpt': return vpt(s);
    case 'relvol': return relativeVolume(s, n ?? 20);
    case 'vroc': return volumeROC(s, n ?? 14);
  }
}

export const VOLUMEN_LABEL: Record<VolumenKind, { es: string; en: string }> = {
  obv: { es: 'On Balance Volume', en: 'On Balance Volume' },
  ad: { es: 'Acumulación/Distribución', en: 'Accumulation/Distribution' },
  cmf: { es: 'Chaikin Money Flow', en: 'Chaikin Money Flow' },
  mfi: { es: 'Índice de flujo de dinero', en: 'Money Flow Index' },
  force: { es: 'Force Index', en: 'Force Index' },
  eom: { es: 'Ease of Movement', en: 'Ease of Movement' },
  nvi: { es: 'Índice de volumen negativo', en: 'Negative Volume Index' },
  pvi: { es: 'Índice de volumen positivo', en: 'Positive Volume Index' },
  vpt: { es: 'Volume Price Trend', en: 'Volume Price Trend' },
  relvol: { es: 'Volumen relativo', en: 'Relative Volume' },
  vroc: { es: 'Tasa de cambio del volumen', en: 'Volume Rate of Change' },
};
